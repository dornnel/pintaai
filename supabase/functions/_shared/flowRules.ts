// Regras de negócio da jornada do cliente, compartilhadas entre agent-chat e
// whatsapp-webhook. Puro TypeScript (sem APIs de Deno) para poder ser testado
// com vitest a partir de supabase/functions/_shared/flowRules.test.ts.
//
// Fonte da verdade: tabela agent_flow_steps (editável pelo admin em /admin/agent
// → aba Jornada). Este módulo NUNCA hardcoda quais campos são obrigatórios —
// ele lê isso de `is_core_field` + `skippable` + `condition_key/condition_value`,
// para que uma mudança no admin reflita automaticamente aqui.

export interface FlowStepRow {
  step_key: string
  branch: string
  order_index: number
  active: boolean
  enabled?: boolean | null
  question_template: string
  step_type: string
  quick_replies: string[] | null
  field_key: string
  validation_type: string
  skippable: boolean
  is_core_field: boolean
  multi_select?: boolean | null
  condition_key?: string | null
  condition_value?: string | null
}

export type CollectedData = Record<string, unknown>

// Campos resolvidos FORA do motor conversacional: role é decidido pela lógica
// determinística antes mesmo de entrar na descoberta (role_select / detecção
// de intenção de pintor), e name/email/whatsapp/confirmed pela cauda de
// auth/cadastro já existente. O motor de chat_turn nunca pergunta por eles.
export const TAIL_FIELDS = new Set(['role', 'name', 'email', 'whatsapp', 'confirmed'])

export function isFilled(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}

export function isApartamento(propertyType: unknown): boolean {
  const v = String(propertyType ?? '').toLowerCase()
  return v.includes('apart') || v.includes('apto')
}

export function scopeHasExterior(scope: unknown): boolean {
  return /extern|ambas/i.test(String(scope ?? ''))
}

// condition_value pode ser uma lista separada por vírgula, cada item podendo
// começar com "!" (negação). Cláusulas negadas são um AND de exclusões (ex.:
// "!Apartamento,!Casa" → não pode ser nenhum dos dois); cláusulas positivas
// são um OR de valores aceitos (ex.: "Casa,Prédio / Edifício" → qualquer um
// dos dois serve) — espelha o uso real em agent_flow_steps.condition_value.
export function conditionMet(step: FlowStepRow, data: CollectedData): boolean {
  if (!step.condition_key) return true
  const actual = String(data[step.condition_key] ?? '').toLowerCase()
  const clauses = (step.condition_value || '').split(',').map(s => s.trim()).filter(Boolean)
  if (clauses.length === 0) return true
  const negatives = clauses.filter(c => c.startsWith('!')).map(c => c.slice(1).toLowerCase())
  const positives = clauses.filter(c => !c.startsWith('!')).map(c => c.toLowerCase())
  if (negatives.includes(actual)) return false
  if (positives.length > 0 && !positives.includes(actual)) return false
  return true
}

export function discoverySteps(steps: FlowStepRow[]): FlowStepRow[] {
  return steps
    .filter(s => s.branch === 'client' && s.active && (s.enabled ?? true))
    .filter(s => s.is_core_field && !TAIL_FIELDS.has(s.field_key))
    .filter(s => s.step_type !== 'media')
    .filter(s => !s.condition_key) // condicionais tratados via synthetic items abaixo
    .sort((a, b) => a.order_index - b.order_index)
}

export interface ChecklistItem {
  field: string
  label: string
  required: boolean
  filled: boolean
  value?: unknown
  options?: string[] | null
}

function cleanLabel(template: string): string {
  return template
    .replace(/\{\{.*?\}\}/g, '')
    .replace(/\\n/g, ' ')
    .replace(/[*#📋🏡📅💻✅🛋️🏗️👋😊]/g, '')
    .trim()
    .slice(0, 90)
}

// Monta o checklist completo (obrigatório + opcional) a partir da jornada
// configurada no admin, mais os steps condicionais (property_scope,
// site_visit_preference) — estes ficam de fora de discoverySteps() por terem
// condition_key, então são avaliados aqui via conditionMet() contra os dados
// já coletados, exatamente como a jornada os define no admin.
export function buildChecklist(steps: FlowStepRow[], data: CollectedData): ChecklistItem[] {
  const items: ChecklistItem[] = []

  for (const step of discoverySteps(steps)) {
    const value = data[step.field_key]
    items.push({
      field: step.field_key,
      label: cleanLabel(step.question_template),
      required: !step.skippable,
      filled: isFilled(value),
      value,
      options: step.quick_replies,
    })
  }

  const conditionalSteps = steps.filter(s =>
    s.branch === 'client' && s.active && (s.enabled ?? true) && s.is_core_field && s.condition_key,
  )
  for (const step of conditionalSteps) {
    if (!isFilled(data[step.condition_key as string])) continue // condição ainda não decidível
    if (!conditionMet(step, data)) continue
    const value = data[step.field_key]
    items.push({
      field: step.field_key,
      label: cleanLabel(step.question_template),
      required: !step.skippable,
      filled: isFilled(value),
      value,
      options: step.quick_replies,
    })
  }

  // Regra extra além da jornada configurada: um apartamento cuja área a pintar
  // inclui a fachada/externa também precisa da pergunta de visita técnica,
  // mesmo que o condition_key da DB (`!Apartamento`) normalmente a exclua.
  const visitAlreadyListed = items.some(i => i.field === 'site_visit_preference')
  if (!visitAlreadyListed && isApartamento(data.property_type) && scopeHasExterior(data.property_scope)) {
    const visitStep = steps.find(s => s.field_key === 'site_visit_preference')
    items.push({
      field: 'site_visit_preference',
      label: visitStep ? cleanLabel(visitStep.question_template) : 'Prefere visita técnica ou orçamento a distância',
      required: true,
      filled: isFilled(data.site_visit_preference),
      value: data.site_visit_preference,
      options: visitStep?.quick_replies || ['Visita técnica agendada', 'Orçamento a distância'],
    })
  }

  return items
}

export function missingRequired(items: ChecklistItem[]): ChecklistItem[] {
  return items.filter(i => i.required && !i.filled)
}

export function isDiscoveryComplete(steps: FlowStepRow[], data: CollectedData): boolean {
  return missingRequired(buildChecklist(steps, data)).length === 0
}

// Rede de segurança: se o modelo souber o service_type mas não tiver perguntado
// o escopo explicitamente, deriva-o para evitar uma pergunta redundante
// ("pintura externa da minha casa" já responde a pergunta de escopo).
export function inferPropertyScope(data: CollectedData): string | undefined {
  if (isFilled(data.property_scope)) return String(data.property_scope)
  const svc = `${data.service_type ?? ''} ${data.surfaces ?? ''}`.toLowerCase()
  if (!svc.trim()) return undefined
  const external = /fachada|extern|muro|telhad/.test(svc)
  const internal = /interna|interior/.test(svc)
  if (external && internal) return 'Ambas (interna + externa)'
  if (external) return 'Apenas externa'
  if (internal) return 'Apenas interna'
  return undefined
}
