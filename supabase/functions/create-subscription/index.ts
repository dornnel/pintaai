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
const PRO_PRICE = 97.00

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SubscriptionRequest {
  billing_type: 'PIX' | 'BOLETO' | 'CREDIT_CARD'
  cpf_cnpj?: string
  card_number?: string
  card_expiry_month?: string
  card_expiry_year?: string
  card_ccv?: string
  card_holder_name?: string
  card_holder_email?: string
  card_holder_cpf_cnpj?: string
  card_holder_phone?: string
  card_holder_postal_code?: string
  card_holder_address?: string
  card_holder_address_number?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')
    const { data: { user: caller } } = await authClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!caller) throw new Error('Unauthorized')

    const body = await req.json() as SubscriptionRequest
    const { billing_type, cpf_cnpj } = body

    // Fetch user profile
    const { data: profile } = await sb.from('users').select('id, email, name, role').eq('auth_user_id', caller.id).maybeSingle()
    if (!profile) throw new Error('User not found')
    if (profile.role !== 'painter') throw new Error('Only painters can subscribe')

    // Check for existing active subscription
    const { data: existing } = await sb.from('user_subscriptions')
      .select('id, status').eq('user_id', profile.id).in('status', ['active', 'trial']).maybeSingle()
    if (existing) return new Response(JSON.stringify({ error: 'Já existe uma assinatura ativa.' }), {
      status: 409, headers: { ...cors, 'Content-Type': 'application/json' },
    })

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

    // Build subscription body
    const nextDueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const subBody: Record<string, unknown> = {
      customer: asaasCustomerId,
      billingType: billing_type,
      value: PRO_PRICE,
      nextDueDate,
      cycle: 'MONTHLY',
      description: 'Pinte Rápido Pro',
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
        email: body.card_holder_email || profile.email,
        cpfCnpj: body.card_holder_cpf_cnpj || cpf_cnpj,
        phone: body.card_holder_phone,
        postalCode: body.card_holder_postal_code,
        addressNumber: body.card_holder_address_number,
      }
    }

    const subRes = await fetch(`${ASAAS_BASE}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', access_token: ASAAS_KEY },
      body: JSON.stringify(subBody),
    })
    const subscription = await subRes.json()
    if (subscription.errors) throw new Error(JSON.stringify(subscription.errors))

    // Fetch plan id
    const { data: plan } = await sb.from('subscription_plans').select('id').eq('slug', 'pintae-pro').maybeSingle()

    // Upsert user_subscription row
    await sb.from('user_subscriptions').upsert({
      user_id: profile.id,
      plan_id: plan?.id ?? null,
      asaas_subscription_id: subscription.id,
      asaas_customer_id: asaasCustomerId,
      status: 'active',
      start_date: nextDueDate,
      next_billing_date: nextDueDate,
    }, { onConflict: 'user_id' })

    // Activate painter Pro plan
    await sb.from('painters').update({ pro_plan_status: 'active' }).eq('user_id', profile.id)

    return new Response(JSON.stringify({
      ok: true,
      subscription_id: subscription.id,
      next_billing_date: nextDueDate,
      status: subscription.status,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error(err)
    const msg = err instanceof Error ? err.message : String(err)
    const status = msg === 'Unauthorized' ? 401 : 500
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
