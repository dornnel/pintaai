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

function normalizeForMatch(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos (residência → residencia)
    .toLowerCase()
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[️‍]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // pontuação/emoji residual vira espaço, pra separar palavras
    .replace(/\s+/g, ' ')
    .trim()
}

// Duas palavras "casam" se são idênticas, ou (quando ambas têm 4+ letras)
// compartilham os 3 primeiros caracteres — cobre flexões/erros de digitação
// em PT-BR sem exigir acerto perfeito ("Mofadas" → "Mofo", "Escritorio" sem
// acento → "Escritório").
function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length < 4 || b.length < 4) return false
  return a.slice(0, 3) === b.slice(0, 3)
}

// Decide, sem chamar LLM nenhum, se `text` é claramente a resposta a uma das
// `options` de um campo (clique de botão, ou o texto do botão digitado à
// mão, com ou sem acento/erro de digitação). Espelha o `matchesQuickReply`
// já usado no cliente (src/hooks/useChat.ts) para que um clique em botão
// NUNCA passe pela extração por IA — elimina de vez o risco de uma resposta
// óbvia como "Urgente" ou "Mofadas" ser mal-interpretada como fora de escopo.
//
// Duas camadas, nessa ordem:
// 1. Palavra idêntica em qualquer tamanho de frase (ex.: "casa" dentro de
//    "é uma casa mesmo") — seguro mesmo em texto livre longo.
// 2. Radical de 3 letras, mas só quando a resposta é curta (≤3 palavras) —
//    um texto livre longo quase sempre compartilha radical com alguma opção
//    por coincidência (ex.: "pintar" ~ "Pintura" em "quero pintar meu
//    carro", que não tem nada a ver com o campo service_type), então essa
//    camada fica restrita a respostas que já parecem clique de botão.
export function matchesOption(options: string[] | null | undefined, text: string): boolean {
  if (!options || options.length === 0) return false
  const normalizedText = normalizeForMatch(text)
  if (!normalizedText) return false
  const textWords = normalizedText.split(' ').filter(Boolean)

  for (const opt of options) {
    const normalizedOpt = normalizeForMatch(opt)
    if (!normalizedOpt) continue
    if (normalizedText === normalizedOpt) return true
    const optWords = normalizedOpt.split(' ').filter(Boolean)
    if (textWords.some(tw => optWords.includes(tw))) return true
  }

  if (textWords.length > 3) return false

  return options.some(opt => {
    const optWords = normalizeForMatch(opt).split(' ').filter(Boolean)
    return textWords.some(tw => optWords.some(ow => wordsMatch(tw, ow)))
  })
}

// Resolve um valor extraído (que pode não bater exatamente com o enum, já
// que a API da OpenAI não impõe o enum de forma estrita) pro texto canônico
// de uma das `options` conhecidas, usando o mesmo casamento fuzzy de
// matchesOption. Retorna o valor original se nada bater — nunca descarta
// informação, só tenta normalizar pro rótulo oficial quando possível.
export function canonicalizeEnumValue(options: string[] | null | undefined, value: string): string {
  if (!options || options.length === 0) return value
  const normalizedValue = normalizeForMatch(value)
  if (!normalizedValue) return value
  for (const opt of options) {
    const normalizedOpt = normalizeForMatch(opt)
    if (normalizedValue === normalizedOpt) return opt
  }
  const valueWords = normalizedValue.split(' ').filter(Boolean)
  for (const opt of options) {
    const optWords = normalizeForMatch(opt).split(' ').filter(Boolean)
    if (valueWords.some(vw => optWords.includes(vw))) return opt
  }
  // Radical de 3 letras só pra valores curtos — mesmo motivo do matchesOption:
  // um valor longo compartilha radical com alguma opção por coincidência.
  if (valueWords.length <= 3) {
    for (const opt of options) {
      const optWords = normalizeForMatch(opt).split(' ').filter(Boolean)
      if (valueWords.some(vw => optWords.some(ow => wordsMatch(vw, ow)))) return opt
    }
  }
  return value
}

// Frases fechadas de "selecionar tudo" pra um campo de múltipla escolha
// (ex.: "quais superfícies?" → "tudo"). Lista fechada e curta de propósito:
// um bug real (achado por revisão independente) mostrou o modelo aplicando
// essa lógica por conta própria a uma palavra que só ecoava uma resposta
// anterior ("Interna" preenchendo TODAS as superfícies, por lembrar
// "Pintura interna" dita antes) — resolver isso aqui, de forma 100%
// determinística, elimina esse risco por completo.
const SELECT_ALL_PHRASES = new Set([
  'tudo', 'todas', 'todos', 'geral', 'tudo isso', 'tudo junto', 'tudo mesmo',
  'todas as opcoes', 'tudo acima', 'qualquer uma', 'qualquer um',
])

export function isSelectAllPhrase(text: string): boolean {
  return SELECT_ALL_PHRASES.has(normalizeForMatch(text))
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
  multiSelect?: boolean
}

// Interpola {{campo}} contra os dados já coletados e desfaz \n escapado
// (como vem salvo no banco). Usado pra renderizar a pergunta do próximo
// campo faltante de forma determinística — o texto e as quick_replies vêm
// sempre da MESMA linha de agent_flow_steps, então nunca podem ficar fora
// de sincronia (bug relatado: pergunta sobre "tipo de imóvel" com botões de
// "superfícies").
export function interpolateQuestion(template: string, data: CollectedData): string {
  const withNewlines = template.replace(/\\n/g, '\n')
  return withNewlines.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = data[key]
    return value !== undefined && value !== null ? String(value) : ''
  })
}

// Acha a linha real de agent_flow_steps (branch client) correspondente a um
// field_key do checklist — inclui os condicionais (property_scope,
// site_visit_preference), que ficam fora de discoverySteps().
export function findStepForField(steps: FlowStepRow[], fieldKey: string): FlowStepRow | undefined {
  return steps.find(s => s.branch === 'client' && s.field_key === fieldKey)
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
      multiSelect: step.multi_select ?? false,
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
      multiSelect: step.multi_select ?? false,
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
