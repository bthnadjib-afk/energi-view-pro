const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SMTP_HOST = Deno.env.get('SMTP_HOST')
    const SMTP_PORT = Deno.env.get('SMTP_PORT') || '587'
    const SMTP_USER = Deno.env.get('SMTP_USER')
    const SMTP_PASS = Deno.env.get('SMTP_PASS')
    const SMTP_FROM = Deno.env.get('SMTP_FROM') || SMTP_USER

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      return new Response(
        JSON.stringify({ error: 'SMTP non configuré. Ajoutez SMTP_HOST, SMTP_USER et SMTP_PASS dans les secrets.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { to, subject, message, pdfBase64, pdfFilename } = await req.json()

    if (!to || !subject) {
      return new Response(
        JSON.stringify({ error: 'Champs "to" et "subject" requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build MIME multipart email
    const boundary = `boundary_${crypto.randomUUID().replace(/-/g, '')}`
    const nl = '\r\n'

    let emailBody = `From: ${SMTP_FROM}${nl}`
    emailBody += `To: ${to}${nl}`
    emailBody += `Subject: ${subject}${nl}`
    emailBody += `MIME-Version: 1.0${nl}`
    emailBody += `Content-Type: multipart/mixed; boundary="${boundary}"${nl}${nl}`

    // Text part
    emailBody += `--${boundary}${nl}`
    emailBody += `Content-Type: text/html; charset=utf-8${nl}`
    emailBody += `Content-Transfer-Encoding: quoted-printable${nl}${nl}`
    emailBody += `${message || ''}${nl}${nl}`

    // PDF attachment if provided
    if (pdfBase64 && pdfFilename) {
      emailBody += `--${boundary}${nl}`
      emailBody += `Content-Type: application/pdf; name="${pdfFilename}"${nl}`
      emailBody += `Content-Disposition: attachment; filename="${pdfFilename}"${nl}`
      emailBody += `Content-Transfer-Encoding: base64${nl}${nl}`
      // Split base64 into 76-char lines per RFC
      const b64 = pdfBase64.replace(/\s/g, '')
      for (let i = 0; i < b64.length; i += 76) {
        emailBody += b64.slice(i, i + 76) + nl
      }
      emailBody += nl
    }

    emailBody += `--${boundary}--${nl}`

    // Connect to SMTP via Deno's built-in TLS
    const port = parseInt(SMTP_PORT, 10)
    let conn: Deno.Conn

    if (port === 465) {
      conn = await Deno.connectTls({ hostname: SMTP_HOST, port })
    } else {
      conn = await Deno.connect({ hostname: SMTP_HOST, port })
    }

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    async function readResponse(): Promise<string> {
      const buf = new Uint8Array(4096)
      const n = await conn.read(buf)
      return n ? decoder.decode(buf.subarray(0, n)) : ''
    }

    async function sendCmd(cmd: string): Promise<string> {
      await conn.write(encoder.encode(cmd + '\r\n'))
      return await readResponse()
    }

    // SMTP handshake
    await readResponse() // greeting
    let ehloResp = await sendCmd(`EHLO localhost`)

    // STARTTLS if not already TLS (port 587)
    if (port !== 465 && ehloResp.includes('STARTTLS')) {
      await sendCmd('STARTTLS')
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: SMTP_HOST })
      ehloResp = await sendCmd('EHLO localhost')
    }

    // AUTH LOGIN
    await sendCmd('AUTH LOGIN')
    await sendCmd(btoa(SMTP_USER))
    const authResp = await sendCmd(btoa(SMTP_PASS))
    if (!authResp.startsWith('235')) {
      conn.close()
      throw new Error(`Authentification SMTP échouée: ${authResp}`)
    }

    await sendCmd(`MAIL FROM:<${SMTP_FROM}>`)
    await sendCmd(`RCPT TO:<${to}>`)
    await sendCmd('DATA')
    await conn.write(encoder.encode(emailBody + '\r\n.\r\n'))
    const dataResp = await readResponse()
    await sendCmd('QUIT')
    conn.close()

    if (!dataResp.startsWith('250')) {
      throw new Error(`Envoi SMTP échoué: ${dataResp}`)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('SMTP error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Erreur envoi email SMTP' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
