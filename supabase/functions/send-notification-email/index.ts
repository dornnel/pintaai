const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const ADMIN_EMAIL = 'andre@agenscia.com'
const FROM_EMAIL = 'Pintai <noreply@pintai.com.br>'
const APP_URL = 'https://pintai.agenscia.com'

interface EmailPayload {
  to: string
  name: string
  protocol: string
  neighborhood: string
  service_type: string
  summary: string
  calc_price_min?: number
  calc_price_max?: number
  area_m2?: number
  num_rooms?: number
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — email skipped')
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
      return false
    }
    return true
  } catch (err) {
    console.error('Email send failed:', err)
    return false
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const payload = await req.json() as EmailPayload
    const { to, name, protocol, neighborhood, service_type, summary, calc_price_min, calc_price_max, area_m2, num_rooms } = payload

    const summaryHtml = summary
      .split('\n')
      .filter(Boolean)
      .map(line => `<tr><td style="padding:4px 0;color:#555;font-size:14px">${line}</td></tr>`)
      .join('')

    // Price estimate block
    const priceHtml = (calc_price_min && calc_price_max) ? `
    <div style="margin:20px 0;background:#fff8f5;border:1px solid #fdd;border-radius:10px;padding:16px 20px">
      <p style="color:#E35A1A;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px">
        Estimativa orientativa da plataforma
      </p>
      <p style="color:#111;font-weight:800;font-size:24px;margin:0">${formatBRL(calc_price_min)} – ${formatBRL(calc_price_max)}</p>
      ${area_m2 ? `<p style="color:#888;font-size:12px;margin:4px 0 0">${area_m2} m²${num_rooms ? ` · ${num_rooms} cômodo${num_rooms > 1 ? 's' : ''}` : ''}</p>` : num_rooms ? `<p style="color:#888;font-size:12px;margin:4px 0 0">${num_rooms} cômodo${num_rooms > 1 ? 's' : ''}</p>` : ''}
      <p style="color:#aaa;font-size:11px;margin:8px 0 0">Os pintores enviarão suas próprias propostas — o valor final pode variar.</p>
    </div>` : ''

    const clientHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f9f7f5;margin:0;padding:20px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

  <div style="background:#E35A1A;padding:24px 32px">
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">🎨 Pintai Floripa</h1>
    <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:14px">O pintor certo para o seu espaço</p>
  </div>

  <div style="padding:28px 32px">
    <h2 style="color:#111;font-size:18px;margin:0 0 8px">Solicitação recebida! ✅</h2>
    <p style="color:#555;font-size:15px;margin:0 0 20px">Olá, <strong>${name}</strong>! Recebemos sua solicitação e em breve você receberá propostas de pintores qualificados próximos a ${neighborhood}.</p>

    <div style="background:#fff8f5;border:1px solid #fdd;border-radius:10px;padding:16px 20px;margin-bottom:20px">
      <p style="color:#E35A1A;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px">Protocolo</p>
      <p style="color:#111;font-weight:800;font-size:22px;margin:0;font-family:monospace">${protocol}</p>
    </div>

    <p style="color:#888;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px">Resumo do pedido</p>
    <table style="width:100%;border-collapse:collapse">
      ${summaryHtml}
    </table>

    ${priceHtml}

    <div style="margin:24px 0;padding:16px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0">
      <p style="color:#166534;font-size:14px;margin:0">⏱ Em até <strong>4 horas</strong> você receberá propostas de pintores. Fique atento ao WhatsApp!</p>
    </div>

    <a href="${APP_URL}/minha-area" style="display:block;text-align:center;margin:0 0 24px;padding:14px 20px;background:#E35A1A;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px">
      Acompanhar pedido →
    </a>

    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px">
      <p style="color:#92400e;font-size:13px;margin:0;font-weight:600">🔒 Aviso de segurança</p>
      <p style="color:#78350f;font-size:13px;margin:6px 0 0">
        Se <strong>não foi você</strong> quem fez este pedido, ignore este e-mail. Nenhum pagamento foi cobrado e nenhuma ação é necessária.
        <br><a href="${APP_URL}/cancelar?protocol=${protocol}" style="color:#E35A1A;font-weight:600">Clique aqui para cancelar esta solicitação.</a>
      </p>
    </div>
  </div>

  <div style="background:#fafafa;padding:16px 32px;text-align:center;border-top:1px solid #eee">
    <p style="color:#bbb;font-size:11px;margin:0">Pintai Floripa · pintai.agenscia.com · Florianópolis, SC</p>
  </div>
</div>
</body>
</html>`

    const adminHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f5f5f5;padding:20px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7eb">
  <h2 style="color:#111;margin:0 0 4px">🎨 Nova solicitação — ${protocol}</h2>
  <p style="color:#666;margin:0 0 20px;font-size:13px">${service_type} em ${neighborhood}</p>

  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr><td style="padding:4px 0;color:#888;width:120px">Cliente</td><td style="color:#111;font-weight:600">${name}</td></tr>
    <tr><td style="padding:4px 0;color:#888">Email</td><td style="color:#111">${to}</td></tr>
    <tr><td style="padding:4px 0;color:#888">Protocolo</td><td><span style="font-family:monospace;background:#fff3ed;color:#E35A1A;padding:2px 8px;border-radius:4px;font-weight:700">${protocol}</span></td></tr>
    ${calc_price_min && calc_price_max ? `<tr><td style="padding:4px 0;color:#888">Estimativa IA</td><td style="color:#111;font-weight:600">${formatBRL(calc_price_min)} – ${formatBRL(calc_price_max)}</td></tr>` : ''}
  </table>

  <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
  <pre style="background:#f9f9f9;padding:12px;border-radius:8px;font-size:13px;color:#444;white-space:pre-wrap">${summary}</pre>

  <a href="${APP_URL}/admin/leads" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#E35A1A;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
    Ver no Admin →
  </a>
</div>
</body>
</html>`

    const [clientResult, adminResult] = await Promise.allSettled([
      sendEmail(to, `Solicitação recebida — ${protocol} | Pintai Floripa`, clientHtml),
      sendEmail(ADMIN_EMAIL, `[Pintai] Nova solicitação ${protocol} — ${name}`, adminHtml),
    ])

    console.log('Email results:', { client: clientResult.status, admin: adminResult.status })

    return new Response(
      JSON.stringify({ ok: true, client: clientResult.status, admin: adminResult.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('send-notification-email error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
