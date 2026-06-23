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
      lead_type: 'customer',
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

function scorePainter(p: {
  id: string
  last_lead_received_at: string | null
  active_leads_count: number
  pro_plan_status: string
  last_seen_at: string | null
  overall_score: number | null
}): number {
  const now = Date.now()
  const hoursSinceLastLead = p.last_lead_received_at
    ? (now - new Date(p.last_lead_received_at).getTime()) / 3600000
    : 999
  const recency = Math.min(hoursSinceLastLead / 24, 1.0) * 0.30
  const load = Math.max(0, 1 - (p.active_leads_count || 0) / 5) * 0.25
  const pro = (p.pro_plan_status === 'active' ? 1.0 : 0.0) * 0.20
  const score = ((p.overall_score || 0) / 5.0) * 0.15
  const online = (p.last_seen_at && (now - new Date(p.last_seen_at).getTime()) < 5 * 60 * 1000 ? 1.0 : 0.0) * 0.10
  return recency + load + pro + score + online
}

async function maybeAutoAssign(
  leadId: string,
  protocol: string,
  data: CollectedData,
  calc: ReturnType<typeof calculatePaintingBudget> | null,
): Promise<void> {
  const { data: settings } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', ['auto_assign_painters_geo', 'auto_assign_radius_km_default', 'max_painters_per_lead', 'pro_early_access_hours', 'distribution_mode', 'painter_response_window_hours'])

  const getSetting = (key: string) => settings?.find(s => s.key === key)?.value
  const enabled = getSetting('auto_assign_painters_geo') === true
  if (!enabled) return

  const defaultRadius = Number(getSetting('auto_assign_radius_km_default')) || 10
  const maxPainters = Number(getSetting('max_painters_per_lead')) || 3
  const proEarlyHours = Number(getSetting('pro_early_access_hours')) || 0
  const distMode = (typeof getSetting('distribution_mode') === 'string' ? getSetting('distribution_mode') : 'simultaneous') as string
  const responseWindow = Number(getSetting('painter_response_window_hours')) || 4

  const [{ data: painters }, { data: neighborhoods }, { data: scores }] = await Promise.all([
    supabase.from('painters').select('id, neighborhoods_ids, service_radius_km, availability_status, pro_plan_status, last_lead_received_at, active_leads_count, last_seen_at'),
    supabase.from('neighborhoods').select('id, name, latitude, longitude'),
    supabase.from('painter_scores').select('painter_id, overall_score'),
  ])

  const nearby = findNearbyPainters(data.neighborhood, painters || [], neighborhoods || [], defaultRadius)
  if (nearby.length === 0) return

  const scoreMap = new Map((scores || []).map((s: { painter_id: string; overall_score: number }) => [s.painter_id, s.overall_score]))

  const allRanked = nearby.map(p => {
    const full = (painters || []).find((pp: { id: string }) => pp.id === p.id) as {
      id: string; last_lead_received_at: string | null; active_leads_count: number;
      pro_plan_status: string; last_seen_at: string | null
    } | undefined
    return {
      id: p.id,
      isPro: full?.pro_plan_status === 'active',
      score: scorePainter({
        id: p.id,
        last_lead_received_at: full?.last_lead_received_at ?? null,
        active_leads_count: full?.active_leads_count ?? 0,
        pro_plan_status: full?.pro_plan_status ?? 'none',
        last_seen_at: full?.last_seen_at ?? null,
        overall_score: scoreMap.get(p.id) ?? 0,
      }),
    }
  }).sort((a, b) => b.score - a.score)

  // Pro early access: if configured, only send to Pro painters first
  let selected = allRanked
  if (proEarlyHours > 0) {
    const proOnly = allRanked.filter(p => p.isPro)
    if (proOnly.length > 0) {
      selected = proOnly
      // Mark lead for second-round distribution later
      await supabase.from('leads').update({
        pro_access_expires_at: new Date(Date.now() + proEarlyHours * 3600000).toISOString(),
        distribution_round: 1,
      }).eq('id', leadId)
      console.log(`[AutoAssign] Pro early access: ${proEarlyHours}h, ${proOnly.length} Pro painters first`)
    }
  }

  // Cascade mode: only send to #1, set response deadline
  if (distMode === 'cascade') {
    selected = selected.slice(0, 1)
  } else {
    selected = selected.slice(0, maxPainters)
  }

  const painterIds = selected.map(p => p.id)
  console.log(`[AutoAssign] ${protocol}: ${nearby.length} nearby → top ${painterIds.length} selected`, ranked.map(r => ({ id: r.id.slice(0, 8), score: r.score.toFixed(3) })))

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

  const deadline = distMode === 'cascade'
    ? new Date(Date.now() + responseWindow * 3600000).toISOString()
    : null

  await Promise.all(painterIds.map((painterId, idx) =>
    supabase.from('lead_painter_interactions').upsert({
      lead_id: leadId, painter_id: painterId, status: 'notified', notified_at: new Date().toISOString(),
      queue_position: idx + 1,
      response_deadline_at: idx === 0 ? deadline : null,
    }, { onConflict: 'lead_id,painter_id' })
  ))

  // Store full queue for cascade mode (remaining painters wait their turn)
  if (distMode === 'cascade' && allRanked.length > 1) {
    const remaining = allRanked.slice(1, maxPainters)
    await Promise.all(remaining.map((p, idx) =>
      supabase.from('lead_painter_interactions').upsert({
        lead_id: leadId, painter_id: p.id, status: 'queued',
        queue_position: idx + 2,
      }, { onConflict: 'lead_id,painter_id' })
    ))
  }

  // Update painter tracking: last_lead_received_at + increment active_leads_count
  await Promise.all(painterIds.map(painterId =>
    supabase.from('painters').update({
      last_lead_received_at: new Date().toISOString(),
      active_leads_count: ((painters || []).find((pp: { id: string }) => pp.id === painterId) as { active_leads_count?: number } | undefined)?.active_leads_count
        ? ((painters || []).find((pp: { id: string }) => pp.id === painterId) as { active_leads_count: number }).active_leads_count + 1
        : 1,
    }).eq('id', painterId)
  ))

  await supabase.from('leads').update({
    stage: 'proposal_sent',
    stage_updated_at: new Date().toISOString(),
    sent_to_painters_at: new Date().toISOString(),
    painter_ids_notified: painterIds,
  }).eq('id', leadId)

  // Notify painters via email (fire-and-forget)
  for (const painterId of painterIds) {
    supabase.functions.invoke('notify-painter', {
      body: { painter_id: painterId, lead_id: leadId },
    }).catch(err => console.error('[AutoAssign] notify error:', err))
  }
}
