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

// Campos coletados pela cauda determinística já existente (identidade, contato,
// confirmação). O motor conversacional novo NUNCA pergunta por eles — quem
// pergunta é o fluxo de auth/cadastro já testado.
export const TAIL_FIELDS = new Set(['name', 'email', 'whatsapp', 'confirmed'])

export function isFilled(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}

export function isCasa(propertyType: unknown): boolean {
  const v = String(propertyType ?? '').toLowerCase()
  return v.includes('casa') || v.includes('resid')
}

export function isApartamento(propertyType: unknown): boolean {
  const v = String(propertyType ?? '').toLowerCase()
  return v.includes('apart') || v.includes('apto')
}

export function scopeHasExterior(scope: unknown): boolean {
  return /extern|ambas/i.test(String(scope ?? ''))
}

// condition_value pode ser uma lista separada por vírgula, cada item podendo
// começar com "!" (negação). Todos os itens precisam ser satisfeitos (AND).
// Espelha exatamente a semântica usada nas migrations (ex.: "!Apartamento,!Casa").
export function conditionMet(step: FlowStepRow, data: CollectedData): boolean {
  if (!step.condition_key) return true
  const actual = String(data[step.condition_key] ?? '').toLowerCase()
  const clauses = (step.condition_value || '').split(',').map(s => s.trim()).filter(Boolean)
  if (clauses.length === 0) return true
  return clauses.every(clause => {
    if (clause.startsWith('!')) return actual !== clause.slice(1).toLowerCase()
    return actual === clause.toLowerCase()
  })
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
// configurada no admin, mais os dois steps sintéticos de escopo/visita técnica
// que dependem de property_type/property_scope já coletados.
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

  if (isFilled(data.property_type) && isCasa(data.property_type)) {
    items.push({
      field: 'property_scope',
      label: 'Área da pintura: interna, externa ou ambas',
      required: true,
      filled: isFilled(data.property_scope),
      value: data.property_scope,
      options: ['Apenas interna', 'Apenas externa', 'Ambas (interna + externa)'],
    })
  }

  const needsVisitQuestion = isFilled(data.property_type)
    && (!isApartamento(data.property_type) || scopeHasExterior(data.property_scope))
  if (needsVisitQuestion) {
    items.push({
      field: 'site_visit_preference',
      label: 'Prefere visita técnica ou orçamento a distância',
      required: true,
      filled: isFilled(data.site_visit_preference),
      value: data.site_visit_preference,
      options: ['Visita técnica agendada', 'Orçamento a distância'],
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
