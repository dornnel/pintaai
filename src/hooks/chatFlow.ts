// Motor de jornada do agente Koke — tipos e funções puras.
// A configuração dos passos vem da tabela `agent_flow_steps` (Supabase),
// carregada e cacheada pelo hook `useChat`.

export interface FlowStep {
  id: string
  step_key: string
  branch: 'client' | 'painter'
  order_index: number
  active: boolean
  editable: boolean
  question_template: string
  step_type: 'text' | 'quick_reply' | 'media'
  quick_replies: string[] | null
  field_key: string
  validation_type: 'none' | 'name' | 'email' | 'phone' | 'area_m2' | 'min3'
  skippable: boolean
  use_ai_transition: boolean
  is_core_field: boolean
}

export interface CollectedData {
  name?: string
  email?: string
  whatsapp?: string
  role?: 'client' | 'painter'
  neighborhood?: string
  property_type?: string
  service_type?: string
  area_m2?: number
  num_rooms?: number
  final_notes?: string
  notes_media_urls?: string[]
  wall_condition?: string
  deadline?: string
  material?: string
  preferred_professional?: string
  estimated_budget?: string
  current_color?: string
  confirmed?: string
  painter_neighborhoods?: string
  painter_specialties?: string
  painter_experience?: string
  media_urls?: string[]
  custom_fields?: Record<string, string>
  _partialProtocol?: string
}

// Resultado do motor de orçamento (calculatePaintingBudget), retornado pela edge function save-lead
export interface BudgetCalc {
  estimated_min: number
  estimated_max: number
  confidence_label: 'baixa' | 'média' | 'alta'
  explanation: string
}

// ─── Mapa de chips da home → service_type pré-preenchido ─────────────────────
export const CHIP_TO_SERVICE: Record<string, string> = {
  'pintar sala e quartos': 'Pintura interna',
  'sala e quartos': 'Pintura interna',
  'fachada externa': 'Fachada externa',
  'fachada': 'Fachada externa',
  'pintura pós-obra': 'Pós-obra',
  'pós-obra': 'Pós-obra',
  'pos-obra': 'Pós-obra',
  'mural artístico': 'Arte / mural',
  'mural': 'Arte / mural',
  'parede com mofo': 'Pintura interna',
  'enviar fotos': 'Pintura interna',
}

// Bairros conhecidos para fuzzy match em texto livre
export const KNOWN_NEIGHBORHOODS = ['Campeche', 'Rio Tavares', 'Armação', 'Morro das Pedras', 'Pântano do Sul', 'Costeira', 'Ribeirão da Ilha', 'Tapera']

// Valores que indicam "pular" em campos skippable (texto livre)
export const SKIP_VALUES = new Set(['pular', 'pular por agora', 'não sei estimar', 'nao sei estimar', 'não sei', 'nao sei'])

// ─── Validação de nome ────────────────────────────────────────────────────────
const NAME_NOISE_SINGLE = /^(oi|ola|olá|ok|sim|nao|não|hey|hi|opa|bom|dia|boa|tarde|noite|tudo|bem|obrigado|obrigada|tchau|vai|vamos|pode|claro|certo|isso|exato|quero|preciso|sou|como|que|eu|me|meu|minha|aqui|please|yes|no|hello|help|ai|ia|teste|test)$/i
const NAME_NOISE_PHRASE = /\b(voce|você|pinta|pintor|quero|preciso|tenho|sou|como|que|nao|não|eu|me|meu|minha)\b/i

