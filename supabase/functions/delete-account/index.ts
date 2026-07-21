import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY') ?? ''
const ASAAS_ENV = Deno.env.get('ASAAS_ENV') ?? 'sandbox'
const ASAAS_BASE = ASAAS_ENV === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3'

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

  // Admins cannot self-delete
  if (profile.role === 'admin') {
    return new Response(JSON.stringify({ error: 'Admin accounts cannot be self-deleted.' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Painter-specific cleanup before deletion
  if (profile.role === 'painter') {
    // Nullify painter_id in payment_transactions (FK is ON DELETE SET NULL via migration 042)
    const { data: painterRow } = await appClient
      .from('painters').select('id').eq('user_id', profile.id).maybeSingle()

    if (painterRow) {
      await appClient
        .from('payment_transactions')
        .update({ painter_id: null })
        .eq('painter_id', painterRow.id)

      // Cancel active Asaas subscription if any
      const { data: sub } = await appClient
        .from('user_subscriptions')
        .select('asaas_subscription_id')
        .eq('user_id', profile.id)
        .in('status', ['active', 'trial'])
        .maybeSingle()

      if (sub?.asaas_subscription_id && ASAAS_API_KEY) {
        await fetch(`${ASAAS_BASE}/subscriptions/${sub.asaas_subscription_id}`, {
          method: 'DELETE',
          headers: { access_token: ASAAS_API_KEY },
        }).catch(() => { /* best-effort */ })
      }
    }
  }

  // Delete user row (FK cascade removes painters → painter_scores, lead_painter_interactions)
  await appClient.from('users').delete().eq('id', profile.id)

  // Delete Supabase auth user
  await authClient.auth.admin.deleteUser(caller.id)

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
