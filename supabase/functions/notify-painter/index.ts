import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { db: { schema: 'pintae' } },
)

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') || ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const FROM_NAME = 'Pintai Floripa'
const FROM_EMAIL = 'noreply@agenscia.com'
const APP_URL = 'https://pintai.agenscia.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendEmail(to: string, toName: string, subject: string, html: string): Promise<boolean> {
  if (BREVO_API_KEY) {
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
    } catch (e) { console.error('Brevo failed:', e) }
  }
  if (RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to, subject, html }),
      })
      if (res.ok) return true
      console.error('Resend error:', await res.text())
    } catch (e) { console.error('Resend failed:', e) }
  }
  console.warn('No email provider configured')
  return false
}

function buildPainterEmail(params: {
  painterName: string
  protocol: string
  neighborhood: string
  serviceType: string
  briefingLines: string[]
  priceEstimate: string
  painterId: string
}): string {
  const { painterName, protocol, neighborhood, serviceType, briefingLines, priceEstimate, painterId } = params
  const firstName = painterName.split(' ')[0]
  const portalUrl = `${APP_URL}/portal/pintor/solicitacoes`
  const registerUrl = `${APP_URL}/seja-pintor`

  const briefingHtml = briefingLines
    .map(l => `<tr><td style="padding:4px 0;color:#555;font-size:14px">${l}</td></tr>`)
    .join('')

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f9f7f5;margin:0;padding:20px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

  <div style="background:#E35A1A;padding:24px 32px">
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">🎨 Pintai Floripa</h1>
    <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:14px">Nova oportunidade de trabalho</p>
  </div>

  <div style="padding:28px 32px">
    <h2 style="color:#111;font-size:18px;margin:0 0 8px">Olá, ${firstName}! 👋</h2>
    <p style="color:#555;font-size:15px;margin:0 0 20px">
      Há uma nova solicitação de pintura na sua área — <strong>${neighborhood}</strong>. Acesse o portal para ver os detalhes e enviar sua proposta.
    </p>

    <div style="background:#fff8f5;border:1px solid #fdd;border-radius:10px;padding:16px 20px;margin-bottom:20px">
      <p style="color:#E35A1A;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px">Protocolo</p>
      <p style="color:#111;font-weight:800;font-size:20px;margin:0;font-family:monospace">${protocol}</p>
      <p style="color:#888;font-size:13px;margin:6px 0 0">${serviceType} · ${neighborhood}</p>
    </div>

    <p style="color:#888;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px">Briefing da solicitação</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      ${briefingHtml}
    </table>

    <div style="background:#fff8f5;border:1px solid #fdd;border-radius:10px;padding:14px 20px;margin-bottom:20px">
      <p style="color:#E35A1A;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px">Estimativa da plataforma</p>
      <p style="color:#111;font-weight:800;font-size:20px;margin:0">${priceEstimate}</p>
      <p style="color:#aaa;font-size:11px;margin:6px 0 0">Você define seu próprio preço na proposta.</p>
    </div>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin-bottom:20px">
      <p style="color:#92400e;font-size:13px;margin:0">
        🔒 <strong>Dados do cliente anonimizados</strong> — nome, telefone e e-mail só são revelados após você enviar uma proposta e o cliente aceitar o contato.
      </p>
    </div>

    <a href="${portalUrl}" style="display:block;text-align:center;margin:0 0 12px;padding:14px 20px;background:#E35A1A;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px">
      Ver solicitação e enviar proposta →
    </a>

    <p style="text-align:center;color:#888;font-size:13px;margin:0 0 24px">
      Ainda não tem conta no portal? <a href="${registerUrl}" style="color:#E35A1A;font-weight:600;text-decoration:none">Cadastre-se grátis</a> para responder a esta e outras oportunidades.
    </p>

    <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
    <p style="color:#bbb;font-size:11px;text-align:center;margin:0">
      Pintai Floripa · pintai.agenscia.com · Florianópolis, SC<br>
      Para gerenciar notificações, acesse seu perfil no portal do pintor.
    </p>
  </div>
</div>
</body>
</html>`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { painter_id, lead_id } = await req.json() as { painter_id: string; lead_id: string }

    if (!painter_id || !lead_id) {
      return new Response(JSON.stringify({ error: 'painter_id and lead_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch painter preferences + email
    const { data: painterRow } = await supabase
      .from('painters')
      .select('id, notify_by_email, user:users!painters_user_id_fkey(name, email)')
      .eq('id', painter_id)
      .single()

    if (!painterRow) {
      return new Response(JSON.stringify({ ok: false, reason: 'painter not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const painter = painterRow as unknown as {
      id: string; notify_by_email: boolean
      user: { name: string; email: string } | null
    }

    if (!painter.notify_by_email) {
      return new Response(JSON.stringify({ ok: true, skipped: 'email notifications disabled by painter' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const painterEmail = painter.user?.email
    const painterName = painter.user?.name || 'Pintor'

    if (!painterEmail) {
      return new Response(JSON.stringify({ ok: false, reason: 'painter has no email' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch lead data (anonymized — no client PII in email)
    const { data: lead } = await supabase
      .from('leads')
      .select('protocol, service_interest, neighborhood, property_type, wall_condition, deadline, material, area_m2, num_rooms, calc_price_min, calc_price_max, ai_price_min, ai_price_max, final_notes')
      .eq('id', lead_id)
      .single()

    if (!lead) {
      return new Response(JSON.stringify({ ok: false, reason: 'lead not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const l = lead as Record<string, unknown>
    const priceMin = (l.calc_price_min as number) ?? (l.ai_price_min as number) ?? 0
    const priceMax = (l.calc_price_max as number) ?? (l.ai_price_max as number) ?? 0
    const priceEstimate = priceMin > 0
      ? `R$ ${priceMin.toLocaleString('pt-BR')} – R$ ${priceMax.toLocaleString('pt-BR')}`
      : 'A calcular'

    const briefingLines: string[] = [
      l.property_type ? `🏠 Imóvel: ${l.property_type}` : '',
      l.wall_condition ? `🧱 Paredes: ${l.wall_condition}` : '',
      l.area_m2 ? `📐 Área: ${l.area_m2} m²${l.num_rooms ? ` · ${l.num_rooms} cômodo${(l.num_rooms as number) > 1 ? 's' : ''}` : ''}` : '',
      l.deadline ? `⏱ Prazo: ${l.deadline}` : '',
      l.material ? `🪣 Material: ${l.material}` : '',
      l.final_notes ? `💬 Obs: ${l.final_notes}` : '',
    ].filter(Boolean)

    const html = buildPainterEmail({
      painterName,
      protocol: l.protocol as string,
      neighborhood: (l.neighborhood as string) || '',
      serviceType: (l.service_interest as string) || 'Pintura',
      briefingLines,
      priceEstimate,
      painterId: painter_id,
    })

    const subject = `Nova oportunidade — ${l.protocol} · ${l.service_interest} em ${l.neighborhood} | Pintai Floripa`
    const sent = await sendEmail(painterEmail, painterName, subject, html)

    return new Response(
      JSON.stringify({ ok: sent, email: painterEmail }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('notify-painter error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
