const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const DOLIBARR_API_URL = Deno.env.get('DOLIBARR_API_URL')
    const DOLIBARR_API_KEY = Deno.env.get('DOLIBARR_API_KEY')

    if (!DOLIBARR_API_URL || !DOLIBARR_API_KEY) {
      return new Response(
        JSON.stringify({ ok: false, status: 500, error: 'Dolibarr API non configurée. Ajoutez DOLIBARR_API_URL et DOLIBARR_API_KEY dans les secrets.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { endpoint, method = 'GET', data } = await req.json()

    if (!endpoint || typeof endpoint !== 'string') {
      return new Response(
        JSON.stringify({ ok: false, status: 400, error: 'Le champ "endpoint" est requis (ex: /thirdparties)' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = `${DOLIBARR_API_URL}${endpoint}`
    const fetchOptions: RequestInit = {
      method: method.toUpperCase(),
      headers: {
        'DOLAPIKEY': DOLIBARR_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    }

    if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      fetchOptions.body = JSON.stringify(data)
    }

    const response = await fetch(url, fetchOptions)
    const responseText = await response.text()

    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = responseText
    }

    // Always return HTTP 200 so supabase.functions.invoke() doesn't throw.
    // The real Dolibarr status is in the JSON body.
    // Note: 304 (Not Modified) is also considered a success — Dolibarr returns it
    // when validate/close is called on a document already in target state.
    const isOk = response.ok || response.status === 304
    return new Response(
      JSON.stringify({
        ok: isOk,
        status: response.status,
        data: isOk ? (responseData ?? null) : undefined,
        error: isOk ? undefined : responseData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur proxy Dolibarr'
    return new Response(
      JSON.stringify({ ok: false, status: 500, error: msg }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
