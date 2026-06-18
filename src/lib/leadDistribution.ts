import { supabase } from './supabase'

export interface LeadForDistribution {
  id: string
  protocol?: string
  service_interest?: string
  neighborhood?: string
  property_type?: string
  wall_condition?: string
  deadline?: string
  material?: string
  area_m2?: number
  final_notes?: string
  ai_briefing?: string
  ai_price_min?: number
  ai_price_max?: number
  calc_price_min?: number
  calc_price_max?: number
  notes?: string
}

// Monta a mensagem enviada ao pintor — sem dados pessoais do cliente (PII)
export function buildPainterMessage(lead: LeadForDistribution): string {
  const briefing = (() => {
    if (lead.ai_briefing) return lead.ai_briefing
    try {
      const notes = JSON.parse(lead.notes || '{}')
      return `${lead.service_interest} · Paredes: ${notes.wall_condition || lead.wall_condition || '?'} · Prazo: ${notes.deadline || lead.deadline || '?'}`
    } catch {
      return `${lead.service_interest} em ${lead.neighborhood}`
    }
  })()

  const priceEstimate = (lead.calc_price_min != null || lead.calc_price_max != null)
    ? `R$ ${(lead.calc_price_min || 0).toLocaleString('pt-BR')} – R$ ${(lead.calc_price_max || 0).toLocaleString('pt-BR')}`
    : lead.ai_price_min
      ? `R$ ${lead.ai_price_min?.toLocaleString('pt-BR')} – R$ ${lead.ai_price_max?.toLocaleString('pt-BR')}`
      : 'A calcular'

  return (
    `🎨 Nova oportunidade — ${lead.protocol}\n\n` +
    `📍 ${lead.neighborhood} · ${lead.property_type || ''}\n` +
    `🛠 ${lead.service_interest}\n` +
    (lead.area_m2 ? `📐 Área: ${lead.area_m2} m²\n` : '') +
    (lead.wall_condition ? `🧱 Paredes: ${lead.wall_condition}\n` : '') +
    (lead.deadline ? `⏱ Prazo: ${lead.deadline}\n` : '') +
    (lead.material ? `🪣 Material: ${lead.material}\n` : '') +
    `💰 Estimativa: ${priceEstimate}\n\n` +
    `📝 ${briefing}\n` +
    (lead.final_notes ? `💬 Obs do cliente: ${lead.final_notes}\n` : '') +
    `\nAcesse o Portal do Pintor para ver detalhes e enviar proposta.`
  )
}

// Envia o lead (anonimizado) para os pintores selecionados, registra rastreio e atualiza o pipeline
export async function sendLeadToPainters(lead: LeadForDistribution, painterIds: string[]): Promise<void> {
  const body = buildPainterMessage(lead)

  await Promise.all(painterIds.map(painterId =>
    supabase.from('messages').insert({
      channel: 'admin', direction: 'outbound', body,
      metadata: { lead_id: lead.id, painter_id: painterId, action: 'lead_sent_to_painter', protocol: lead.protocol },
    })
  ))

  await Promise.all(painterIds.map(painterId =>
    supabase.from('lead_painter_interactions').upsert({
      lead_id: lead.id, painter_id: painterId, status: 'notified',
      notified_at: new Date().toISOString(),
    }, { onConflict: 'lead_id,painter_id' })
  ))

  await supabase.from('leads').update({
    stage: 'proposal_sent',
    stage_updated_at: new Date().toISOString(),
    sent_to_painters_at: new Date().toISOString(),
    painter_ids_notified: painterIds,
  }).eq('id', lead.id)

  // Email notification to each painter (fire-and-forget)
  await Promise.allSettled(painterIds.map(painterId =>
    supabase.functions.invoke('notify-painter', {
      body: { painter_id: painterId, lead_id: lead.id },
    })
  ))
}
