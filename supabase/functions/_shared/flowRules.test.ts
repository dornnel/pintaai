import { describe, it, expect } from 'vitest'
import {
  conditionMet, buildChecklist, missingRequired, isDiscoveryComplete, inferPropertyScope,
  type FlowStepRow,
} from './flowRules'

function step(p: Partial<FlowStepRow> & { step_key: string; field_key: string }): FlowStepRow {
  return {
    branch: 'client', order_index: 0, active: true, enabled: true,
    question_template: '', step_type: 'quick_reply', quick_replies: null,
    validation_type: 'none', skippable: false, is_core_field: true,
    ...p,
  }
}

const BASE_STEPS: FlowStepRow[] = [
  step({ step_key: 'service_type', field_key: 'service_type', order_index: 1, question_template: 'Que serviço?' }),
  step({ step_key: 'property_type', field_key: 'property_type', order_index: 2, question_template: 'Que imóvel?' }),
  step({ step_key: 'neighborhood', field_key: 'neighborhood', order_index: 3, question_template: 'Bairro?' }),
  step({ step_key: 'area_m2', field_key: 'area_m2', order_index: 4, skippable: true, question_template: 'Metragem?' }),
  step({ step_key: 'lead_name', field_key: 'name', order_index: 5, question_template: 'Nome?' }),
  step({ step_key: 'media_upload', field_key: 'media_urls', order_index: 6, step_type: 'media', skippable: true, question_template: 'Fotos?' }),
  // Condicionais reais, espelhando a jornada em produção (migration 045 + admin)
  step({
    step_key: 'property_scope', field_key: 'property_scope', order_index: 2.5,
    question_template: 'Interna, externa ou ambas?',
    condition_key: 'property_type', condition_value: 'Casa,Prédio / Edifício',
  }),
  step({
    step_key: 'visit_preference', field_key: 'site_visit_preference', order_index: 2.7,
    question_template: 'Visita técnica ou a distância?',
    condition_key: 'property_type', condition_value: '!Apartamento',
  }),
]

describe('conditionMet', () => {
  it('is true when the step has no condition', () => {
    expect(conditionMet(step({ step_key: 'a', field_key: 'a' }), {})).toBe(true)
  })

  it('matches a plain equality condition', () => {
    const s = step({ step_key: 'a', field_key: 'a', condition_key: 'property_type', condition_value: 'Casa' })
    expect(conditionMet(s, { property_type: 'Casa' })).toBe(true)
    expect(conditionMet(s, { property_type: 'Apartamento' })).toBe(false)
  })

  it('supports negated comma-separated clauses (AND)', () => {
    const s = step({ step_key: 'a', field_key: 'a', condition_key: 'property_type', condition_value: '!Apartamento,!Casa' })
    expect(conditionMet(s, { property_type: 'Loja / Comércio' })).toBe(true)
    expect(conditionMet(s, { property_type: 'Casa' })).toBe(false)
    expect(conditionMet(s, { property_type: 'Apartamento' })).toBe(false)
  })
})

