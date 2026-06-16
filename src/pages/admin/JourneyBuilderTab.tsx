import { useEffect, useState, useCallback } from 'react'
import { motion } from 'motion/react'
import { Plus, Trash2, ChevronUp, ChevronDown, Edit2, Save, Loader2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { FlowStep } from '../../hooks/chatFlow'

const STEP_TYPE_OPTIONS = [
  { value: 'text', label: 'Texto livre' },
  { value: 'quick_reply', label: 'Quick Reply' },
  { value: 'media', label: 'Mídia (fotos/vídeos)' },
]

const VALIDATION_OPTIONS = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'name', label: 'Nome' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'area_m2', label: 'Metragem (m²)' },
  { value: 'min3', label: 'Mínimo 3 caracteres' },
]

const STEP_TYPE_CLASS: Record<string, string> = {
  text: 'bg-blue-100 text-blue-700',
  quick_reply: 'bg-purple-100 text-purple-700',
  media: 'bg-green-100 text-green-700',
}

const STEP_TYPE_LABEL: Record<string, string> = {
  text: 'Texto',
  quick_reply: 'Quick Reply',
  media: 'Mídia',
}

export function JourneyBuilderTab() {
  const [steps, setSteps] = useState<FlowStep[]>([])
  const [loading, setLoading] = useState(true)
  const [editingStep, setEditingStep] = useState<Partial<FlowStep> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [qrText, setQrText] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('agent_flow_steps')
      .select('*')
      .eq('active', true)
      .order('order_index')
    setSteps((data as FlowStep[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const clientSteps = steps.filter(s => s.branch === 'client')
  const painterSteps = steps.filter(s => s.branch === 'painter')

  function openEdit(step: FlowStep) {
    setEditingStep({ ...step })
    setQrText(step.quick_replies?.join('\n') ?? '')
    setIsNew(false)
  }

  function openNew(branch: 'client' | 'painter') {
    const list = steps.filter(s => s.branch === branch)
    const maxOrder = list.length > 0 ? Math.max(...list.map(s => s.order_index)) : 0
    setEditingStep({
      branch,
      order_index: maxOrder + 1,
      active: true,
      editable: true,
      question_template: '',
      step_type: 'text',
      quick_replies: null,
      field_key: '',
      validation_type: 'none',
      skippable: false,
      use_ai_transition: false,
      is_core_field: false,
    })
    setQrText('')
    setIsNew(true)
  }

  async function saveStep() {
    if (!editingStep?.field_key?.trim() || !editingStep?.question_template?.trim()) return
    setSaving(true)
    const payload = {
      ...editingStep,
      quick_replies: qrText.trim()
        ? qrText.split('\n').map(s => s.trim()).filter(Boolean)
        : null,
      updated_at: new Date().toISOString(),
    }
    if (isNew) {
      await supabase.from('agent_flow_steps').insert([payload])
    } else {
      await supabase.from('agent_flow_steps').update(payload).eq('id', editingStep.id)
    }
    setEditingStep(null)
    setSaving(false)
    await load()
  }

  async function softDelete(step: FlowStep) {
    await supabase.from('agent_flow_steps').update({ active: false }).eq('id', step.id)
    await load()
  }

  async function moveStep(branchList: FlowStep[], idx: number, dir: -1 | 1) {
    const j = idx + dir
    if (j < 0 || j >= branchList.length) return
    const a = branchList[idx]
    const b = branchList[j]
    await Promise.all([
      supabase.from('agent_flow_steps').update({ order_index: b.order_index }).eq('id', a.id),
      supabase.from('agent_flow_steps').update({ order_index: a.order_index }).eq('id', b.id),
    ])
    await load()
  }

  function renderBranch(branchList: FlowStep[], branch: 'client' | 'painter') {
    const title = branch === 'client' ? 'Fluxo do Cliente' : 'Fluxo do Pintor'

    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{branchList.length} pergunta(s) ativa(s)</p>
          </div>
          <button
            onClick={() => openNew(branch)}
            className="flex items-center gap-1.5 text-sm text-brand font-medium cursor-pointer hover:text-brand-dark"
          >
            <Plus className="w-4 h-4" /> Adicionar pergunta
          </button>
        </div>

        {branchList.length === 0 && (
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center">
            <p className="text-sm text-gray-400">Nenhuma pergunta ativa.</p>
          </div>
        )}

        <div className="space-y-2">
          {branchList.map((step, i) => (
            <div key={step.id} className="flex items-start gap-2 p-3 border border-gray-200 rounded-xl bg-white hover:border-gray-300 transition-colors">
              {/* Reorder */}
              <div className="flex flex-col gap-0.5 pt-1 shrink-0">
                <button
                  onClick={() => moveStep(branchList, i, -1)}
                  disabled={i === 0 || !step.editable}
                  className="text-gray-300 hover:text-gray-600 disabled:opacity-20 cursor-pointer"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => moveStep(branchList, i, 1)}
                  disabled={i === branchList.length - 1 || !step.editable}
                  className="text-gray-300 hover:text-gray-600 disabled:opacity-20 cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-xs font-mono text-gray-400">{step.step_key}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STEP_TYPE_CLASS[step.step_type] ?? 'bg-gray-100 text-gray-600'}`}>
                    {STEP_TYPE_LABEL[step.step_type] ?? step.step_type}
                  </span>
                  {!step.editable && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">estrutural</span>
                  )}
                  {step.use_ai_transition && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 font-medium">IA</span>
                  )}
                  {step.skippable && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 font-medium">opcional</span>
                  )}
                </div>
                <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                  {step.question_template.replace(/\n/g, ' ')}
                </p>
                {step.quick_replies && step.quick_replies.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {step.quick_replies.slice(0, 4).map((qr, qi) => (
                      <span key={qi} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{qr}</span>
                    ))}
                    {step.quick_replies.length > 4 && (
                      <span className="text-[10px] text-gray-400">+{step.quick_replies.length - 4}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0 pt-0.5">
                <button onClick={() => openEdit(step)} className="text-gray-400 hover:text-gray-700 cursor-pointer" title="Editar">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {step.editable && (
                  <button onClick={() => softDelete(step)} className="text-red-300 hover:text-red-600 cursor-pointer" title="Remover">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-8">
        {renderBranch(clientSteps, 'client')}
        {renderBranch(painterSteps, 'painter')}
      </div>

      {editingStep && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setEditingStep(null) }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">
                {isNew ? 'Nova pergunta' : 'Editar pergunta'}
              </h3>
              <button onClick={() => setEditingStep(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* field_key */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                  Chave do campo{isNew && <span className="text-red-400 ml-1">*</span>}
                </label>
                {isNew ? (
                  <>
                    <input
                      value={editingStep.field_key ?? ''}
                      onChange={e => setEditingStep({
                        ...editingStep,
                        field_key: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
                        step_key: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
                      })}
                      placeholder="ex: cor_preferida"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-brand"
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">Slug único em snake_case. Ex: cor_preferida, tamanho_comodo</p>
                  </>
                ) : (
                  <p className="text-sm font-mono text-gray-500 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">{editingStep.field_key}</p>
                )}
              </div>

              {/* question_template */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Texto da pergunta</label>
                <textarea
                  value={editingStep.question_template ?? ''}
                  onChange={e => setEditingStep({ ...editingStep, question_template: e.target.value })}
                  rows={4}
                  placeholder={'Ex: {{name}}, qual a cor que você prefere para as paredes?'}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand resize-none"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {'Variáveis: {{name}}, {{service_type}}, {{neighborhood}}, {{summary}}'}
                </p>
              </div>

              {/* step_type */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Tipo de resposta</label>
                <select
                  value={editingStep.step_type ?? 'text'}
                  onChange={e => setEditingStep({ ...editingStep, step_type: e.target.value as FlowStep['step_type'] })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand bg-white"
                >
                  {STEP_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* quick_replies */}
              {editingStep.step_type === 'quick_reply' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Opções (uma por linha)</label>
                  <textarea
                    value={qrText}
                    onChange={e => setQrText(e.target.value)}
                    rows={4}
                    placeholder={'Opção A\nOpção B\nOpção C'}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-brand resize-none"
                  />
                </div>
              )}

              {/* validation_type */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Validação da resposta</label>
                <select
                  value={editingStep.validation_type ?? 'none'}
                  onChange={e => setEditingStep({ ...editingStep, validation_type: e.target.value as FlowStep['validation_type'] })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand bg-white"
                >
                  {VALIDATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Checkboxes */}
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingStep.skippable ?? false}
                    onChange={e => setEditingStep({ ...editingStep, skippable: e.target.checked })}
                    className="accent-brand w-4 h-4 mt-0.5 shrink-0"
                  />
                  <div>
                    <p className="text-sm text-gray-700">Pergunta opcional</p>
                    <p className="text-[10px] text-gray-400">O usuário pode digitar "pular" para avançar sem responder</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingStep.use_ai_transition ?? false}
                    onChange={e => setEditingStep({ ...editingStep, use_ai_transition: e.target.checked })}
                    className="accent-brand w-4 h-4 mt-0.5 shrink-0"
                  />
                  <div>
                    <p className="text-sm text-gray-700">Transição com IA</p>
                    <p className="text-[10px] text-gray-400">O agente reage brevemente à resposta anterior antes de fazer esta pergunta</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setEditingStep(null)} className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer">
                Cancelar
              </button>
              <motion.button
                onClick={saveStep}
                disabled={saving || !editingStep.field_key?.trim() || !editingStep.question_template?.trim()}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl cursor-pointer disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  )
}
