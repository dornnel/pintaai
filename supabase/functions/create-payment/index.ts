import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { db: { schema: 'pintae' } },
)

const ASAAS_BASE = Deno.env.get('ASAAS_ENV') === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3'

const ASAAS_KEY = Deno.env.get('ASAAS_API_KEY')!
const PLATFORM_FEE_RATE = 0.08 // 8%

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PaymentRequest {
  service_request_id: string
  quote_id: string
  customer_name: string
  customer_email: string
  customer_cpf_cnpj: string
  payment_method: 'PIX' | 'BOLETO' | 'CREDIT_CARD'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const body = await req.json() as PaymentRequest
    const { service_request_id, quote_id, customer_name, customer_email, customer_cpf_cnpj, payment_method } = body

    // Load quote to get price
    const { data: quote, error: qErr } = await supabase
      .from('quotes')
      .select('total_price, provider_id')
      .eq('id', quote_id)
      .single()

    if (qErr || !quote) throw new Error('Quote not found')

    const grossAmount = quote.total_price
    const platformFee = Number((grossAmount * PLATFORM_FEE_RATE).toFixed(2))
    const painterAmount = Number((grossAmount - platformFee).toFixed(2))

    // Get or create Asaas customer
    const customerRes = await fetch(`${ASAAS_BASE}/customers?email=${encodeURIComponent(customer_email)}&limit=1`, {
      headers: { access_token: ASAAS_KEY },
    })
    const customerData = await customerRes.json()
    let asaasCustomerId: string

    if (customerData.data?.length > 0) {
      asaasCustomerId = customerData.data[0].id
    } else {
      const createCustomer = await fetch(`${ASAAS_BASE}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', access_token: ASAAS_KEY },
        body: JSON.stringify({ name: customer_name, email: customer_email, cpfCnpj: customer_cpf_cnpj }),
      })
      const created = await createCustomer.json()
      asaasCustomerId = created.id
    }

    // Create payment with escrow (hold for manual split release)
    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const paymentBody: Record<string, unknown> = {
      customer: asaasCustomerId,
      billingType: payment_method,
      value: grossAmount,
      dueDate,
      description: `Pinte Rápido — Serviço de pintura #${service_request_id.slice(0, 8)}`,
      externalReference: service_request_id,
    }

    if (payment_method === 'PIX') paymentBody.pixAddressKeyType = 'EVP'

    const paymentRes = await fetch(`${ASAAS_BASE}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', access_token: ASAAS_KEY },
      body: JSON.stringify(paymentBody),
    })
    const payment = await paymentRes.json()

    if (payment.errors) throw new Error(JSON.stringify(payment.errors))

    // Fetch Pix QR code if PIX
    let pixQrCode = null, pixCopyPaste = null
    if (payment_method === 'PIX' && payment.id) {
      const pixRes = await fetch(`${ASAAS_BASE}/payments/${payment.id}/pixQrCode`, {
        headers: { access_token: ASAAS_KEY },
      })
      const pix = await pixRes.json()
      pixQrCode = pix.encodedImage
      pixCopyPaste = pix.payload
    }

    // Save transaction to DB
    const { data: transaction } = await supabase.from('payment_transactions').insert({
      service_request_id,
      quote_id,
      painter_id: quote.provider_id,
      asaas_payment_id: payment.id,
      asaas_customer_id: asaasCustomerId,
      gross_amount: grossAmount,
      platform_fee_rate: PLATFORM_FEE_RATE,
      platform_fee: platformFee,
      painter_amount: painterAmount,
      payment_method: payment_method.toLowerCase(),
      status: 'awaiting_payment',
      pix_qr_code: pixQrCode,
      pix_copy_paste: pixCopyPaste,
      boleto_url: payment.bankSlipUrl || null,
      payment_url: payment.invoiceUrl,
    }).select().single()

    // Create default milestones
    if (transaction) {
      await supabase.from('payment_milestones').insert([
        { payment_transaction_id: transaction.id, name: 'booking_confirmed', label: 'Agendamento confirmado', percentage: 0, amount: 0 },
        { payment_transaction_id: transaction.id, name: 'work_started', label: 'Serviço iniciado', percentage: 30, amount: painterAmount * 0.30 },
        { payment_transaction_id: transaction.id, name: 'work_in_progress', label: 'Em andamento (fotos aprovadas)', percentage: 40, amount: painterAmount * 0.40 },
        { payment_transaction_id: transaction.id, name: 'completed', label: 'Serviço concluído', percentage: 30, amount: painterAmount * 0.30 },
      ])
    }

    return new Response(JSON.stringify({
      transaction_id: transaction?.id,
      payment_url: payment.invoiceUrl,
      pix_qr_code: pixQrCode,
      pix_copy_paste: pixCopyPaste,
      boleto_url: payment.bankSlipUrl,
      status: 'awaiting_payment',
      gross_amount: grossAmount,
      platform_fee: platformFee,
      painter_amount: painterAmount,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
