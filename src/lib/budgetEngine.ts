// Motor de Inteligência de Orçamento de Pintura — Pintai
// Gera estimativa INTERNA para admins e pintores. Nunca expor preço ao cliente.

export interface BudgetPricingRule {
  id: string
  service_type: string
  label: string
  min_price_m2: number
  max_price_m2: number
  active: boolean
  sort_order: number
}

export interface BudgetComplexityRule {
  id: string
  key: string
  label: string
  multiplier: number
  active: boolean
  sort_order: number
}

export interface BudgetInput {
  service_type: string          // 'residential_simple' | 'residential_massa' | etc.
  area_m2: number               // Área estimada em m²
  num_rooms?: number            // Número de cômodos (alternativa/complemento à metragem)
  conditions: string[]          // Ex: ['mold_moisture', 'cracks', 'furnished']
  includes_material: boolean    // Material incluso no serviço
  minimum_job_price?: number    // Preço mínimo configurável (padrão: 350)
}

export interface AppliedMultiplier {
  key: string
  label: string
  value: number
}

export interface BudgetResult {
  service_label: string
  base_min: number
  base_max: number
  area_m2: number
  applied_multipliers: AppliedMultiplier[]
  combined_multiplier: number
  complexity_score: number      // 0–100
  estimated_min: number
  estimated_max: number
  confidence: number            // 0.0–1.0
  confidence_label: 'baixa' | 'média' | 'alta'
  explanation: string
  warning: string
}

const DEFAULT_MINIMUM = 350

export function calculatePaintingBudget(
  input: BudgetInput,
  pricingRules: BudgetPricingRule[],
  complexityRules: BudgetComplexityRule[],
): BudgetResult {
  const minimum = input.minimum_job_price ?? DEFAULT_MINIMUM

  // Buscar faixa base pelo service_type (fallback para a primeira regra)
  const priceRule = pricingRules.find(r => r.active && r.service_type === input.service_type)
    ?? pricingRules.find(r => r.active)
    ?? { min_price_m2: 18, max_price_m2: 28, label: 'Pintura geral', service_type: input.service_type } as BudgetPricingRule

  // Multiplicador por material incluso (incremento de 15%)
  const materialMultiplier = input.includes_material ? 1.15 : 1.0

  // Filtrar multiplicadores aplicáveis
  const activeComplexity = complexityRules.filter(r => r.active)
  const applied: AppliedMultiplier[] = []
  let combinedMultiplier = materialMultiplier

  for (const rule of activeComplexity) {
    if (input.conditions.includes(rule.key) && rule.multiplier !== 1.0) {
      applied.push({ key: rule.key, label: rule.label, value: rule.multiplier })
      combinedMultiplier *= rule.multiplier
    }
  }

  // Área: usar metragem direta; se ausente, estimar por cômodos (13 m² de parede/cômodo em média)
  const AREA_PER_ROOM = 13
  const areaFromRooms = (input.num_rooms ?? 0) > 0 ? (input.num_rooms!) * AREA_PER_ROOM : 0
  const area = input.area_m2 > 0 ? input.area_m2 : areaFromRooms
  const usedRoomEstimate = input.area_m2 <= 0 && areaFromRooms > 0

  const rawMin = area * priceRule.min_price_m2 * combinedMultiplier
  const rawMax = area * priceRule.max_price_m2 * combinedMultiplier

  const estimatedMin = Math.max(minimum, Math.round(rawMin))
  const estimatedMax = Math.max(minimum, Math.round(rawMax * 1.1)) // 10% de margem superior

  // Score de complexidade 0–100
  const maxPossibleMultiplier = 1.4 * 1.5 * 1.35 * 1.15 // worst case
  const complexityScore = Math.min(
    100,
    Math.round(((combinedMultiplier - 1) / (maxPossibleMultiplier - 1)) * 100)
  )

  // Confiança baseada nos dados disponíveis
  let rawConfidence = 0.3
  if (input.area_m2 > 0) rawConfidence += 0.30   // metragem exata = boost maior
  else if (areaFromRooms > 0) rawConfidence += 0.18  // estimativa por cômodos
  if (input.num_rooms && input.num_rooms > 0 && input.area_m2 > 0) rawConfidence += 0.08  // ambos = extra boost
  if (input.conditions.length > 0) rawConfidence += 0.15
  if (input.conditions.length >= 3) rawConfidence += 0.1
  rawConfidence = Math.min(0.85, rawConfidence)

  const confidence = rawConfidence
  const confidence_label: BudgetResult['confidence_label'] =
    confidence >= 0.75 ? 'alta' : confidence >= 0.5 ? 'média' : 'baixa'

  // Explicação técnica interna
  const factorsList = applied.map(m => `${m.label} (×${m.value.toFixed(2)})`).join(', ')
  const areaDesc = usedRoomEstimate
    ? `${input.num_rooms} cômodos → ~${area}m² estimado`
    : input.num_rooms && input.num_rooms > 0
      ? `${area}m² (${input.num_rooms} cômodos)`
      : `${area}m²`
  const explanation =
    `Área: ${areaDesc} × faixa base R$${priceRule.min_price_m2}–${priceRule.max_price_m2}/m² ` +
    `(${priceRule.label}). ` +
    `Multiplicador combinado: ×${combinedMultiplier.toFixed(2)}. ` +
    (factorsList ? `Fatores: ${factorsList}. ` : '') +
    `Confiança ${confidence_label} (${Math.round(confidence * 100)}%).`

  return {
    service_label: priceRule.label,
    base_min: priceRule.min_price_m2,
    base_max: priceRule.max_price_m2,
    area_m2: area,
    applied_multipliers: applied,
    combined_multiplier: combinedMultiplier,
    complexity_score: complexityScore,
    estimated_min: estimatedMin,
    estimated_max: estimatedMax,
    confidence,
    confidence_label,
    explanation,
    warning: 'ESTIMATIVA INTERNA — não compartilhar com o cliente. Valor final precisa ser validado por pintor profissional.',
  }
}

// Calcular divergência percentual entre estimativa IA e preço do pintor
export function calculateDivergence(
  ai_min: number,
  ai_max: number,
  painter_price: number,
): number {
  const ai_mid = (ai_min + ai_max) / 2
  if (ai_mid === 0) return 0
  return Math.round(((painter_price - ai_mid) / ai_mid) * 100)
}

// Categorias de erro para registro de divergências
export const BUDGET_ERROR_CATEGORIES = [
  { key: 'area_subestimada', label: 'Área subestimada' },
  { key: 'area_superestimada', label: 'Área superestimada' },
  { key: 'mofo_nao_detectado', label: 'Mofo não detectado' },
  { key: 'trinca_nao_detectada', label: 'Trinca não detectada' },
  { key: 'moveis_nao_considerados', label: 'Móveis não considerados' },
  { key: 'urgencia_nao_considerada', label: 'Urgência não considerada' },
  { key: 'material_subestimado', label: 'Material subestimado' },
  { key: 'mao_de_obra_subestimada', label: 'Mão de obra subestimada' },
  { key: 'clima_nao_considerado', label: 'Clima não considerado' },
  { key: 'deslocamento_nao_considerado', label: 'Deslocamento não considerado' },
  { key: 'dificuldade_acesso', label: 'Dificuldade de acesso' },
  { key: 'qualidade_material', label: 'Qualidade do material' },
]
