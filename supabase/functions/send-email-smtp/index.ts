const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function extractEmailAddress(value: string): string {
  const match = value.match(/<([^>]+)>/)
  return (match?.[1] || value).trim()
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function toBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function chunkBase64(value: string): string {
  return value.replace(/\s/g, '').match(/.{1,76}/g)?.join('\r\n') || ''
}

function getLastSmtpLine(response: string): string {
  return response
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .pop() || ''
}

function assertSmtpCode(response: string, expectedCodes: string[]): void {
  const lastLine = getLastSmtpLine(response)
  if (!expectedCodes.some((code) => lastLine.startsWith(code))) {
    throw new Error(`Réponse SMTP inattendue: ${lastLine || response}`)
  }
}

async function readSmtpResponse(conn: Deno.Conn, decoder: TextDecoder): Promise<string> {
  const chunks: string[] = []
  const buf = new Uint8Array(4096)

  while (true) {
    const n = await conn.read(buf)
    if (!n) break

    const chunk = decoder.decode(buf.subarray(0, n))
    chunks.push(chunk)
    const response = chunks.join('')
    const normalized = response.replace(/\r/g, '')
    const lines = normalized.split('\n').filter(Boolean)
    const lastLine = lines[lines.length - 1] || ''

    if (/^\d{3} /.test(lastLine)) {
      return response
    }
  }

  return chunks.join('')
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

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
      return new Response(
        JSON.stringify({ error: 'SMTP non configuré.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { to, subject, message, pdfBase64, pdfFilename } = await req.json()

    if (!to || !subject) {
      return new Response(
        JSON.stringify({ error: 'Champs "to" et "subject" requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const recipient = extractEmailAddress(String(to))
    const mailFromAddress = extractEmailAddress(String(SMTP_FROM))
    const safeHtmlMessage = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #111827; white-space: pre-line;">${escapeHtml(String(message || ''))}</div>`
    const htmlMessageBase64 = chunkBase64(toBase64Utf8(safeHtmlMessage))

    const boundary = `boundary_${crypto.randomUUID().replace(/-/g, '')}`
    const nl = '\r\n'

    let emailBody = `From: ${SMTP_FROM}${nl}`
    emailBody += `To: ${recipient}${nl}`
    emailBody += `Subject: ${subject}${nl}`
    emailBody += `MIME-Version: 1.0${nl}`
    emailBody += `Content-Type: multipart/mixed; boundary="${boundary}"${nl}${nl}`

    emailBody += `--${boundary}${nl}`
    emailBody += `Content-Type: text/html; charset=utf-8${nl}`
    emailBody += `Content-Transfer-Encoding: base64${nl}${nl}`
    emailBody += `${htmlMessageBase64}${nl}${nl}`

    if (pdfBase64 && pdfFilename) {
      emailBody += `--${boundary}${nl}`
      emailBody += `Content-Type: application/pdf; name="${pdfFilename}"${nl}`
      emailBody += `Content-Disposition: attachment; filename="${pdfFilename}"${nl}`
      emailBody += `Content-Transfer-Encoding: base64${nl}${nl}`
      emailBody += `${chunkBase64(String(pdfBase64))}${nl}${nl}`
    }

    emailBody += `--${boundary}--${nl}`

    const port = parseInt(SMTP_PORT, 10)
    let conn: Deno.Conn

    if (port === 465) {
      conn = await Deno.connectTls({ hostname: SMTP_HOST, port })
    } else {
      conn = await Deno.connect({ hostname: SMTP_HOST, port })
    }

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    async function sendCmd(cmd: string, expectedCodes: string[]): Promise<string> {
      await conn.write(encoder.encode(cmd + '\r\n'))
      const response = await readSmtpResponse(conn, decoder)
      assertSmtpCode(response, expectedCodes)
      return response
    }

    const greeting = await readSmtpResponse(conn, decoder)
    assertSmtpCode(greeting, ['220'])

    let ehloResp = await sendCmd('EHLO localhost', ['250'])

    if (port !== 465 && ehloResp.includes('STARTTLS')) {
      await sendCmd('STARTTLS', ['220'])
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: SMTP_HOST })
      ehloResp = await sendCmd('EHLO localhost', ['250'])
    }

    if (ehloResp.includes('AUTH LOGIN')) {
      await sendCmd('AUTH LOGIN', ['334'])
      await sendCmd(btoa(SMTP_USER), ['334'])
      await sendCmd(btoa(SMTP_PASS), ['235'])
    } else {
      throw new Error('Le serveur SMTP ne supporte pas AUTH LOGIN')
    }

    await sendCmd(`MAIL FROM:<${mailFromAddress}>`, ['250'])
    await sendCmd(`RCPT TO:<${recipient}>`, ['250', '251'])
    await sendCmd('DATA', ['354'])
    await conn.write(encoder.encode(emailBody + '\r\n.\r\n'))
    const dataResp = await readSmtpResponse(conn, decoder)
    assertSmtpCode(dataResp, ['250'])
    await sendCmd('QUIT', ['221'])
    conn.close()

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('SMTP error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erreur envoi email SMTP' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})