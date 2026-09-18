import { describe, it, expect } from 'vitest'
import {
  renderTemplate, inferPropertyScope, autoAdvance,
  type FlowStep, type CollectedData,
} from './chatFlow'

function step(partial: Partial<FlowStep> & { step_key: string; field_key: string }): FlowStep {
  return {
    id: partial.step_key,
    branch: 'client',
    order_index: 0,
    active: true,
    enabled: true,
    editable: true,
    question_template: '',
    step_type: 'text',
    quick_replies: null,
    validation_type: 'none',
    skippable: false,
    use_ai_transition: false,
    is_core_field: true,
    multi_select: false,
    ...partial,
  }
}

describe('renderTemplate', () => {
  it('interpolates {{property_type}} instead of leaking the placeholder', () => {
    const s = step({
      step_key: 'property_scope',
      field_key: 'property_scope',
      question_template: 'É uma **{{property_type}}**! A pintura será interna, externa ou ambas? 🏡',
    })
    const out = renderTemplate(s, [s], { property_type: 'Casa' })
    expect(out).toBe('É uma **Casa**! A pintura será interna, externa ou ambas? 🏡')
    expect(out).not.toContain('{{')
  })

  it('converts DB-escaped \\n into real newlines', () => {
    const s = step({
      step_key: 'num_rooms',
      field_key: 'num_rooms',
      question_template: 'Quais cômodos?\\n\\nPode listar.',
    })
    expect(renderTemplate(s, [s], {})).toBe('Quais cômodos?\n\nPode listar.')
  })
})

describe('inferPropertyScope', () => {
  it('derives "Apenas externa" from a fachada service_type', () => {
    expect(inferPropertyScope({ service_type: 'Fachada / Externa' })).toBe('Apenas externa')
  })

  it('derives "Apenas interna" from an internal service_type', () => {
    expect(inferPropertyScope({ service_type: 'Pintura interna' })).toBe('Apenas interna')
  })

  it('returns "Ambas" when both are mentioned', () => {
    expect(inferPropertyScope({ service_type: 'Pintura interna', surfaces: 'Fachada' }))
      .toBe('Ambas (interna + externa)')
  })

  it('never overrides a scope the user already gave', () => {
    expect(inferPropertyScope({ service_type: 'Fachada / Externa', property_scope: 'Apenas interna' }))
      .toBe('Apenas interna')
  })

  it('returns undefined when the service_type says nothing about scope', () => {
    expect(inferPropertyScope({ service_type: 'Textura / Grafiato' })).toBeUndefined()
    expect(inferPropertyScope({})).toBeUndefined()
  })
})

describe('autoAdvance', () => {
  const flow = [
    step({ step_key: 'q_property', field_key: 'property_type', order_index: 1 }),
    step({ step_key: 'q_neighborhood', field_key: 'neighborhood', order_index: 2 }),
    step({ step_key: 'q_area', field_key: 'area_m2', order_index: 3 }),
  ]

  it('skips a step whose answer was volunteered mid-conversation, not prefilled', () => {
    const data: CollectedData = { property_type: 'Casa', neighborhood: 'Campeche' }
    const resolved = autoAdvance(flow, 'q_property', data, new Set())
    expect(resolved?.step_key).toBe('q_area')
  })

  it('still asks a step that has no collected value', () => {
    const resolved = autoAdvance(flow, 'q_property', { property_type: 'Casa' }, new Set())
    expect(resolved?.step_key).toBe('q_neighborhood')
  })

  it('returns null when every remaining step is already answered', () => {
    const data: CollectedData = { property_type: 'Casa', neighborhood: 'Campeche', area_m2: 80 }
    expect(autoAdvance(flow, 'q_property', data, new Set())).toBeNull()
  })

  it('does not treat an empty string as an answer', () => {
    const resolved = autoAdvance(flow, 'q_property', { property_type: '' }, new Set())
    expect(resolved?.step_key).toBe('q_property')
  })
})
