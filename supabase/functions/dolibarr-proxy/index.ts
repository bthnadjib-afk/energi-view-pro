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
    return new Response(
      JSON.stringify({
        ok: response.ok,
        status: response.status,
        data: response.ok ? responseData : undefined,
        error: response.ok ? undefined : responseData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, status: 500, error: error.message || 'Erreur proxy Dolibarr' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