describe('buildChecklist / missingRequired', () => {
  it('excludes tail fields (name/email/whatsapp/confirmed) from the discovery checklist', () => {
    const items = buildChecklist(BASE_STEPS, {})
    expect(items.find(i => i.field === 'name')).toBeUndefined()
  })

  it('excludes role — it is resolved before chat_turn ever runs, never filled by it', () => {
    const stepsWithRole = [
      step({ step_key: 'role_select', field_key: 'role', order_index: 0, question_template: 'Cliente ou pintor?' }),
      ...BASE_STEPS,
    ]
    const items = buildChecklist(stepsWithRole, {})
    expect(items.find(i => i.field === 'role')).toBeUndefined()
  })

  it('excludes media steps from the checklist', () => {
    const items = buildChecklist(BASE_STEPS, {})
    expect(items.find(i => i.field === 'media_urls')).toBeUndefined()
  })

  it('marks skippable fields as optional, not required', () => {
    const items = buildChecklist(BASE_STEPS, {})
    const area = items.find(i => i.field === 'area_m2')
    expect(area?.required).toBe(false)
  })

  it('reports missing required fields until every core field is answered', () => {
    const partial = { service_type: 'Fachada / Externa' }
    const missing = missingRequired(buildChecklist(BASE_STEPS, partial)).map(i => i.field)
    expect(missing).toContain('property_type')
    expect(missing).toContain('neighborhood')
    expect(missing).not.toContain('service_type')
    expect(missing).not.toContain('area_m2') // optional
  })

  it('adds the property_scope question for Casa and Prédio / Edifício, not Apartamento', () => {
    expect(buildChecklist(BASE_STEPS, { property_type: 'Casa' }).find(i => i.field === 'property_scope')).toBeDefined()
    expect(buildChecklist(BASE_STEPS, { property_type: 'Prédio / Edifício' }).find(i => i.field === 'property_scope')).toBeDefined()
    expect(buildChecklist(BASE_STEPS, { property_type: 'Apartamento' }).find(i => i.field === 'property_scope')).toBeUndefined()
  })

  it('does not decide the conditional item before property_type itself is known', () => {
    const items = buildChecklist(BASE_STEPS, {})
    expect(items.find(i => i.field === 'property_scope')).toBeUndefined()
    expect(items.find(i => i.field === 'site_visit_preference')).toBeUndefined()
  })

  it('requires site_visit_preference for non-apartment properties', () => {
    const items = buildChecklist(BASE_STEPS, { property_type: 'Loja / Comércio' })
    expect(items.find(i => i.field === 'site_visit_preference')?.required).toBe(true)
  })

  it('does not require site_visit_preference for a plain apartment', () => {
    const items = buildChecklist(BASE_STEPS, { property_type: 'Apartamento' })
    expect(items.find(i => i.field === 'site_visit_preference')).toBeUndefined()
  })

  it('requires site_visit_preference for an apartment whose scope covers the exterior/fachada', () => {
    const items = buildChecklist(BASE_STEPS, { property_type: 'Apartamento', property_scope: 'Apenas externa' })
    expect(items.find(i => i.field === 'site_visit_preference')?.required).toBe(true)
  })
})

describe('inferPropertyScope', () => {
  it('derives externa from a fachada service_type', () => {
    expect(inferPropertyScope({ service_type: 'Fachada / Externa' })).toBe('Apenas externa')
  })
  it('never overrides a scope already given', () => {
    expect(inferPropertyScope({ service_type: 'Fachada / Externa', property_scope: 'Apenas interna' })).toBe('Apenas interna')
  })
  it('returns undefined with no scope-revealing signal', () => {
    expect(inferPropertyScope({})).toBeUndefined()
  })
})

describe('isDiscoveryComplete', () => {
  it('is false while any required field is missing', () => {
    expect(isDiscoveryComplete(BASE_STEPS, { service_type: 'Pintura interna' })).toBe(false)
  })

  it('is true once every required field (including synthetic ones) is filled', () => {
    const data = {
      service_type: 'Pintura interna',
      property_type: 'Casa',
      property_scope: 'Apenas interna',
      site_visit_preference: 'Orçamento a distância',
      neighborhood: 'Campeche',
    }
    expect(isDiscoveryComplete(BASE_STEPS, data)).toBe(true)
  })

  it('reaches completion even though data.role is never set by chat_turn itself', () => {
    const stepsWithRole = [
      step({ step_key: 'role_select', field_key: 'role', order_index: 0, question_template: 'Cliente ou pintor?' }),
      ...BASE_STEPS,
    ]
    const data = {
      service_type: 'Pintura interna',
      property_type: 'Apartamento',
      neighborhood: 'Campeche',
      // note: no `role` key at all — matches how chat_turn actually receives data
    }
    expect(isDiscoveryComplete(stepsWithRole, data)).toBe(true)
  })

  it('never demands the optional area_m2 field', () => {
    const data = {
      service_type: 'Pintura interna',
      property_type: 'Apartamento',
      neighborhood: 'Campeche',
    }
    expect(isDiscoveryComplete(BASE_STEPS, data)).toBe(true)
  })
})
