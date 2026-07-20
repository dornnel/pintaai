import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const appClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { db: { schema: 'pintae' } })
const authClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user: caller }, error } = await authClient.auth.getUser(token)
  if (error || !caller) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Fetch user record to confirm identity
  const { data: profile } = await appClient
    .from('users')
    .select('id, role')
    .eq('auth_user_id', caller.id)
    .maybeSingle()

  if (!profile) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Admins and painters cannot self-delete via this endpoint
  if (profile.role === 'admin' || profile.role === 'painter') {
    return new Response(JSON.stringify({ error: 'Contact support to delete this account type.' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Delete user row (cascades to leads etc. via FK or RLS)
  await appClient.from('users').delete().eq('id', profile.id)

  // Delete Supabase auth user
  await authClient.auth.admin.deleteUser(caller.id)

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