export function validateName(v: string): { ok: boolean; hint?: string } {
  const t = v.trim()
  if (t.length < 2) return { ok: false, hint: 'Pode me dizer seu nome completo?' }
  if (/^\d+$/.test(t)) return { ok: false, hint: 'Isso parece um número, não um nome. Como você se chama?' }
  if (/[?!@#$%^&*()+=<>{}[\]/\\]/.test(t)) return { ok: false, hint: 'Hmm, isso não parece um nome. Como você se chama?' }
  const words = t.split(/\s+/)
  if (words.length === 1 && NAME_NOISE_SINGLE.test(t)) {
    return { ok: false, hint: `"${t}" parece uma saudação, não um nome. Como você se chama de verdade? 😊` }
  }
  if (words.length > 4) return { ok: false, hint: 'Por favor, informe só o seu nome.' }
  if (NAME_NOISE_PHRASE.test(t) && words.length > 2) {
    return { ok: false, hint: 'Parece que você digitou uma frase. Qual é o seu nome? 😊' }
  }
  return { ok: true }
}

// ─── Validadores por validation_type ─────────────────────────────────────────
export const VALIDATORS: Record<FlowStep['validation_type'], (v: string) => { ok: boolean; hint?: string }> = {
  none: () => ({ ok: true }),
  name: validateName,
  email: (v) => ({
    ok: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
    hint: 'Hmm, esse não parece um e-mail válido. Ex: joao@gmail.com',
  }),
  phone: (v) => ({
    ok: v.replace(/\D/g, '').length >= 10,
    hint: 'Informe um número com DDD. Ex: 48 9 9999-9999',
  }),
  area_m2: (v) => {
    const t = v.trim().toLowerCase()
    if (t.includes('não sei') || t.includes('nao sei') || t === 'pular') return { ok: true }
    const n = Number(t.replace(',', '.').replace(/[^\d.]/g, ''))
    if (!n || n < 1 || n > 2000) return { ok: false, hint: 'Pode me dar um número aproximado em m²? Ex: 45 (entre 1 e 2000)' }
    return { ok: true }
  },
  min3: (v) => ({ ok: v.trim().length >= 3, hint: 'Pode me dar um pouco mais de detalhe?' }),
}

// Validation_types cujo texto livre pode ser extraído via LLM antes de rejeitar
export const EXTRACTABLE_VALIDATIONS = new Set<FlowStep['validation_type']>(['name', 'email', 'phone'])

// ─── Acesso a steps ───────────────────────────────────────────────────────────
export function branchSteps(steps: FlowStep[], branch: 'client' | 'painter'): FlowStep[] {
  return steps.filter(s => s.branch === branch).sort((a, b) => a.order_index - b.order_index)
}

export function getStep(steps: FlowStep[], stepKey: string): FlowStep | undefined {
  return steps.find(s => s.step_key === stepKey)
}

// ─── Leitura/escrita de campos (core ou custom) ──────────────────────────────
export function getFieldValue(step: FlowStep, data: CollectedData): unknown {
  if (step.is_core_field) {
    return (data as unknown as Record<string, unknown>)[step.field_key]
  }
  return data.custom_fields?.[step.field_key]
}

export function setFieldValue(data: CollectedData, step: FlowStep, value: unknown): CollectedData {
  if (step.is_core_field) {
    return { ...data, [step.field_key]: value } as CollectedData
  }
  const custom_fields = { ...(data.custom_fields || {}) }
  if (value === undefined || value === null || value === '') {
    delete custom_fields[step.field_key]
  } else {
    custom_fields[step.field_key] = String(value)
  }
  return { ...data, custom_fields }
}

// ─── Interpolação de {{campo}} em templates ──────────────────────────────────
export function interpolate(template: string, data: CollectedData, userName?: string): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (key === 'name') return data.name || userName || ''
    const value = (data as unknown as Record<string, unknown>)[key] ?? data.custom_fields?.[key]
    return value !== undefined && value !== null ? String(value) : ''
  })
}

// ─── Resumo dinâmico da confirmação ──────────────────────────────────────────
export const FIELD_LABELS: Record<string, string> = {
  name: '👤 Nome',
  email: '📧 Email',
  whatsapp: '📱 WhatsApp',
  neighborhood: '📍 Bairro',
  property_type: '🏠 Imóvel',
  service_type: '🎨 Serviço',
  area_m2: '📐 Metragem',
  wall_condition: '🧱 Paredes',
  deadline: '⏱ Prazo',
  material: '🪣 Material',
  preferred_professional: '🤝 Profissional preferido',
  estimated_budget: '💰 Orçamento esperado',
  current_color: '🎨 Cor atual',
  final_notes: '📝 Observações',
}

