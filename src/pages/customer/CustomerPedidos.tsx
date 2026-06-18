import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ChevronDown, ChevronUp, MapPin, CheckCircle, Clock,
  MessageSquare, User, Phone, Paintbrush, Plus, Pencil,
  X, Save, Loader2, History, Send,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCustomerContext, type CustomerLead } from './CustomerLayout'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'
import { cn, formatDate, formatCurrency } from '../../lib/utils'

type Interaction = CustomerLead['lead_painter_interactions'][number]

// ─── Lead Edit Modal ──────────────────────────────────────────────────────────

interface EditLeadModalProps {
  lead: CustomerLead
  onClose: () => void
  onSaved: (updated: Partial<CustomerLead>) => void
}

function EditLeadModal({ lead, onClose, onSaved }: EditLeadModalProps) {
  const { user } = useAuth()
  const [neighborhood, setNeighborhood] = useState(lead.neighborhood ?? '')
  const [areaM2, setAreaM2] = useState(String(lead.area_m2 ?? ''))
  const [numRooms, setNumRooms] = useState(String(lead.num_rooms ?? ''))
  const [deadline, setDeadline] = useState(lead.deadline ?? '')
  const [material, setMaterial] = useState(lead.material ?? '')
  const [finalNotes, setFinalNotes] = useState(lead.final_notes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const updates: Partial<CustomerLead> = {
      neighborhood: neighborhood || null,
      area_m2: areaM2 ? parseFloat(areaM2) : null,
      num_rooms: numRooms ? parseInt(numRooms) : null,
      deadline: deadline || null,
      material: material || null,
      final_notes: finalNotes || null,
    }

    const oldValues: Record<string, unknown> = {
      neighborhood: lead.neighborhood,
      area_m2: lead.area_m2,
      num_rooms: lead.num_rooms,
      deadline: lead.deadline,
      material: lead.material,
      final_notes: lead.final_notes,
    }

    await supabase.from('leads').update(updates).eq('id', lead.id)

    await supabase.from('lead_history').insert({
      lead_id: lead.id,
      changed_by: user?.id ?? null,
      old_values: oldValues,
      new_values: updates,
      change_note: 'Editado pelo cliente',
    })

    if (user) {
      await logAudit({
        actor_user_id: user.id,
        entity_type: 'lead',
        entity_id: lead.id,
        action: 'lead_stage_changed',
        old_values: oldValues,
        new_values: updates as Record<string, unknown>,
      })
    }

    setSaving(false)
    setSaved(true)
    onSaved(updates)
    setTimeout(() => { setSaved(false); onClose() }, 900)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">Editar pedido</h3>
            <p className="text-xs text-gray-400 font-mono">{lead.protocol}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="flex items-start gap-2 bg-blue-50 rounded-xl px-3 py-2.5">
            <History className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">Alterações são registradas no histórico do pedido.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Metragem (m²)</label>
              <input type="number" value={areaM2} onChange={e => setAreaM2(e.target.value)} min="1" step="0.5"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Cômodos</label>
              <input type="number" value={numRooms} onChange={e => setNumRooms(e.target.value)} min="1" step="1"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Bairro</label>
            <input type="text" value={neighborhood} onChange={e => setNeighborhood(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Prazo desejado</label>
            <input type="text" value={deadline} onChange={e => setDeadline(e.target.value)}
              placeholder="Ex: Próximas 2 semanas"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Material</label>
            <select value={material} onChange={e => setMaterial(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand bg-white">
              <option value="">Não informado</option>
              <option value="Incluso no serviço">Incluso no serviço</option>
              <option value="Cliente fornece">Cliente fornece</option>
              <option value="Pintor sugere">Pintor sugere</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Observações</label>
            <textarea value={finalNotes} onChange={e => setFinalNotes(e.target.value)} rows={3}
              placeholder="Detalhes adicionais para o pintor..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand resize-none" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <motion.button type="submit" disabled={saving}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="flex-1 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
              {saved ? <><CheckCircle className="w-4 h-4" /> Salvo!</>
                : saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                : <><Save className="w-4 h-4" /> Salvar</>}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ─── Proposal Card ────────────────────────────────────────────────────────────

type ConvMsg = { id: string; sender_role: 'customer' | 'painter'; body: string; created_at: string }

function ProposalCard({ interaction, onSelect }: { interaction: Interaction; onSelect: (id: string) => void }) {
  const painter = interaction.painter
  const quote = interaction.metadata?.quote
  const isAccepted = interaction.status === 'accepted'

  // Chat state (must be before any early return)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ConvMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chatOpen) return
    supabase.from('lead_conversation_messages').select('*')
      .eq('interaction_id', interaction.id).order('created_at')
      .then(({ data }) => setChatMessages((data || []) as ConvMsg[]))

    const channel = supabase.channel(`conv-customer-${interaction.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'pintae',
        table: 'lead_conversation_messages',
        filter: `interaction_id=eq.${interaction.id}`,
      }, payload => {
        setChatMessages(prev => {
          if (prev.some(m => m.id === (payload.new as ConvMsg).id)) return prev
          return [...prev, payload.new as ConvMsg]
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [chatOpen, interaction.id])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  async function sendChatMessage() {
    const body = chatInput.trim()
    if (!body || chatSending) return
    setChatInput('')
    setChatSending(true)
    await supabase.from('lead_conversation_messages').insert({
      interaction_id: interaction.id,
      sender_role: 'customer',
      body,
    })
    setChatSending(false)
  }

  if (interaction.status !== 'proposal_sent' && !isAccepted) return null

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-xl border overflow-hidden', isAccepted ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-white')}>
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 text-sm truncate">
              {isAccepted ? (painter?.user?.name ?? 'Pintor') : `Pintor ${painter?.specialties?.[0] ?? 'Qualificado'}`}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {painter?.years_experience ? <span className="text-xs text-gray-400">{painter.years_experience} anos de exp.</span> : null}
              {painter?.kyc_status === 'approved' && (
                <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">Verificado</span>
              )}
            </div>
          </div>
          {isAccepted && (
            <span className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-medium shrink-0 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Contratado
            </span>
          )}
        </div>

        {painter?.specialties && painter.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {painter.specialties.slice(0, 3).map(s => (
              <span key={s} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{s}</span>
            ))}
          </div>
        )}

        {quote && (
          <div className="space-y-1.5 mb-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Preço total</span>
              <span className="font-bold text-gray-900">{formatCurrency(quote.total_price)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-400">Material</span>
              <span className="text-xs text-gray-700">{quote.includes_material ? 'Incluso' : 'Não incluso'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-400">Prazo de execução</span>
              <span className="text-xs text-gray-700">{quote.duration_days} dias</span>
            </div>
            {quote.payment_terms && (
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Pagamento</span>
                <span className="text-xs text-gray-700 text-right max-w-[60%]">{quote.payment_terms}</span>
              </div>
            )}
            {quote.notes && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-0.5">Obs. do pintor</p>
                <p className="text-xs text-gray-600">{quote.notes}</p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          {isAccepted && painter?.user?.phone && (
            <a href={`https://wa.me/55${painter.user.phone.replace(/\D/g, '')}?text=Olá! Vi sua proposta no Pintai e gostaria de agendar o serviço.`}
              target="_blank" rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors">
              <Phone className="w-3.5 h-3.5" /> WhatsApp do pintor
            </a>
          )}
          {!isAccepted && (
            <motion.button onClick={() => onSelect(interaction.id)}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="w-full py-2.5 bg-brand text-white text-sm font-semibold rounded-xl cursor-pointer">
              Selecionar esta proposta
            </motion.button>
          )}
          <button onClick={() => setChatOpen(v => !v)}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
            <MessageSquare className="w-3.5 h-3.5" />
            {chatOpen ? 'Fechar conversa' : 'Conversar com o pintor'}
            {chatMessages.length > 0 && !chatOpen && (
              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-semibold">
                {chatMessages.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Chat panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="border-t border-gray-100 overflow-hidden">
            <div className="px-4 py-3 space-y-3 max-h-64 overflow-y-auto bg-gray-50">
              {chatMessages.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">
                  Tire suas dúvidas diretamente com o pintor.
                </p>
              )}
              {chatMessages.map(m => (
                <div key={m.id} className={`flex gap-2 ${m.sender_role === 'customer' ? 'justify-end' : 'justify-start'}`}>
                  {m.sender_role === 'painter' && (
                    <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3 h-3 text-brand" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                    m.sender_role === 'customer'
                      ? 'bg-brand text-white rounded-br-sm'
                      : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'
                  }`}>
                    <p>{m.body}</p>
                    <p className={`text-[10px] mt-0.5 ${m.sender_role === 'customer' ? 'text-white/60' : 'text-gray-400'}`}>
                      {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>
            <div className="border-t border-gray-200 px-4 py-3 flex gap-2 bg-white">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage() } }}
                placeholder="Sua mensagem..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand"
              />
              <button onClick={sendChatMessage} disabled={chatSending || !chatInput.trim()}
                className="w-8 h-8 bg-brand text-white rounded-xl flex items-center justify-center disabled:opacity-40 cursor-pointer shrink-0">
                {chatSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Lead Card ────────────────────────────────────────────────────────────────

function LeadCard({ lead: initialLead }: { lead: CustomerLead }) {
  const { selectProposal } = useCustomerContext()
  const [lead, setLead] = useState(initialLead)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)

  const proposals = lead.lead_painter_interactions.filter(
    i => i.status === 'proposal_sent' || i.status === 'accepted'
  )
  const accepted = lead.lead_painter_interactions.find(i => i.status === 'accepted')

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <button onClick={() => setOpen(v => !v)}
          className="w-full flex items-start justify-between gap-3 p-5 cursor-pointer hover:bg-gray-50/50 transition-colors text-left">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-xs font-mono text-gray-400">{lead.protocol}</span>
              {accepted ? (
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Contratado</span>
              ) : proposals.length > 0 ? (
                <span className="text-xs px-2 py-0.5 bg-brand/10 text-brand rounded-full font-medium">
                  {proposals.length} proposta{proposals.length > 1 ? 's' : ''}
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Aguardando pintores
                </span>
              )}
            </div>
            <p className="font-medium text-gray-800 text-sm">
              {lead.service_interest ?? 'Pintura'}
              {lead.neighborhood ? ` · ${lead.neighborhood}` : ''}
            </p>
            {(lead.area_m2 || lead.num_rooms) && (
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {lead.area_m2 ? `${lead.area_m2} m²` : ''}
                {lead.area_m2 && lead.num_rooms ? ' · ' : ''}
                {lead.num_rooms ? `${lead.num_rooms} cômodo${lead.num_rooms > 1 ? 's' : ''}` : ''}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400">{formatDate(lead.created_at)}</p>
            <div className="mt-1">
              {open ? <ChevronUp className="w-4 h-4 text-gray-400 ml-auto" />
                : <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />}
            </div>
          </div>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sua solicitação</p>
                    {!accepted && (
                      <button onClick={() => setEditing(true)}
                        className="flex items-center gap-1 text-xs text-brand hover:text-orange-700 cursor-pointer transition-colors">
                        <Pencil className="w-3 h-3" /> Editar
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    {lead.property_type && <><span className="text-gray-400">Imóvel</span><span className="text-gray-700">{lead.property_type}</span></>}
                    {lead.wall_condition && <><span className="text-gray-400">Paredes</span><span className="text-gray-700">{lead.wall_condition}</span></>}
                    {lead.deadline && <><span className="text-gray-400">Prazo</span><span className="text-gray-700">{lead.deadline}</span></>}
                    {lead.material && <><span className="text-gray-400">Material</span><span className="text-gray-700">{lead.material}</span></>}
                    {lead.preferred_professional && <><span className="text-gray-400">Profissional</span><span className="text-gray-700">{lead.preferred_professional}</span></>}
                    {lead.current_color && <><span className="text-gray-400">Cor atual</span><span className="text-gray-700">{lead.current_color}</span></>}
                    {lead.estimated_budget && <><span className="text-gray-400">Orçamento esp.</span><span className="text-gray-700">{lead.estimated_budget}</span></>}
                    {lead.calc_price_min && lead.calc_price_max && (
                      <><span className="text-gray-400">Estimativa Pintai</span>
                      <span className="text-gray-700 font-medium">
                        {formatCurrency(lead.calc_price_min)} – {formatCurrency(lead.calc_price_max)}
                      </span></>
                    )}
                  </div>
                  {lead.final_notes && (
                    <div className="mt-2 bg-gray-50 rounded-xl p-2.5">
                      <p className="text-xs text-gray-400 mb-0.5">Observações</p>
                      <p className="text-xs text-gray-700">{lead.final_notes}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Propostas dos pintores ({proposals.length})
                  </p>
                  {proposals.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
                      <MessageSquare className="w-4 h-4 shrink-0" />
                      Nenhuma proposta ainda. Os pintores estão avaliando sua solicitação.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {lead.lead_painter_interactions.map(interaction => (
                        <ProposalCard key={interaction.id} interaction={interaction}
                          onSelect={iId => selectProposal(lead.id, iId)} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {editing && (
          <EditLeadModal lead={lead} onClose={() => setEditing(false)}
            onSaved={updates => setLead(prev => ({ ...prev, ...updates }))} />
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CustomerPedidos() {
  const { leads, loading } = useCustomerContext()

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Meus Pedidos</h1>
            <p className="text-gray-500 text-sm mt-1">Todos os seus pedidos de pintura.</p>
          </div>
          {leads.length > 0 && (
            <span className="text-xs text-gray-400">{leads.length} pedido{leads.length > 1 ? 's' : ''}</span>
          )}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        whileHover={{ scale: 1.01 }}>
        <Link to="/chat" className="flex items-center justify-between bg-brand rounded-2xl p-4 mb-6 group">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Plus className="w-4 h-4 text-white" />
            </div>
            <p className="font-semibold text-white text-sm">Fazer novo pedido</p>
          </div>
          <span className="text-white/70 text-xs group-hover:text-white transition-colors">Via chat com Koke →</span>
        </Link>
      </motion.div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Paintbrush className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Nenhum pedido ainda.</p>
          <p className="text-gray-400 text-xs mt-1">Use o chat para solicitar um orçamento grátis!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map(lead => <LeadCard key={lead.id} lead={lead} />)}
        </div>
      )}
    </div>
  )
}
