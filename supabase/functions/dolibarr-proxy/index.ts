import { corsHeaders } from '@supabase/supabase-js/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const DOLIBARR_API_URL = Deno.env.get('DOLIBARR_API_URL')
    const DOLIBARR_API_KEY = Deno.env.get('DOLIBARR_API_KEY')

    if (!DOLIBARR_API_URL || !DOLIBARR_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Dolibarr API non configurée. Ajoutez DOLIBARR_API_URL et DOLIBARR_API_KEY dans les secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { endpoint, method = 'GET', data } = await req.json()

    if (!endpoint || typeof endpoint !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Le champ "endpoint" est requis (ex: /thirdparties)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    return new Response(
      JSON.stringify(responseData),
      {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erreur proxy Dolibarr' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
