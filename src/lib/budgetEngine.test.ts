import { describe, it, expect } from 'vitest'
import {
  calculatePaintingBudget,
  calculateDivergence,
  type BudgetPricingRule,
  type BudgetComplexityRule,
} from './budgetEngine'

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockPricingRules: BudgetPricingRule[] = [
  { id: '1', service_type: 'residential_simple', label: 'Pintura interna simples', min_price_m2: 18, max_price_m2: 28, active: true, sort_order: 1 },
  { id: '2', service_type: 'residential_massa', label: 'Pintura com massa', min_price_m2: 28, max_price_m2: 42, active: true, sort_order: 2 },
  { id: '3', service_type: 'external', label: 'Pintura externa', min_price_m2: 35, max_price_m2: 70, active: true, sort_order: 4 },
]

const mockComplexityRules: BudgetComplexityRule[] = [
  { id: 'c1', key: 'good_condition', label: 'Parede boa', multiplier: 1.00, active: true, sort_order: 1 },
  { id: 'c2', key: 'mold_moisture', label: 'Mofo ou umidade', multiplier: 1.35, active: true, sort_order: 4 },
  { id: 'c3', key: 'cracks', label: 'Trincas', multiplier: 1.50, active: true, sort_order: 6 },
  { id: 'c4', key: 'furnished', label: 'Casa mobiliada', multiplier: 1.15, active: true, sort_order: 7 },
  { id: 'c5', key: 'urgency', label: 'Urgência', multiplier: 1.30, active: true, sort_order: 11 },
]

// ─── calculatePaintingBudget ──────────────────────────────────────────────────

