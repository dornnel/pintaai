import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const FROM_NAME = 'Pinte Rápido Floripa'
const FROM_EMAIL = 'noreply@agenscia.com'
const APP_URL = 'https://pintai.agenscia.com'
const FALLBACK_ADMIN_EMAIL = 'andre@agenscia.com'

interface Payload {
  client_email: string
  client_name: string
  painter_name: string
  protocol: string
  service_type: string
  neighborhood: string
  total_price: number
  includes_material: boolean
  duration_days: number
  payment_terms: string
  notes: string
  lead_id: string
  is_update?: boolean
  previous_price?: number | null
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

async function sendEmail(to: string, toName: string, subject: string, html: string): Promise<boolean> {
  if (!BREVO_API_KEY) { console.warn('No BREVO_API_KEY'); return false }
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: to, name: toName }],
        subject,
        htmlContent: html,
      }),
    })
    if (res.ok) return true
    console.error('Brevo error:', await res.text())
  } catch (err) { console.error('Brevo send failed:', err) }
  return false
}

async function getAdminEmails(sb: ReturnType<typeof createClient>): Promise<string[]> {
  try {
    const { data: setting } = await sb.from('platform_settings').select('value').eq('key', 'admin_notification_emails').maybeSingle()
    if (setting?.value) {
      const raw = typeof setting.value === 'string' ? setting.value.replace(/^"|"$/g, '') : String(setting.value)
      const emails = raw.split(',').map((e: string) => e.trim()).filter((e: string) => e.includes('@'))
      if (emails.length > 0) return emails
    }
    const { data: admins } = await sb.from('users').select('email').eq('role', 'admin')
    if (admins?.length) return admins.map((a: { email: string }) => a.email).filter(Boolean)
  } catch (err) { console.error('getAdminEmails error:', err) }
  return [FALLBACK_ADMIN_EMAIL]
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const p = await req.json() as Payload
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { db: { schema: 'pintae' } })

    const isUpdate = !!p.is_update
    const clientTitle = isUpdate ? 'Proposta atualizada! 🔄' : 'Você recebeu uma proposta! 🎉'
    const clientDesc = isUpdate
      ? `O pintor <strong>${p.painter_name}</strong> atualizou a proposta para sua solicitação.`
      : `O pintor <strong>${p.painter_name}</strong> enviou uma proposta para sua solicitação.`
    const priceChangeHtml = (isUpdate && p.previous_price != null && p.previous_price !== p.total_price)
      ? `<div style="margin-bottom:12px;padding:10px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px">
           <p style="color:#92400e;font-size:13px;margin:0"><strong>Valor anterior:</strong> <span style="text-decoration:line-through">${formatBRL(p.previous_price)}</span> → <strong>${formatBRL(p.total_price)}</strong></p>
         </div>`
      : ''

    // ── Email to CLIENT ──
    const clientHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f9f7f5;margin:0;padding:20px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <div style="background:${isUpdate ? '#2563eb' : '#E35A1A'};padding:24px 32px">
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">🎨 Pinte Rápido Floripa</h1>
    <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:14px">O pintor certo para o seu espaço</p>
  </div>
  <div style="padding:28px 32px">
    <h2 style="color:#111;font-size:18px;margin:0 0 8px">${clientTitle}</h2>
    <p style="color:#555;font-size:15px;margin:0 0 20px">
      Olá, <strong>${p.client_name}</strong>! ${clientDesc}
    </p>
    ${priceChangeHtml}

    <div style="background:#fff8f5;border:1px solid #fdd;border-radius:10px;padding:16px 20px;margin-bottom:16px">
      <p style="color:#E35A1A;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px">Protocolo</p>
      <p style="color:#111;font-weight:800;font-size:20px;margin:0;font-family:monospace">${p.protocol}</p>
    </div>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;margin-bottom:16px">
      <p style="color:#166534;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px">Proposta do pintor</p>
      <p style="color:#111;font-weight:800;font-size:28px;margin:0">${formatBRL(p.total_price)}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:14px">
        <tr><td style="padding:3px 0;color:#555">Pintor</td><td style="color:#111;font-weight:600;text-align:right">${p.painter_name}</td></tr>
        <tr><td style="padding:3px 0;color:#555">Material incluso</td><td style="color:#111;text-align:right">${p.includes_material ? 'Sim' : 'Não'}</td></tr>
        <tr><td style="padding:3px 0;color:#555">Prazo de execução</td><td style="color:#111;text-align:right">${p.duration_days} dias</td></tr>
        ${p.payment_terms ? `<tr><td style="padding:3px 0;color:#555">Pagamento</td><td style="color:#111;text-align:right">${p.payment_terms}</td></tr>` : ''}
      </table>
      ${p.notes ? `<p style="color:#444;font-size:13px;margin:12px 0 0;border-top:1px solid #d1fae5;padding-top:10px"><strong>Obs:</strong> ${p.notes}</p>` : ''}
    </div>

    <a href="${APP_URL}/minha-area/pedidos" style="display:block;text-align:center;margin:0 0 12px;padding:14px 20px;background:#E35A1A;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px">
      Ver proposta e responder →
    </a>

    <p style="text-align:center;color:#888;font-size:13px;margin:0 0 4px">
      Você pode aceitar, recusar ou negociar diretamente pela plataforma.
    </p>
  </div>
  <div style="background:#fafafa;padding:16px 32px;text-align:center;border-top:1px solid #eee">
    <p style="color:#bbb;font-size:11px;margin:0">Pintai Floripa · pintai.agenscia.com · Florianópolis, SC</p>
  </div>
