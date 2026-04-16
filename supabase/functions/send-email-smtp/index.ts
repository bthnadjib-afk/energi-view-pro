import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Read SMTP config from app_config table (fallback when env secrets are not set)
async function loadSmtpFromAppConfig(): Promise<Record<string, string>> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return {}
  try {
    const admin = createClient(supabaseUrl, serviceKey)
    const { data } = await admin
      .from('app_config')
      .select('key, value')
      .in('key', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp.host', 'smtp.port', 'smtp.user', 'smtp.pass', 'smtp.from'])
    if (!data) return {}
    const result: Record<string, string> = {}
    for (const row of data) result[row.key] = row.value
    return result
  } catch {
    return {}
  }
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
    console.log(`[OVH SSL] Tentative connexion TLS directe sur ${SMTP_HOST}:${port}`)
    try {
      conn = await Deno.connectTls({ hostname: SMTP_HOST, port })
      console.log(`[OVH SSL] Connexion TLS établie avec succès`)
    } catch (tlsErr) {
      const msg = tlsErr instanceof Error ? tlsErr.message : String(tlsErr)
      console.error(`[OVH SSL] Échec connexion TLS à ${SMTP_HOST}:${port} — ${msg}`)
      console.error(`[OVH SSL] Diagnostic: 1) Vérifiez smtp_user/smtp_pass dans app_config, 2) Le port 465 SSL doit être activé sur le compte OVH, 3) Accès réseau sortant depuis Supabase Edge Functions vers ssl0.ovh.net:465`)
      throw new Error(`Connexion SSL OVH échouée (${SMTP_HOST}:${port}): ${msg}`)
    }
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
    // Priority 0 (highest): credentials passed directly in the request body
    // Priority 1: Supabase secrets (env vars)
    // Priority 2: app_config table (configured from the app's Configuration page)

    // Read body first so request credentials can override everything
    const { to, subject, message, pdfBase64, pdfFilename, smtpHost, smtpPort, smtpUser, smtpPass } = await req.json()

    let SMTP_HOST = smtpHost || Deno.env.get('SMTP_HOST') || ''
    let SMTP_PORT = smtpPort || Deno.env.get('SMTP_PORT') || ''
    let SMTP_USER = smtpUser || Deno.env.get('SMTP_USER') || ''
    let SMTP_PASS = smtpPass || Deno.env.get('SMTP_PASS') || ''

    // Fallback to app_config only if still missing
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      const appCfg = await loadSmtpFromAppConfig()
      SMTP_HOST = SMTP_HOST || appCfg['smtp_host'] || appCfg['smtp.host'] || 'ssl0.ovh.net'
      SMTP_PORT = SMTP_PORT || appCfg['smtp_port'] || appCfg['smtp.port'] || '465'
      SMTP_USER = SMTP_USER || appCfg['smtp_user'] || appCfg['smtp.user'] || ''
      SMTP_PASS = SMTP_PASS || appCfg['smtp_pass'] || appCfg['smtp.pass'] || ''
    }

    SMTP_PORT = SMTP_PORT || '465'
    // Expéditeur fixe OVH
    const SMTP_FROM = 'contact@electriciendugenevois.fr'

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      return new Response(
        JSON.stringify({ ok: false, error: 'SMTP non configuré. Renseignez les paramètres dans Configuration → Serveur mail.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!to || !subject) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Champs "to" et "subject" requis' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Retry logic: up to 2 attempts
    let lastError: Error | null = null
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`SMTP attempt ${attempt}/2`)
        await trySendSmtp({ SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, to, subject, message, pdfBase64, pdfFilename })
        return new Response(
          JSON.stringify({ ok: true }),
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

    const smtpErrMsg = lastError?.message || 'Échec envoi SMTP'
    console.error('SMTP final error:', smtpErrMsg)
    return new Response(
      JSON.stringify({ ok: false, error: smtpErrMsg }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur envoi email SMTP'
    console.error('SMTP handler error:', msg)
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
