import { useState, useEffect } from "react"
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, Phone, MessageCircle, MapPin, AlertCircle,
  User, ArrowLeft, Filter, Globe, Lock, Ruler,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { cn, formatCurrency } from '../../lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string
  name: string
  phone?: string
  email?: string
  source: string
  service_interest?: string
  neighborhood?: string
  estimated_value?: number
  stage: string
  stage_updated_at: string
  notes?: string
  tags: string[]
  created_at: string
  protocol?: string
  service_request_id?: string
  area_m2?: number
  wall_condition?: string
  calc_price_min?: number
  calc_price_max?: number
  _interaction_status?: string
}

const STAGES = [
  { id: 'new', label: 'Novo', color: 'bg-gray-100 border-gray-200', dot: 'bg-gray-400' },
  { id: 'contacted', label: 'Contatado', color: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
  { id: 'qualified', label: 'Qualificado', color: 'bg-violet-50 border-violet-200', dot: 'bg-violet-500' },
  { id: 'proposal_sent', label: 'Proposta Enviada', color: 'bg-yellow-50 border-yellow-200', dot: 'bg-yellow-500' },
  { id: 'negotiating', label: 'Negociando', color: 'bg-orange-50 border-orange-200', dot: 'bg-orange-400' },
  { id: 'won', label: 'Ganho ✓', color: 'bg-green-50 border-green-200', dot: 'bg-green-500' },
  { id: 'lost', label: 'Perdido', color: 'bg-red-50 border-red-200', dot: 'bg-red-400' },
]

// Colunas do CRM do pintor — baseadas em lead_painter_interactions.status
const PAINTER_STAGES = [
  { id: 'notified', label: 'Recebido', color: 'bg-gray-100 border-gray-200', dot: 'bg-gray-400' },
  { id: 'proposal_viewed', label: 'Visualizado', color: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
  { id: 'proposal_sent', label: 'Proposta Enviada', color: 'bg-yellow-50 border-yellow-200', dot: 'bg-yellow-500' },
  { id: 'replied', label: 'Respondido', color: 'bg-green-50 border-green-200', dot: 'bg-green-500' },
  { id: 'declined', label: 'Recusado', color: 'bg-red-50 border-red-200', dot: 'bg-red-400' },
]

// Status de interação ainda não tratados pelo pintor caem na coluna "Recebido"
function painterColumnFor(status?: string): string {
  if (!status) return 'notified'
  return PAINTER_STAGES.some(s => s.id === status) ? status : 'notified'
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  chat: <MessageCircle className="w-3 h-3 text-brand" />,
  whatsapp: <MessageCircle className="w-3 h-3 text-green-500" />,
  web: <Globe className="w-3 h-3 text-blue-500" />,
  instagram: <Globe className="w-3 h-3 text-pink-500" />,
  admin: <User className="w-3 h-3 text-gray-500" />,
  referral: <User className="w-3 h-3 text-purple-500" />,
}

// ─── Lead Card ────────────────────────────────────────────────────────────────

function LeadCard({ lead, isDragging = false, painterView = false }: { lead: Lead; isDragging?: boolean; painterView?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lead.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(lead.stage_updated_at).getTime()) / 86400000
  )
  const isStale = daysSinceUpdate > 7

  // Enquanto o pintor não demonstrou interesse, ocultar dados pessoais do cliente
  const masked = painterView && lead._interaction_status === 'notified'
  const displayName = masked ? `Cliente em ${lead.neighborhood || 'Florianópolis'}` : lead.name

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <motion.div
        className={cn(
          'bg-white rounded-xl border border-gray-100 p-3 shadow-sm cursor-grab active:cursor-grabbing select-none',
          isDragging && 'shadow-xl ring-2 ring-brand/30 rotate-1 opacity-90',
          isStale && 'border-l-4 border-l-orange-400',
        )}
        whileHover={{ y: -1, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
        layout
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white text-[10px] font-bold shrink-0">
              {masked ? <Lock className="w-3 h-3" /> : lead.name[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
              {!masked && lead.protocol && (
                <p className="text-[9px] font-mono text-brand/60 leading-none">{lead.protocol}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {SOURCE_ICONS[lead.source] || <Globe className="w-3 h-3 text-gray-400" />}
            {lead.service_request_id && (
              <span className="text-[9px] bg-green-100 text-green-700 font-medium px-1 py-0.5 rounded leading-none">
                Pedido ✓
              </span>
            )}
          </div>
        </div>

        {lead.service_interest && (
          <p className="text-xs text-gray-500 mb-1.5 truncate">{lead.service_interest}</p>
        )}

        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
          {lead.neighborhood && (
            <span className="flex items-center gap-0.5">
              <MapPin className="w-2.5 h-2.5" />{lead.neighborhood}
            </span>
          )}
          {lead.area_m2 != null && (
            <span className="flex items-center gap-0.5">
              <Ruler className="w-2.5 h-2.5" />{lead.area_m2} m²
            </span>
          )}
          {painterView ? (
            (lead.calc_price_min != null || lead.calc_price_max != null) && (
              <span className="text-green-600 font-medium">
                {formatCurrency(lead.calc_price_min || 0)} – {formatCurrency(lead.calc_price_max || 0)}
              </span>
            )
          ) : (
            lead.estimated_value != null && (
              <span className="text-green-600 font-medium">{formatCurrency(lead.estimated_value)}</span>
            )
          )}
        </div>

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
          <div className="flex items-center gap-1">
            {isStale && (
              <span className="flex items-center gap-0.5 text-[10px] text-orange-500 font-medium">
                <AlertCircle className="w-3 h-3" />{daysSinceUpdate}d parado
              </span>
            )}
          </div>
          {!masked && (
            <div className="flex gap-1">
              {lead.phone && (
                <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()}
                  className="w-6 h-6 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 hover:text-brand hover:bg-orange-50 transition-colors">
                  <Phone className="w-3 h-3" />
                </a>
              )}
              {lead.phone && (
                <a href={`https://wa.me/55${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="w-6 h-6 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 hover:text-green-500 hover:bg-green-50 transition-colors">
                  <MessageCircle className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ─── Stage Column ─────────────────────────────────────────────────────────────

function StageColumn({ stage, leads, onAddLead, painterView = false }: {
  stage: { id: string; label: string; color: string; dot: string }
  leads: Lead[]
  onAddLead?: (stageId: string) => void
  painterView?: boolean
}) {
  return (
    <div className={cn('rounded-2xl border p-3 min-w-[220px] max-w-[240px] flex-shrink-0', stage.color)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', stage.dot)} />
          <span className="text-xs font-semibold text-gray-700">{stage.label}</span>
          <span className="text-xs text-gray-400 bg-white rounded-full px-1.5 py-0.5 font-medium">
            {leads.length}
          </span>
        </div>
        {onAddLead && (
          <button onClick={() => onAddLead(stage.id)}
            className="w-5 h-5 rounded-md bg-white/80 flex items-center justify-center text-gray-400 hover:text-brand hover:bg-white transition-colors cursor-pointer">
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>

      <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[60px]">
          {leads.map(lead => <LeadCard key={lead.id} lead={lead} painterView={painterView} />)}
        </div>
      </SortableContext>
    </div>
  )
}

// ─── Add Lead Modal ───────────────────────────────────────────────────────────

function AddLeadModal({ initialStage, onClose, onSaved }: {
  initialStage: string
  onClose: () => void
  onSaved: (lead: Lead) => void
}) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    name: '', phone: '', email: '', neighborhood: '',
    service_interest: '', estimated_value: '', source: 'web', stage: initialStage,
  })
  const [saving, setSaving] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data } = await supabase.from('leads').insert({
      ...form,
      estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
      assigned_to: user?.id,
      stage_updated_at: new Date().toISOString(),
    }).select().single()
    if (data) onSaved(data as Lead)
    setSaving(false)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
        className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900 mb-4">Novo lead</h3>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nome *</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">WhatsApp</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="48 9 9999-9999"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Bairro</label>
              <input value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Serviço de interesse</label>
              <input value={form.service_interest} onChange={e => setForm({ ...form, service_interest: e.target.value })}
                placeholder="Pintura interna, fachada..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Valor estimado (R$)</label>
              <input type="number" value={form.estimated_value} onChange={e => setForm({ ...form, estimated_value: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Origem</label>
              <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand bg-white">
                <option value="web">Web</option>
                <option value="chat">Chat</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Globe</option>
                <option value="referral">Indicação</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-gradient-to-r from-[#FF7A30] to-brand text-white rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar lead'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ─── Main CRM Board ───────────────────────────────────────────────────────────

export function CRMBoard() {
  const { user } = useAuth()
  const isPainterView = user?.activeRole === 'painter'
  const stages = isPainterView ? PAINTER_STAGES : STAGES
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  const [addingToStage, setAddingToStage] = useState<string | null>(null)
  const [filterSource, setFilterSource] = useState<string>('all')
  const [painterId, setPainterId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    loadLeads()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadLeads() {
    if (isPainterView) {
      const { data: painterRow } = await supabase.from('painters').select('id').eq('user_id', user!.id).maybeSingle()
      if (!painterRow) {
        setLeads([])
        setLoading(false)
        return
      }
      setPainterId(painterRow.id)

      const { data } = await supabase
        .from('lead_painter_interactions')
        .select('status, notified_at, lead:leads(*)')
        .eq('painter_id', painterRow.id)
        .order('notified_at', { ascending: false })

      const mapped = ((data as unknown as { status: string; notified_at: string; lead: Lead | null }[]) || [])
        .filter(row => row.lead)
        .map(row => ({ ...row.lead!, _interaction_status: row.status, stage: painterColumnFor(row.status) }))
      setLeads(mapped)
      setLoading(false)
      return
    }

    const { data } = await supabase.from('leads')
      .select('*')
      .not('stage', 'in', '("archived")')
      .order('stage_updated_at', { ascending: false })
    setLeads((data as Lead[]) || [])
    setLoading(false)
  }

  async function movePainterInteraction(leadId: string, newStatus: string) {
    const lead = leads.find(l => l.id === leadId)
    if (!lead || !painterId || lead._interaction_status === newStatus) return

    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, _interaction_status: newStatus, stage: newStatus } : l))

    const updatePayload: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() }
    if (['proposal_viewed', 'proposal_sent', 'replied', 'declined'].includes(newStatus)) {
      updatePayload[`${newStatus}_at`] = new Date().toISOString()
    }
    await supabase.from('lead_painter_interactions').update(updatePayload).eq('lead_id', leadId).eq('painter_id', painterId)
  }

  async function moveLeadToStage(leadId: string, newStage: string) {
    if (isPainterView) return movePainterInteraction(leadId, newStage)

    const lead = leads.find(l => l.id === leadId)
    if (!lead || lead.stage === newStage) return

    // Optimistic update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage, stage_updated_at: new Date().toISOString() } : l))

    await supabase.from('leads').update({ stage: newStage, stage_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', leadId)

    // Log activity
    await supabase.from('crm_activities').insert({
      lead_id: leadId,
      user_id: user?.id,
      type: 'stage_change',
      title: `Movido para ${STAGES.find(s => s.id === newStage)?.label}`,
      old_stage: lead.stage,
      new_stage: newStage,
    })

    // If moved to 'won' → auto-create client
    if (newStage === 'won') {
      await supabase.from('crm_clients').insert({
        assigned_to: user?.id,
        lead_id: leadId,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        neighborhood: lead.neighborhood,
      })
      await supabase.from('leads').update({ converted_to_client_at: new Date().toISOString() }).eq('id', leadId)
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveLead(leads.find(l => l.id === event.active.id) || null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveLead(null)
    const { active, over } = event
    if (!over) return
    const overId = String(over.id)
    const targetStage = stages.find(s => s.id === overId || leads.find(l => l.id === overId && l.stage === s.id))
    if (targetStage) moveLeadToStage(String(active.id), targetStage.id)
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return
    const overLead = leads.find(l => l.id === over.id)
    if (overLead && overLead.stage !== leads.find(l => l.id === active.id)?.stage) {
      setLeads(prev => prev.map(l => l.id === active.id ? { ...l, stage: overLead.stage } : l))
    }
  }

  const filteredLeads = (isPainterView || filterSource === 'all') ? leads : leads.filter(l => l.source === filterSource)
  const leadsBy = (stageId: string) => filteredLeads.filter(l => l.stage === stageId)
  const totalValue = leads.filter(l => l.stage === 'won').reduce((s, l) => s + (l.estimated_value || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="px-4 h-14 flex items-center justify-between max-w-full">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-gray-400 hover:text-brand"><ArrowLeft className="w-5 h-5" /></Link>
            <div>
              <p className="font-bold text-gray-900 text-sm">{isPainterView ? 'Meus Leads' : 'CRM — Pipeline de Leads'}</p>
              <p className="text-xs text-gray-400">
                {isPainterView ? `${leads.length} leads recebidos` : `${leads.length} leads · Ganhos: ${formatCurrency(totalValue)}`}
              </p>
            </div>
          </div>
          {!isPainterView && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand bg-white">
                  <option value="all">Todas as origens</option>
                  <option value="chat">Chat</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="web">Web</option>
                  <option value="instagram">Globe</option>
                </select>
              </div>
              <button onClick={() => setAddingToStage('new')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#FF7A30] to-brand text-white text-xs font-semibold rounded-xl cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> Novo lead
              </button>
            </div>
          )}
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto pb-6">
          <DndContext sensors={sensors} collisionDetection={closestCenter}
            onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragOver={handleDragOver}>
            <div className="flex gap-3 p-4 min-w-max">
              {stages.map(stage => (
                <StageColumn key={stage.id} stage={stage} leads={leadsBy(stage.id)}
                  onAddLead={isPainterView ? undefined : setAddingToStage} painterView={isPainterView} />
              ))}
            </div>
            <DragOverlay>
              {activeLead && <LeadCard lead={activeLead} isDragging painterView={isPainterView} />}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      <AnimatePresence>
        {addingToStage && (
          <AddLeadModal
            initialStage={addingToStage}
            onClose={() => setAddingToStage(null)}
            onSaved={(lead) => { setLeads(prev => [lead, ...prev]); setAddingToStage(null) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
