import { createClient } from 'npm:@supabase/supabase-js@2'

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { db: { schema: 'pintae' } },
)
const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const ASAAS_BASE = Deno.env.get('ASAAS_ENV') === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3'
const ASAAS_KEY = Deno.env.get('ASAAS_API_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')
    const { data: { user: caller } } = await authClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!caller) throw new Error('Unauthorized')

    const { data: profile } = await sb.from('users').select('id, role').eq('auth_user_id', caller.id).maybeSingle()
    if (!profile) throw new Error('User not found')

    const { data: sub } = await sb.from('user_subscriptions')
      .select('id, asaas_subscription_id')
      .eq('user_id', profile.id)
      .in('status', ['active', 'trial'])
      .maybeSingle()

    if (!sub) {
      return new Response(JSON.stringify({ error: 'Nenhuma assinatura ativa encontrada.' }), {
        status: 404, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Cancel in Asaas
    if (sub.asaas_subscription_id) {
      await fetch(`${ASAAS_BASE}/subscriptions/${sub.asaas_subscription_id}`, {
        method: 'DELETE',
        headers: { access_token: ASAAS_KEY },
      })
    }

    // Update local records
    await sb.from('user_subscriptions').update({ status: 'canceled' }).eq('id', sub.id)
    await sb.from('painters').update({ pro_plan_status: 'canceled' }).eq('user_id', profile.id)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error(err)
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: msg === 'Unauthorized' ? 401 : 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