export function prettifyFieldKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function buildSummary(steps: FlowStep[], data: CollectedData): string {
  const lines: string[] = []
  for (const step of branchSteps(steps, 'client')) {
    if (step.field_key === 'role' || step.field_key === 'confirmed') continue
    const value = getFieldValue(step, data)
    if (value === undefined || value === null || value === '') continue

    if (step.field_key === 'media_urls') {
      const n = (value as string[]).length
      if (n > 0) lines.push(`📎 Mídias: ${n} arquivo(s)`)
      continue
    }

    const label = FIELD_LABELS[step.field_key] || `📌 ${prettifyFieldKey(step.field_key)}`
    const displayValue = step.field_key === 'area_m2' ? `${value} m²` : String(value)
    lines.push(`${label}: ${displayValue}`)
  }
  if (data.notes_media_urls?.length) {
    lines.push(`📎 Mídias extras: ${data.notes_media_urls.length} arquivo(s)`)
  }
  return lines.join('\n')
}

export function renderTemplate(step: FlowStep, steps: FlowStep[], data: CollectedData, userName?: string): string {
  let template = step.question_template
  if (template.includes('{{summary}}')) {
    template = template.replace('{{summary}}', buildSummary(steps, data))
  }
  return interpolate(template, data, userName)
}

// ─── Valor computado a partir da resposta crua do usuário ────────────────────
export function computeFieldValue(step: FlowStep, rawText: string): unknown {
  const normalized = rawText.trim().toLowerCase()

  if (step.skippable && (
    SKIP_VALUES.has(normalized) ||
    (step.field_key === 'area_m2' && (normalized.includes('não sei') || normalized.includes('nao sei')))
  )) {
    return undefined
  }

  if (step.field_key === 'role') {
    return rawText.toLowerCase().includes('pintor') ? 'painter' : 'client'
  }

  if (step.field_key === 'area_m2') {
    const n = Number(normalized.replace(',', '.').replace(/[^\d.]/g, ''))
    return n > 0 ? n : undefined
  }

  return rawText
}

// ─── Resolução do próximo step ───────────────────────────────────────────────
export function resolveNext(steps: FlowStep[], fromStep: FlowStep, answeredValue: string, data: CollectedData): string {
  // Regra 1: troca de branch ao responder role_select
  if (fromStep.field_key === 'role') {
    if (data.role === 'painter') {
      const first = branchSteps(steps, 'painter')[0]
      return first ? first.step_key : 'painter_done'
    }
    const first = branchSteps(steps, 'client').find(s => s.field_key !== 'role')
    return first ? first.step_key : 'generating_briefing'
  }

  // Regra 2: confirmação final do branch client
  if (fromStep.field_key === 'confirmed') {
    if (answeredValue.includes('Confirmar')) return 'generating_briefing'
    if (answeredValue.includes('Corrigir')) {
      const first = branchSteps(steps, 'client').find(s => s.field_key !== 'role')
      return first ? first.step_key : 'confirmation'
    }
    return 'confirmation' // texto livre → permanece na confirmação
  }

  // Regra 3: próximo step por order_index, dentro do mesmo branch
  const list = branchSteps(steps, fromStep.branch)
  const idx = list.findIndex(s => s.step_key === fromStep.step_key)
  const next = list[idx + 1]
  if (next) return next.step_key
  return fromStep.branch === 'painter' ? 'painter_done' : 'generating_briefing'
}

// ─── Auto-skip de steps pré-preenchidos (perfil logado / chip da home) ───────
// IMPORTANTE: só pula steps cujo field_key está em `prefilledFields` — campos
// já respondidos durante a própria conversa NÃO são pulados (necessário para
// "✏️ Corrigir algum dado" voltar a perguntar tudo normalmente).
export function autoAdvance(steps: FlowStep[], fromKey: string, data: CollectedData, prefilledFields: Set<string>): FlowStep | null {
  let step = getStep(steps, fromKey)
  let guard = 0
  while (step && guard < 30) {
    guard++
    if (step.field_key === 'confirmed') return step
    if (step.is_core_field && prefilledFields.has(step.field_key)) {
      const value = getFieldValue(step, data)
      if (value !== undefined && value !== null && value !== '') {
        const nextKey = resolveNext(steps, step, String(value), data)
        if (nextKey === 'generating_briefing' || nextKey === 'painter_done') return null
        step = getStep(steps, nextKey)
        continue
      }
    }
    return step
  }
  return step ?? null
}
