import { createClient } from 'npm:@supabase/supabase-js@2'
import { calculatePaintingBudget, buildBudgetInput } from '../_shared/budgetEngine.ts'
import { findNearbyPainters } from '../_shared/geo.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { db: { schema: 'pintae' } },
)

interface CollectedData {
  name?: string
  email?: string
  whatsapp?: string
  neighborhood?: string
  property_type?: string
  service_type?: string
  area_m2?: number
  num_rooms?: number
  wall_condition?: string
  deadline?: string
  material?: string
  preferred_professional?: string
  estimated_budget?: string
  current_color?: string
  final_notes?: string
  media_urls?: string[]
  notes_media_urls?: string[]
  tracking_data?: Record<string, unknown>
}

interface RequestBody {
  protocol?: string
  partial: boolean
  role: 'client' | 'painter'
  data: CollectedData
  step?: string
  custom_fields?: Record<string, string>
}

function generateProtocol(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randPart = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `PT-${datePart}-${randPart}`
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const body = (await req.json()) as RequestBody
    const { partial, role, data, step, custom_fields } = body
    const protocol = body.protocol || generateProtocol()

    if (role === 'painter') {
      // Cadastro de pintor pelo chat não grava em `leads` — sem alteração aqui.
      return new Response(JSON.stringify({ protocol }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (partial) {
      const { error } = await supabase.from('leads').upsert({
        name: data.name || 'Não informado',
        email: data.email,
        phone: data.whatsapp,
        source: 'chat',
        source_detail: 'web_chat',
        stage: 'new',
        protocol,
        service_interest: data.service_type,
        neighborhood: data.neighborhood,
        tags: ['web_chat', 'partial'],
        notes: JSON.stringify({ partial: true, step: step || null }),
        is_partial: true,
        abandoned_step: step || null,
        custom_fields: custom_fields || {},
        stage_updated_at: new Date().toISOString(),
      }, { onConflict: 'protocol' })

      if (error) console.error('save-lead partial error:', JSON.stringify(error))

      return new Response(JSON.stringify({ protocol, error: error?.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Final save — calcula estimativa real (se area_m2 ou num_rooms informado)
    let calc = null
    if ((data.area_m2 && data.area_m2 > 0) || (data.num_rooms && data.num_rooms > 0)) {
      const [{ data: pricing }, { data: complexity }] = await Promise.all([
        supabase.from('budget_pricing_rules').select('*').eq('active', true),
        supabase.from('budget_complexity_rules').select('*').eq('active', true),
      ])
      calc = calculatePaintingBudget(buildBudgetInput(data), pricing || [], complexity || [])
    }

    const { data: leadRow, error } = await supabase.from('leads').upsert({
      name: data.name || 'Não informado',
      phone: data.whatsapp,
      email: data.email,
      source: 'chat',
      source_detail: 'web_chat',
      service_interest: data.service_type,
      neighborhood: data.neighborhood,
      stage: 'new',
      stage_updated_at: new Date().toISOString(),
      protocol,
      // Campos estruturados
      property_type: data.property_type,
      wall_condition: data.wall_condition,
      deadline: data.deadline,
      material: data.material,
      area_m2: data.area_m2 ?? null,
      num_rooms: data.num_rooms ?? null,
      preferred_professional: data.preferred_professional && data.preferred_professional !== 'Pular' ? data.preferred_professional : null,
      estimated_budget: data.estimated_budget || null,
      current_color: data.current_color && data.current_color !== 'Pular' ? data.current_color : null,
      calc_price_min: calc?.estimated_min ?? null,
      calc_price_max: calc?.estimated_max ?? null,
      calc_confidence: calc?.confidence_label ?? null,
      calc_explanation: calc?.explanation ?? null,
      media_urls: data.media_urls || [],
      final_notes: data.final_notes || null,
      notes_media_urls: data.notes_media_urls || [],
      tags: ['web_chat', data.service_type, data.neighborhood].filter(Boolean) as string[],
      tracking_data: data.tracking_data || {},
      is_partial: false,
      abandoned_step: null,
      custom_fields: custom_fields || {},
      notes: JSON.stringify({
        property_type: data.property_type,
        wall_condition: data.wall_condition,
        deadline: data.deadline,
        material: data.material,
        media_count: data.media_urls?.length || 0,
      }),
    }, { onConflict: 'protocol' }).select('id').single()

    if (error) {
      console.error('save-lead final error:', JSON.stringify(error))
      return new Response(JSON.stringify({ protocol, error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Auto-distribuição por geolocalização (se habilitada pelo superadmin)
    try {
      await maybeAutoAssign(leadRow.id, protocol, data, calc)
    } catch (err) {
      console.error('save-lead auto-assign error:', err)
    }

    return new Response(JSON.stringify({ protocol, calc }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('save-lead error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function maybeAutoAssign(
  leadId: string,
  protocol: string,
  data: CollectedData,
  calc: ReturnType<typeof calculatePaintingBudget> | null,
): Promise<void> {
  const { data: settings } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', ['auto_assign_painters_geo', 'auto_assign_radius_km_default'])

  const enabled = settings?.find(s => s.key === 'auto_assign_painters_geo')?.value === true
  if (!enabled) return

  const defaultRadius = Number(settings?.find(s => s.key === 'auto_assign_radius_km_default')?.value) || 10

  const [{ data: painters }, { data: neighborhoods }] = await Promise.all([
    supabase.from('painters').select('id, neighborhoods_ids, service_radius_km, availability_status'),
    supabase.from('neighborhoods').select('id, name, latitude, longitude'),
  ])

  const nearby = findNearbyPainters(data.neighborhood, painters || [], neighborhoods || [], defaultRadius)
  if (nearby.length === 0) return

  const painterIds = nearby.map(p => p.id)
  const priceEstimate = calc
    ? `R$ ${calc.estimated_min.toLocaleString('pt-BR')} – R$ ${calc.estimated_max.toLocaleString('pt-BR')}`
    : 'A calcular'

  const messageBody =
    `🎨 Nova oportunidade — ${protocol}\n\n` +
    `📍 ${data.neighborhood} · ${data.property_type || ''}\n` +
    `🛠 ${data.service_type}\n` +
    (data.wall_condition ? `🧱 Paredes: ${data.wall_condition}\n` : '') +
    (data.deadline ? `⏱ Prazo: ${data.deadline}\n` : '') +
    (data.material ? `🪣 Material: ${data.material}\n` : '') +
    `💰 Estimativa: ${priceEstimate}\n` +
    (data.final_notes ? `💬 Obs: ${data.final_notes}\n` : '') +
    `\nAcesse o Portal do Pintor para ver detalhes e enviar proposta.`

  await Promise.all(painterIds.map(painterId =>
    supabase.from('messages').insert({
      channel: 'admin', direction: 'outbound', body: messageBody,
      metadata: { lead_id: leadId, painter_id: painterId, action: 'lead_sent_to_painter', protocol, auto_assigned: true },
    })
  ))

  await Promise.all(painterIds.map(painterId =>
    supabase.from('lead_painter_interactions').upsert({
      lead_id: leadId, painter_id: painterId, status: 'notified', notified_at: new Date().toISOString(),
    }, { onConflict: 'lead_id,painter_id' })
  ))

  await supabase.from('leads').update({
    stage: 'proposal_sent',
    stage_updated_at: new Date().toISOString(),
    sent_to_painters_at: new Date().toISOString(),
    painter_ids_notified: painterIds,
  }).eq('id', leadId)
}