</div>
</body>
</html>`

    // ── Email to ADMIN(s) ──
    const adminHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f5f5f5;padding:20px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7eb">
  <div style="background:#f0f0f0;border-radius:6px;padding:8px 12px;margin-bottom:16px;display:inline-block">
    <span style="color:#666;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">⚙️ Cópia interna — Admin</span>
  </div>
  <h2 style="color:#111;margin:0 0 4px">${isUpdate ? 'Proposta atualizada' : 'Proposta enviada'} — ${p.protocol}</h2>
  <p style="color:#666;margin:0 0 20px;font-size:13px">${p.painter_name} ${isUpdate ? 'atualizou' : 'enviou'} proposta de ${formatBRL(p.total_price)}${isUpdate && p.previous_price != null ? ` (anterior: ${formatBRL(p.previous_price)})` : ''}</p>

  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr><td style="padding:4px 0;color:#888;width:120px">Cliente</td><td style="color:#111;font-weight:600">${p.client_name}</td></tr>
    <tr><td style="padding:4px 0;color:#888">Pintor</td><td style="color:#111;font-weight:600">${p.painter_name}</td></tr>
    <tr><td style="padding:4px 0;color:#888">Serviço</td><td style="color:#111">${p.service_type} · ${p.neighborhood}</td></tr>
    <tr><td style="padding:4px 0;color:#888">Valor</td><td style="color:#111;font-weight:700">${formatBRL(p.total_price)}</td></tr>
    <tr><td style="padding:4px 0;color:#888">Material</td><td>${p.includes_material ? 'Incluso' : 'Não incluso'}</td></tr>
    <tr><td style="padding:4px 0;color:#888">Prazo</td><td>${p.duration_days} dias</td></tr>
  </table>

  <a href="${APP_URL}/admin/leads" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#E35A1A;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
    Ver no Admin →
  </a>
</div>
</body>
</html>`

    // ── Create in-platform notification for admin(s) ──
    const notifTitle = isUpdate
      ? `${p.painter_name} atualizou proposta`
      : `${p.painter_name} enviou proposta`
    const notifBody = isUpdate && p.previous_price != null
      ? `${formatBRL(p.previous_price)} → ${formatBRL(p.total_price)} · ${p.service_type} · ${p.protocol}`
      : `${formatBRL(p.total_price)} · ${p.service_type} · ${p.protocol}`

    const { data: adminUsers } = await sb.from('users').select('id, email').eq('role', 'admin')
    if (adminUsers?.length) {
      await sb.from('notifications').insert(
        adminUsers.map((a: { id: string }) => ({
          user_id: a.id,
          type: isUpdate ? 'proposal_updated' : 'proposal_sent',
          title: notifTitle,
          body: notifBody,
          link: `/admin/leads`,
          metadata: { protocol: p.protocol, painter_name: p.painter_name, total_price: p.total_price, is_update: isUpdate },
        }))
      )
    }

    // ── Create notification for client ──
    const { data: clientUser } = await sb.from('users').select('id').eq('email', p.client_email).maybeSingle()
    if (clientUser) {
      await sb.from('notifications').insert({
        user_id: clientUser.id,
        type: isUpdate ? 'proposal_updated' : 'proposal_received',
        title: isUpdate ? `Proposta atualizada por ${p.painter_name}` : `Nova proposta de ${p.painter_name}`,
        body: isUpdate && p.previous_price != null
          ? `${formatBRL(p.previous_price)} → ${formatBRL(p.total_price)} para ${p.service_type}`
          : `${formatBRL(p.total_price)} para ${p.service_type}`,
        link: `/minha-area/pedidos`,
        metadata: { protocol: p.protocol, painter_name: p.painter_name, total_price: p.total_price, is_update: isUpdate },
      })
    }

    // ── Send emails ──
    const clientSubject = isUpdate
      ? `Proposta atualizada — ${p.protocol} | Pinte Rápido Floripa`
      : `Nova proposta recebida — ${p.protocol} | Pinte Rápido Floripa`
    const adminSubject = isUpdate
      ? `⚙️ [ADMIN] Proposta atualizada ${p.protocol} — ${p.painter_name} · ${formatBRL(p.total_price)}`
      : `⚙️ [ADMIN] Proposta enviada ${p.protocol} — ${p.painter_name} · ${formatBRL(p.total_price)}`

    const adminEmails = await getAdminEmails(sb)
    const results = await Promise.allSettled([
      sendEmail(p.client_email, p.client_name, clientSubject, clientHtml),
      ...adminEmails.map(addr => sendEmail(addr, 'Admin Pinte Rápido', adminSubject, adminHtml)),
    ])

    return new Response(
      JSON.stringify({
        ok: true,
        client: results[0].status,
        admin: results.slice(1).map((r, i) => ({ email: adminEmails[i], status: r.status })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('notify-proposal error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
