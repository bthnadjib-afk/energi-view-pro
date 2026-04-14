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

async function readSmtpResponse(conn: Deno.Conn, decoder: TextDecoder, timeoutMs = 15000): Promise<string> {
  const chunks: string[] = []
  const buf = new Uint8Array(4096)

  while (true) {
    const readPromise = conn.read(buf)
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('SMTP read timeout')), timeoutMs)
    )

    const n = await Promise.race([readPromise, timeoutPromise]) as number | null
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

async function trySendSmtp(params: {
  SMTP_HOST: string; SMTP_PORT: string; SMTP_USER: string; SMTP_PASS: string; SMTP_FROM: string;
  to: string; subject: string; message?: string; pdfBase64?: string; pdfFilename?: string;
}): Promise<void> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, to, subject, message, pdfBase64, pdfFilename } = params

  const recipient = extractEmailAddress(String(to))
  const mailFromAddress = extractEmailAddress(String(SMTP_FROM))
  const safeHtmlMessage = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #111827; white-space: pre-line;">${escapeHtml(String(message || ''))}</div>`
  const htmlMessageBase64 = chunkBase64(toBase64Utf8(safeHtmlMessage))

  const boundary = `boundary_${crypto.randomUUID().replace(/-/g, '')}`
  const nl = '\r\n'

  let emailBody = `From: ${SMTP_FROM}${nl}`
  emailBody += `To: ${recipient}${nl}`
  emailBody += `Subject: =?UTF-8?B?${toBase64Utf8(subject)}?=${nl}`
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

  console.log(`Connecting to SMTP ${SMTP_HOST}:${port}...`)

  if (port === 465) {
    conn = await Deno.connectTls({ hostname: SMTP_HOST, port })
  } else {
    conn = await Deno.connect({ hostname: SMTP_HOST, port })
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  async function sendCmd(cmd: string, expectedCodes: string[]): Promise<string> {
    const logCmd = cmd.length > 50 ? cmd.substring(0, 50) + '...' : cmd
    console.log(`> ${logCmd}`)
    await conn.write(encoder.encode(cmd + '\r\n'))
    const response = await readSmtpResponse(conn, decoder)
    const lastLine = getLastSmtpLine(response)
    console.log(`< ${lastLine}`)
    assertSmtpCode(response, expectedCodes)
    return response
  }

  try {
    const greeting = await readSmtpResponse(conn, decoder)
    console.log(`Greeting: ${getLastSmtpLine(greeting)}`)
    assertSmtpCode(greeting, ['220'])

    let ehloResp = await sendCmd('EHLO localhost', ['250'])

    if (port !== 465 && ehloResp.includes('STARTTLS')) {
      await sendCmd('STARTTLS', ['220'])
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: SMTP_HOST })
      ehloResp = await sendCmd('EHLO localhost', ['250'])
    }

    // Try AUTH PLAIN first, then AUTH LOGIN
    if (ehloResp.includes('AUTH') && ehloResp.includes('PLAIN')) {
      const authString = btoa(`\0${SMTP_USER}\0${SMTP_PASS}`)
      await sendCmd(`AUTH PLAIN ${authString}`, ['235'])
    } else if (ehloResp.includes('AUTH') && ehloResp.includes('LOGIN')) {
      await sendCmd('AUTH LOGIN', ['334'])
      await sendCmd(btoa(SMTP_USER), ['334'])
      await sendCmd(btoa(SMTP_PASS), ['235'])
    } else {
      throw new Error('Le serveur SMTP ne supporte ni AUTH PLAIN ni AUTH LOGIN')
    }

    await sendCmd(`MAIL FROM:<${mailFromAddress}>`, ['250'])
    await sendCmd(`RCPT TO:<${recipient}>`, ['250', '251'])
    await sendCmd('DATA', ['354'])
    await conn.write(encoder.encode(emailBody + '\r\n.\r\n'))
    const dataResp = await readSmtpResponse(conn, decoder)
    assertSmtpCode(dataResp, ['250'])

    try {
      await sendCmd('QUIT', ['221'])
    } catch {
      // ignore quit errors
    }
  } finally {
    try { conn.close() } catch { /* already closed */ }
  }
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

    // Retry logic: up to 2 attempts
    let lastError: Error | null = null
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`SMTP attempt ${attempt}/2`)
        await trySendSmtp({ SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, to, subject, message, pdfBase64, pdfFilename })
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        console.error(`SMTP attempt ${attempt} failed:`, lastError.message)
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 2000))
        }
      }
    }

    throw lastError || new Error('Échec envoi SMTP')
  } catch (error) {
    console.error('SMTP error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erreur envoi email SMTP' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
