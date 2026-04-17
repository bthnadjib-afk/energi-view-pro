import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify the token is valid (any authenticated user)
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET — all authenticated users can read the global config
    if (req.method === 'GET') {
      const { data, error } = await adminClient.from('app_config').select('key, value')
      if (error) throw error
      const config: Record<string, string> = {}
      for (const row of data || []) {
        config[row.key] = row.value
      }
      return new Response(JSON.stringify(config), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // POST — admin only
    if (req.method === 'POST') {
      const { data: roleData } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', userData.user.id)
        .eq('role', 'admin')
        .maybeSingle()

      if (!roleData) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const body = await req.json()
      if (!body || typeof body !== 'object') {
        return new Response(JSON.stringify({ error: 'Body must be a JSON object of key/value pairs' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const entries = Object.entries(body)
      for (const [key, value] of entries) {
        await adminClient.from('app_config').upsert(
          { key, value: String(value), updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
      }

      return new Response(JSON.stringify({ success: true, count: entries.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
