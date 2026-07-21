import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { db: { schema: 'pintae' } },
)

const WEBHOOK_TOKEN = Deno.env.get('ASAAS_WEBHOOK_TOKEN')

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  // Validate webhook token
  const token = req.headers.get('asaas-access-token')
  if (WEBHOOK_TOKEN && token !== WEBHOOK_TOKEN) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const event = await req.json()
    const { event: eventType, payment } = event

    if (!payment?.id) return new Response('OK', { headers: cors })

    // ── Subscription renewal / overdue handling ──────────────────────────────
    if (payment.subscription) {
      const subId = payment.subscription
      if (eventType === 'PAYMENT_RECEIVED' || eventType === 'PAYMENT_CONFIRMED') {
        const nextDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        await supabase.from('user_subscriptions')
          .update({ status: 'active', next_billing_date: nextDate })
          .eq('asaas_subscription_id', subId)
        const { data: sub } = await supabase.from('user_subscriptions')
          .select('user_id').eq('asaas_subscription_id', subId).maybeSingle()
        if (sub) await supabase.from('painters').update({ pro_plan_status: 'active' }).eq('user_id', sub.user_id)
      } else if (eventType === 'PAYMENT_OVERDUE') {
        await supabase.from('user_subscriptions')
          .update({ status: 'overdue' })
          .eq('asaas_subscription_id', subId)
        const { data: sub } = await supabase.from('user_subscriptions')
          .select('user_id').eq('asaas_subscription_id', subId).maybeSingle()
        if (sub) await supabase.from('painters').update({ pro_plan_status: 'none' }).eq('user_id', sub.user_id)
      }
      return new Response('OK', { headers: cors })
    }

    // Find transaction by Asaas payment ID
    const { data: transaction } = await supabase
      .from('payment_transactions')
      .select('id, service_request_id, status')
      .eq('asaas_payment_id', payment.id)
      .single()

    if (!transaction) return new Response('OK', { headers: cors })

    let newStatus = transaction.status
    let paidAt = null

    switch (eventType) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        newStatus = 'held'
        paidAt = new Date().toISOString()
        break
      case 'PAYMENT_OVERDUE':
        newStatus = 'pending'
        break
      case 'PAYMENT_REFUNDED':
        newStatus = 'refunded'
        break
      case 'PAYMENT_CHARGEBACK_REQUESTED':
        newStatus = 'disputed'
        break
    }

    // Update transaction
    await supabase.from('payment_transactions').update({
      status: newStatus,
      ...(paidAt ? { paid_at: paidAt } : {}),
      updated_at: new Date().toISOString(),
    }).eq('id', transaction.id)

    // If payment confirmed: update service_request status
    if (newStatus === 'held' && transaction.service_request_id) {
      await supabase.from('service_requests').update({
        status: 'payment_held',
        updated_at: new Date().toISOString(),
      }).eq('id', transaction.service_request_id)

      // Approve booking_confirmed milestone (0% — just marks it)
      await supabase.from('payment_milestones').update({
        status: 'approved',
        approved_at: new Date().toISOString(),
      }).eq('payment_transaction_id', transaction.id).eq('name', 'booking_confirmed')

      // Save system message about payment confirmed
      await supabase.from('messages').insert({
        service_request_id: transaction.service_request_id,
        channel: 'system',
        direction: 'outbound',
        body: `✅ Pagamento confirmado e retido na plataforma. Agora você pode agendar a pintura.`,
        metadata: { event: eventType, asaas_payment_id: payment.id },
      })
    }

    return new Response('OK', { headers: cors })
  } catch (err) {
    console.error('Asaas webhook error:', err)
    return new Response('Error', { status: 500, headers: cors })
  }
})
