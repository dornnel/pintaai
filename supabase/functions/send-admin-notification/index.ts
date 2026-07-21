import OpenAI from 'npm:openai@4'
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { db: { schema: 'pintae' } },
)

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') || ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const FROM_NAME = 'Pinte Rápido Floripa'
const FROM_EMAIL = 'noreply@agenscia.com'

async function getAdminEmail(): Promise<string> {
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'admin_email')
    .single()
  return data?.value?.replace(/"/g, '') || 'andre@agenscia.com'
}

async function sendEmail(to: string, subject: string, html: string) {
  if (BREVO_API_KEY) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { name: FROM_NAME, email: FROM_EMAIL },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
      })
      if (res.ok) return
      console.error('Brevo error:', await res.text())
    } catch (e) { console.error('Brevo failed:', e) }
  }
  if (RESEND_API_KEY) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to, subject, html }),
    })
    return
  }
  console.warn('No email provider configured (set BREVO_API_KEY or RESEND_API_KEY)')
}

const EVENTS: Record<string, { subject: (d: Record<string, string>) => string; html: (d: Record<string, string>) => string }> = {
  new_lead: {
    subject: d => `[Pinte Rápido] 🎨 Novo lead — ${d.name} · ${d.neighborhood}`,
    html: d => `<h2>Nova solicitação recebida</h2><p><b>Cliente:</b> ${d.name}<br><b>Bairro:</b> ${d.neighborhood}<br><b>Serviço:</b> ${d.service_interest}<br><b>Protocolo:</b> ${d.protocol}</p><a href="https://pintai.agenscia.com/admin/leads">Ver no admin →</a>`,
  },
  lead_confirmed: {
    subject: d => `[Pinte Rápido] ✅ Pedido confirmado — ${d.protocol}`,
    html: d => `<h2>Pedido confirmado pelo cliente</h2><p><b>Protocolo:</b> ${d.protocol}<br><b>Cliente:</b> ${d.name}</p><a href="https://pintai.agenscia.com/admin/leads">Ver no admin →</a>`,
  },
  payment_received: {
    subject: d => `[Pinte Rápido] 💰 Pagamento recebido — R$ ${d.amount}`,
    html: d => `<h2>Pagamento confirmado pela Asaas</h2><p><b>Valor:</b> R$ ${d.amount}<br><b>Serviço:</b> ${d.service_request_id}</p><a href="https://pintai.agenscia.com/admin/payments">Ver pagamentos →</a>`,
  },
  new_painter: {
    subject: d => `[Pinte Rápido] 🖌️ Novo pintor cadastrado — ${d.name}`,
    html: d => `<h2>Novo pintor aguarda validação</h2><p><b>Nome:</b> ${d.name}<br><b>Especialidades:</b> ${d.specialties || '—'}</p><a href="https://pintai.agenscia.com/admin/painters">Revisar cadastro →</a>`,
  },
  high_severity_flag: {
    subject: d => `[Pinte Rápido] 🚨 Flag de moderação HIGH — ${d.flag_type}`,
    html: d => `<h2>Alerta de moderação</h2><p><b>Tipo:</b> ${d.flag_type}<br><b>Severidade:</b> HIGH<br><b>Mensagem:</b> ${d.message}</p><a href="https://pintai.agenscia.com/admin/moderation">Revisar →</a>`,
  },
  new_ad_pending: {
    subject: d => `[Pinte Rápido] 📢 Novo anúncio aguardando aprovação — ${d.partner}`,
    html: d => `<h2>Anúncio enviado por parceiro</h2><p><b>Parceiro:</b> ${d.partner}<br><b>Título:</b> ${d.title}</p><a href="https://pintai.agenscia.com/admin/ads">Aprovar →</a>`,
  },
  subscription_canceled: {
    subject: d => `[Pinte Rápido] ❌ Assinatura cancelada — ${d.user_name}`,
    html: d => `<h2>Assinatura cancelada</h2><p><b>Usuário:</b> ${d.user_name}<br><b>Plano:</b> ${d.plan_name}</p><a href="https://pintai.agenscia.com/admin/subscriptions">Ver assinaturas →</a>`,
  },
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { event, data } = await req.json() as { event: string; data: Record<string, string> }

    const template = EVENTS[event]
    if (!template) {
      return new Response(JSON.stringify({ error: `Unknown event: ${event}` }), { status: 400, headers: corsHeaders })
    }

    const adminEmail = await getAdminEmail()
    await sendEmail(adminEmail, template.subject(data), template.html(data))

    return new Response(JSON.stringify({ ok: true, event, sent_to: adminEmail }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('send-admin-notification error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
