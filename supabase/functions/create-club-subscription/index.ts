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
const CLUB_PRICE = 49.00
const CLUB_CREDITS = 10

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ClubRequest {
  billing_type: 'PIX' | 'BOLETO' | 'CREDIT_CARD'
  cpf_cnpj?: string
  card_number?: string
  card_expiry_month?: string
  card_expiry_year?: string
  card_ccv?: string
  card_holder_name?: string
  card_holder_cpf_cnpj?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')
    const { data: { user: caller } } = await authClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!caller) throw new Error('Unauthorized')

    const body = await req.json() as ClubRequest
    const { billing_type, cpf_cnpj } = body

    const { data: profile } = await sb.from('users').select('id, email, name, role, is_club_member').eq('auth_user_id', caller.id).maybeSingle()
    if (!profile) throw new Error('User not found')

    const { data: existing } = await sb.from('user_subscriptions')
      .select('id, status, plan_id')
      .eq('user_id', profile.id)
      .in('status', ['active', 'trial'])
      .maybeSingle()

    // Check if already on club plan
    if (existing) {
      const { data: plan } = await sb.from('subscription_plans').select('slug').eq('id', existing.plan_id).maybeSingle()
      if (plan?.slug === 'customer-club') {
        return new Response(JSON.stringify({ error: 'Já é membro do Clube Pinte Rápido.' }), {
          status: 409, headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
    }

    // Get or create Asaas customer
    const custSearch = await fetch(`${ASAAS_BASE}/customers?email=${encodeURIComponent(profile.email!)}&limit=1`, {
      headers: { access_token: ASAAS_KEY },
    })
    const custData = await custSearch.json()
    let asaasCustomerId: string
    if (custData.data?.length > 0) {
      asaasCustomerId = custData.data[0].id
    } else {
      const createRes = await fetch(`${ASAAS_BASE}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', access_token: ASAAS_KEY },
        body: JSON.stringify({ name: profile.name, email: profile.email, cpfCnpj: cpf_cnpj }),
      })
      const created = await createRes.json()
      if (!created.id) throw new Error(`Asaas customer error: ${JSON.stringify(created.errors)}`)
      asaasCustomerId = created.id
    }

    const nextDueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const subBody: Record<string, unknown> = {
      customer: asaasCustomerId,
      billingType: billing_type,
      value: CLUB_PRICE,
      nextDueDate,
      cycle: 'MONTHLY',
      description: 'Clube Pinte Rápido',
      externalReference: profile.id,
    }

    if (billing_type === 'CREDIT_CARD') {
      subBody.creditCard = {
        holderName: body.card_holder_name,
        number: body.card_number,
        expiryMonth: body.card_expiry_month,
        expiryYear: body.card_expiry_year,
        ccv: body.card_ccv,
      }
      subBody.creditCardHolderInfo = {
        name: body.card_holder_name,
        email: profile.email,
        cpfCnpj: body.card_holder_cpf_cnpj || cpf_cnpj,
      }
    }

    const subRes = await fetch(`${ASAAS_BASE}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', access_token: ASAAS_KEY },
      body: JSON.stringify(subBody),
    })
    const subscription = await subRes.json()
    if (subscription.errors) throw new Error(JSON.stringify(subscription.errors))

    const { data: plan } = await sb.from('subscription_plans').select('id').eq('slug', 'customer-club').maybeSingle()

    await sb.from('user_subscriptions').upsert({
      user_id: profile.id,
      plan_id: plan?.id ?? null,
      asaas_subscription_id: subscription.id,
      asaas_customer_id: asaasCustomerId,
      status: 'active',
      next_billing_date: nextDueDate,
    }, { onConflict: 'user_id' })

    await sb.from('users').update({ is_club_member: true, club_credits: CLUB_CREDITS }).eq('id', profile.id)

    return new Response(JSON.stringify({ ok: true, subscription_id: subscription.id, next_billing_date: nextDueDate }), {
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
