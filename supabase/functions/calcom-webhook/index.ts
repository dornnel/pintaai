import { createClient } from 'npm:@supabase/supabase-js@2'
import { createHmac } from 'node:crypto'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { db: { schema: 'pintae' } },
)

const CALCOM_SECRET = Deno.env.get('CALCOM_WEBHOOK_SECRET') || ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cal-signature-256',
}

function verifySignature(body: string, signature: string): boolean {
  if (!CALCOM_SECRET) return true
  const hmac = createHmac('sha256', CALCOM_SECRET)
  const digest = hmac.update(body).digest('hex')
  return digest === signature
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const rawBody = await req.text()
    const sig = req.headers.get('x-cal-signature-256') || ''

    if (!verifySignature(rawBody, sig)) {
      return new Response('Invalid signature', { status: 401 })
    }

    const event = JSON.parse(rawBody)
    const { triggerEvent, payload } = event

    const serviceRequestId = payload?.metadata?.service_request_id as string | undefined
    const uid = payload?.uid as string | undefined

    if (!uid) return new Response('OK', { headers: cors })

    switch (triggerEvent) {
      case 'BOOKING_CREATED':
      case 'BOOKING_CONFIRMED': {
        await supabase.from('service_appointments').upsert({
          service_request_id: serviceRequestId || null,
          calcom_booking_uid: uid,
          calcom_event_type_id: String(payload?.eventTypeId || ''),
          scheduled_start: payload?.startTime,
          scheduled_end: payload?.endTime,
          status: 'confirmed',
          meeting_url: payload?.metadata?.meetingUrl || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'calcom_booking_uid' })

        if (serviceRequestId) {
          await supabase.from('service_requests').update({
            status: 'scheduled',
            updated_at: new Date().toISOString(),
          }).eq('id', serviceRequestId)

          const start = new Date(payload?.startTime)
          const formatted = start.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

          await supabase.from('messages').insert({
            service_request_id: serviceRequestId,
            channel: 'system',
            direction: 'outbound',
            body: `📅 Pintura agendada para **${formatted}**. O pintor recebeu a confirmação. Você será notificado quando o serviço iniciar.`,
            metadata: { calcom_booking_uid: uid },
          })
        }
        break
      }

      case 'BOOKING_RESCHEDULED': {
        await supabase.from('service_appointments').update({
          scheduled_start: payload?.startTime,
          scheduled_end: payload?.endTime,
          status: 'rescheduled',
          updated_at: new Date().toISOString(),
        }).eq('calcom_booking_uid', uid)
        break
      }

      case 'BOOKING_CANCELLED': {
        await supabase.from('service_appointments').update({
          status: 'cancelled',
          cancellation_reason: payload?.cancellationReason || null,
          updated_at: new Date().toISOString(),
        }).eq('calcom_booking_uid', uid)

        if (serviceRequestId) {
          await supabase.from('service_requests').update({
            status: 'payment_held',
            updated_at: new Date().toISOString(),
          }).eq('id', serviceRequestId)
        }
        break
      }
    }

    return new Response('OK', { headers: cors })
  } catch (err) {
    console.error('Cal.com webhook error:', err)
    return new Response('Error', { status: 500, headers: cors })
  }
})