describe('calculatePaintingBudget', () => {
  it('calcula orçamento simples sem multiplicadores', () => {
    const result = calculatePaintingBudget(
      { service_type: 'residential_simple', area_m2: 20, conditions: [], includes_material: false },
      mockPricingRules,
      mockComplexityRules,
    )
    expect(result.estimated_min).toBe(Math.max(350, Math.round(20 * 18 * 1.0)))
    expect(result.estimated_max).toBeGreaterThan(result.estimated_min)
    expect(result.combined_multiplier).toBe(1.0)
    expect(result.applied_multipliers).toHaveLength(0)
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.confidence).toBeLessThanOrEqual(0.85)
  })

  it('aplica multiplicador de mofo corretamente', () => {
    const result = calculatePaintingBudget(
      { service_type: 'residential_simple', area_m2: 20, conditions: ['mold_moisture'], includes_material: false },
      mockPricingRules,
      mockComplexityRules,
    )
    expect(result.combined_multiplier).toBeCloseTo(1.35, 2)
    expect(result.applied_multipliers).toHaveLength(1)
    expect(result.applied_multipliers[0].key).toBe('mold_moisture')
    expect(result.estimated_min).toBeGreaterThan(20 * 18)
  })

  it('combina múltiplos multiplicadores (mofo + trincas)', () => {
    const result = calculatePaintingBudget(
      { service_type: 'residential_simple', area_m2: 30, conditions: ['mold_moisture', 'cracks'], includes_material: false },
      mockPricingRules,
      mockComplexityRules,
    )
    expect(result.combined_multiplier).toBeCloseTo(1.35 * 1.50, 2)
    expect(result.applied_multipliers).toHaveLength(2)
  })

  it('respeita preço mínimo do job', () => {
    const result = calculatePaintingBudget(
      { service_type: 'residential_simple', area_m2: 5, conditions: [], includes_material: false, minimum_job_price: 350 },
      mockPricingRules,
      mockComplexityRules,
    )
    expect(result.estimated_min).toBeGreaterThanOrEqual(350)
    expect(result.estimated_max).toBeGreaterThanOrEqual(350)
  })

  it('adiciona 15% quando material está incluso', () => {
    const sem = calculatePaintingBudget(
      { service_type: 'residential_simple', area_m2: 20, conditions: [], includes_material: false },
      mockPricingRules, mockComplexityRules,
    )
    const com = calculatePaintingBudget(
      { service_type: 'residential_simple', area_m2: 20, conditions: [], includes_material: true },
      mockPricingRules, mockComplexityRules,
    )
    expect(com.combined_multiplier).toBeCloseTo(1.15, 2)
    expect(com.estimated_min).toBeGreaterThan(sem.estimated_min)
  })

  it('aumenta confiança com mais condições informadas', () => {
    const baixa = calculatePaintingBudget(
      { service_type: 'residential_simple', area_m2: 0, conditions: [], includes_material: false },
      mockPricingRules, mockComplexityRules,
    )
    const alta = calculatePaintingBudget(
      { service_type: 'residential_simple', area_m2: 40, conditions: ['mold_moisture', 'cracks', 'furnished'], includes_material: false },
      mockPricingRules, mockComplexityRules,
    )
    expect(alta.confidence).toBeGreaterThan(baixa.confidence)
  })

  it('usa a primeira regra como fallback quando service_type não encontrado', () => {
    const result = calculatePaintingBudget(
      { service_type: 'tipo_inexistente', area_m2: 20, conditions: [], includes_material: false },
      mockPricingRules, mockComplexityRules,
    )
    expect(result.base_min).toBe(mockPricingRules[0].min_price_m2)
    expect(result.service_label).toBe(mockPricingRules[0].label)
  })

  it('calcula complexityScore entre 0 e 100', () => {
    const result = calculatePaintingBudget(
      { service_type: 'residential_simple', area_m2: 20, conditions: ['mold_moisture', 'cracks', 'urgency'], includes_material: false },
      mockPricingRules, mockComplexityRules,
    )
    expect(result.complexity_score).toBeGreaterThanOrEqual(0)
    expect(result.complexity_score).toBeLessThanOrEqual(100)
  })

  it('inclui warning na resposta', () => {
    const result = calculatePaintingBudget(
      { service_type: 'residential_simple', area_m2: 20, conditions: [], includes_material: false },
      mockPricingRules, mockComplexityRules,
    )
    expect(result.warning).toContain('ESTIMATIVA INTERNA')
    expect(result.warning).toContain('pintor')
  })

  it('retorna labels de confiança corretos', () => {
    const baixa = calculatePaintingBudget(
      { service_type: 'residential_simple', area_m2: 0, conditions: [], includes_material: false },
      mockPricingRules, mockComplexityRules,
    )
    const alta = calculatePaintingBudget(
      { service_type: 'residential_simple', area_m2: 50, conditions: ['mold_moisture', 'cracks', 'furnished', 'urgency'], includes_material: false },
      mockPricingRules, mockComplexityRules,
    )
    expect(baixa.confidence_label).toBe('baixa')
    expect(alta.confidence_label).toBe('alta')
  })
})

// ─── calculateDivergence ──────────────────────────────────────────────────────

describe('calculateDivergence', () => {
  it('calcula divergência positiva (pintor maior que IA)', () => {
    const result = calculateDivergence(1000, 1400, 1500)
    // ai_mid = 1200, divergence = (1500 - 1200) / 1200 * 100 = 25
    expect(result).toBe(25)
  })

  it('calcula divergência negativa (pintor menor que IA)', () => {
    const result = calculateDivergence(1000, 1400, 900)
    // ai_mid = 1200, divergence = (900 - 1200) / 1200 * 100 = -25
    expect(result).toBe(-25)
  })

  it('retorna 0 quando sem divergência', () => {
    const result = calculateDivergence(1000, 1400, 1200)
    expect(result).toBe(0)
  })

  it('retorna 0 quando ai_mid é zero', () => {
    const result = calculateDivergence(0, 0, 1000)
    expect(result).toBe(0)
  })

  it('arredonda para inteiro', () => {
    const result = calculateDivergence(1000, 1300, 1200)
    expect(Number.isInteger(result)).toBe(true)
  })
})
