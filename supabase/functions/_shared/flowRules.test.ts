import { describe, it, expect } from 'vitest'
import {
  conditionMet, buildChecklist, missingRequired, isDiscoveryComplete, inferPropertyScope,
  matchesOption, canonicalizeEnumValue, interpolateQuestion, findStepForField, isSelectAllPhrase,
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

describe('matchesOption', () => {
  const deadlineOptions = ['🔴 Urgente – o quanto antes', '📅 Em 2 semanas', '🗓️ Próximo mês', '⏳ Sem pressa']
  const wallOptions = ['Bom estado', 'Manchas / sujeira', 'Descascando', 'Rachaduras', 'Mofo', 'Pós-obra / novo']
  const propertyOptions = ['Apartamento', 'Casa', 'Prédio / Edifício', 'Sala / Escritório', 'Loja / Comércio', 'Outro']

  it('matches a short free-text reply against an emoji-prefixed option (real Sandro case: "Urgente")', () => {
    expect(matchesOption(deadlineOptions, 'Urgente')).toBe(true)
  })

  it('matches "Mofadas" loosely against the "Mofo" wall_condition option', () => {
    expect(matchesOption(wallOptions, 'Mofadas')).toBe(true)
  })

  it('matches "Escritorio" (no accent) against "Sala / Escritório"', () => {
    expect(matchesOption(propertyOptions, 'Escritorio')).toBe(true)
  })

  it('matches the exact button label a click would send, emoji included', () => {
    expect(matchesOption(deadlineOptions, '🔴 Urgente – o quanto antes')).toBe(true)
  })

  it('does not match an unrelated out-of-scope message', () => {
    expect(matchesOption(propertyOptions, 'quero pintar meu carro')).toBe(false)
  })

  it('returns false when there are no options to match against', () => {
    expect(matchesOption(null, 'Urgente')).toBe(false)
    expect(matchesOption([], 'Urgente')).toBe(false)
  })

  it('returns false for an empty reply', () => {
    expect(matchesOption(deadlineOptions, '   ')).toBe(false)
  })

  it('does not false-positive on unrelated words that happen to share a 3-letter prefix', () => {
    expect(matchesOption(propertyOptions, 'cartão de crédito')).toBe(false) // "car..." vs "Casa"
    expect(matchesOption(wallOptions, 'rapidinho por favor')).toBe(false)
  })

  it('REGRESSION: does not short-circuit a full sentence onto service_type just because "pintar" stems like "Pintura"', () => {
    const serviceOptions = ['Pintura interna', 'Fachada / Externa', 'Repintura – mesma cor', 'Repintura – nova cor', 'Textura / Grafiato', '1ª pintura (imóvel novo)']
    // Real bug: this message was being swallowed whole into service_type
    // ("Pintura interna") before ever reaching the out-of-scope check or
    // the LLM extraction — "pintar" and "Pintura" share a 3-letter stem.
    expect(matchesOption(serviceOptions, 'quero pintar meu carro')).toBe(false)
    expect(matchesOption(serviceOptions, 'quero pintar minha residência no campeche')).toBe(false)
  })

  it('matches a full free-text sentence that mentions one of the options by name', () => {
    expect(matchesOption(propertyOptions, 'é uma casa mesmo')).toBe(true)
  })
})

describe('canonicalizeEnumValue', () => {
  const propertyOptions = ['Apartamento', 'Casa', 'Prédio / Edifício', 'Sala / Escritório', 'Loja / Comércio', 'Outro']

  it('resolves a model output that drifted from the enum to the canonical option (real bug: "Escritorio")', () => {
    expect(canonicalizeEnumValue(propertyOptions, 'Escritorio')).toBe('Sala / Escritório')
  })

  it('returns the value unchanged when it already matches an option exactly', () => {
    expect(canonicalizeEnumValue(propertyOptions, 'Casa')).toBe('Casa')
  })

  it('returns the original value unchanged when nothing matches', () => {
    expect(canonicalizeEnumValue(propertyOptions, 'Garagem de barco')).toBe('Garagem de barco')
  })

  it('returns the value unchanged when there are no options to canonicalize against', () => {
    expect(canonicalizeEnumValue(null, 'Escritorio')).toBe('Escritorio')
  })

  it('REGRESSION: does not collapse a long free-text value onto an unrelated option via stem coincidence', () => {
    const serviceOptions = ['Pintura interna', 'Fachada / Externa', 'Repintura – mesma cor', 'Repintura – nova cor', 'Textura / Grafiato', '1ª pintura (imóvel novo)']
    expect(canonicalizeEnumValue(serviceOptions, 'quero pintar meu carro')).toBe('quero pintar meu carro')
  })
})

describe('interpolateQuestion', () => {
  it('fills {{field}} placeholders from collected data', () => {
    expect(interpolateQuestion('É uma **{{property_type}}**! Interna, externa ou ambas?', { property_type: 'Casa' }))
      .toBe('É uma **Casa**! Interna, externa ou ambas?')
  })

  it('converts DB-escaped \\n into a real newline', () => {
    expect(interpolateQuestion('Linha um\\n\\nLinha dois', {})).toBe('Linha um\n\nLinha dois')
  })

  it('leaves an unresolved placeholder empty rather than crashing', () => {
    expect(interpolateQuestion('Para {{property_type}}, confirma?', {})).toBe('Para , confirma?')
  })
})

describe('findStepForField', () => {
  const steps: FlowStepRow[] = [
    { branch: 'client', order_index: 1, active: true, enabled: true, question_template: 'Que serviço?', step_type: 'quick_reply', quick_replies: ['A', 'B'], field_key: 'service_type', validation_type: 'none', skippable: false, is_core_field: true, step_key: 'service_type' },
    { branch: 'client', order_index: 4.5, active: true, enabled: true, question_template: 'Interna, externa ou ambas?', step_type: 'quick_reply', quick_replies: ['Apenas interna', 'Apenas externa'], field_key: 'property_scope', validation_type: 'none', skippable: false, is_core_field: true, step_key: 'property_scope', condition_key: 'property_type', condition_value: 'Casa' },
    { branch: 'painter', order_index: 1, active: true, enabled: true, question_template: 'Nome?', step_type: 'text', quick_replies: null, field_key: 'service_type', validation_type: 'none', skippable: false, is_core_field: true, step_key: 'painter_dup' },
  ]

  it('finds a plain discovery step by field_key', () => {
    expect(findStepForField(steps, 'service_type')?.step_key).toBe('service_type')
  })

  it('finds a conditional step (not filtered out like discoverySteps does)', () => {
    expect(findStepForField(steps, 'property_scope')?.step_key).toBe('property_scope')
  })

  it('only considers the client branch, ignoring a same-named painter field', () => {
    const r = findStepForField(steps, 'service_type')
    expect(r?.branch).toBe('client')
  })

  it('returns undefined when no step matches', () => {
    expect(findStepForField(steps, 'nonexistent_field')).toBeUndefined()
  })
})

describe('isSelectAllPhrase', () => {
  it('matches the common PT-BR "select all" phrasings', () => {
    expect(isSelectAllPhrase('Tudo')).toBe(true)
    expect(isSelectAllPhrase('todas')).toBe(true)
    expect(isSelectAllPhrase('Tudo isso')).toBe(true)
    expect(isSelectAllPhrase('qualquer uma')).toBe(true)
  })

  it('REGRESSION: does not match a word that only echoes a prior answer, even if related', () => {
    // Real bug: answering "Interna" to "quais superfícies?" (right after
    // having said "Pintura interna" as the service type) silently selected
    // every single surface option.
    expect(isSelectAllPhrase('Interna')).toBe(false)
    expect(isSelectAllPhrase('Paredes')).toBe(false)
  })

  it('does not match a full sentence, only the closed set of exact phrases', () => {
    expect(isSelectAllPhrase('quero pintar tudo da minha casa')).toBe(false)
  })
})
