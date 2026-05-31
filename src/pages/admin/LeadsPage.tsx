import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Search, Send, CheckCircle, Clock, Eye, MessageCircle,
  Mail, Image as ImageIcon, FileText, MapPin, Wrench, X, AlertTriangle, Calculator,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn, formatDate, formatRelativeTime } from '../../lib/utils'
import { calculateDivergence, BUDGET_ERROR_CATEGORIES } from '../../lib/budgetEngine'

interface Lead {
  id: string
  protocol: string
  name: string
  phone?: string
  email?: string
  source: string
  service_interest?: string
  neighborhood?: string
  property_type?: string
  wall_condition?: string
  deadline?: string
  material?: string
  final_notes?: string
  media_urls?: string[]
  notes_media_urls?: string[]
  ai_briefing?: string
  ai_price_min?: number
  ai_price_max?: number
  ai_sentiment?: string
  email_confirmation_sent?: boolean
  sent_to_painters_at?: string
  stage: string
  stage_updated_at: string
  notes?: string
  tags: string[]
  created_at: string
}

interface Painter { id: string; user: { name: string; phone: string } }

const STAGES: Record<string, { label: string; color: string }> = {
  new: { label: 'Novo', color: 'bg-gray-100 text-gray-700' },
  contacted: { label: 'Contatado', color: 'bg-blue-100 text-blue-700' },
  qualified: { label: 'Qualificado', color: 'bg-violet-100 text-violet-700' },
  proposal_sent: { label: 'Proposta Enviada', color: 'bg-yellow-100 text-yellow-700' },
  won: { label: 'Ganho', color: 'bg-green-100 text-green-700' },
  lost: { label: 'Perdido', color: 'bg-red-100 text-red-600' },
}

const SOURCE_LABELS: Record<string, string> = {
  chat: '💬 Chat', whatsapp: '📱 WhatsApp', web: '🌐 Web',
  instagram: '📸 Instagram', admin: '🔧 Admin',
}

function SendToPaintersModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [painters, setPainters] = useState<Painter[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.from('painters').select('id, user:users(name,phone)').eq('availability_status', 'available').then(({ data }) => {
      setPainters((data as unknown as Painter[]) || [])
    })
  }, [])

  async function send() {
    setSending(true)

    // Mensagem anonimizada — sem PII do cliente
    const briefing = (() => {
      if (lead.ai_briefing) return lead.ai_briefing
      try {
        const notes = JSON.parse(lead.notes || '{}')
        return `${lead.service_interest} · Paredes: ${notes.wall_condition || lead.wall_condition || '?'} · Prazo: ${notes.deadline || lead.deadline || '?'}`
      } catch {
        return `${lead.service_interest} em ${lead.neighborhood}`
      }
    })()

    const priceEstimate = lead.ai_price_min
      ? `R$ ${lead.ai_price_min?.toLocaleString('pt-BR')} – R$ ${lead.ai_price_max?.toLocaleString('pt-BR')}`
      : 'A calcular'

    const anonymizedBody =
      `🎨 Nova oportunidade — ${lead.protocol}\n\n` +
      `📍 ${lead.neighborhood} · ${lead.property_type || ''}\n` +
      `🛠 ${lead.service_interest}\n` +
      (lead.wall_condition ? `🧱 Paredes: ${lead.wall_condition}\n` : '') +
      (lead.deadline ? `⏱ Prazo: ${lead.deadline}\n` : '') +
      (lead.material ? `🪣 Material: ${lead.material}\n` : '') +
      `💰 Estimativa IA: ${priceEstimate}\n\n` +
      `📝 ${briefing}\n` +
      (lead.final_notes ? `💬 Obs do cliente: ${lead.final_notes}\n` : '') +
      `\nAcesse o Portal do Pintor para ver detalhes e enviar proposta.`

    await Promise.all(Array.from(selected).map(painterId =>
      supabase.from('messages').insert({
        channel: 'admin',
        direction: 'outbound',
        body: anonymizedBody,
        metadata: { lead_id: lead.id, painter_id: painterId, action: 'lead_sent_to_painter', protocol: lead.protocol },
      })
    ))

    await supabase.from('leads').update({
      stage: 'proposal_sent',
      stage_updated_at: new Date().toISOString(),
      sent_to_painters_at: new Date().toISOString(),
    }).eq('id', lead.id)

    setDone(true)
    setSending(false)
    setTimeout(onClose, 1500)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        {done ? (
          <div className="text-center py-4">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <p className="font-semibold text-gray-900">Enviado para {selected.size} pintor{selected.size !== 1 ? 'es' : ''}!</p>
            <p className="text-xs text-gray-400 mt-1">Dados do cliente anonimizados na mensagem.</p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-900">Enviar para pintores</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  <span className="font-mono text-brand">{lead.protocol}</span> · {lead.service_interest} · {lead.neighborhood}
                </p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 text-xs text-amber-700">
              🔒 A mensagem será enviada <strong>sem dados pessoais</strong> do cliente — só briefing técnico e estimativa.
            </div>

            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
              {painters.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Nenhum pintor disponível</p>}
              {painters.map(p => (
                <label key={p.id} className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${selected.has(p.id) ? 'border-brand bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="checkbox" checked={selected.has(p.id)}
                    onChange={e => setSelected(prev => { const s = new Set(prev); e.target.checked ? s.add(p.id) : s.delete(p.id); return s })}
                    className="accent-brand w-4 h-4" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.user?.name}</p>
                    <p className="text-xs text-gray-400">{p.user?.phone}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded text-sm text-gray-600 cursor-pointer">Cancelar</button>
              <button onClick={send} disabled={sending || selected.size === 0}
                className="flex-1 py-2.5 bg-brand text-white rounded text-sm font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                {sending ? 'Enviando...' : <><Send className="w-3.5 h-3.5" /> Enviar ({selected.size})</>}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

function LeadDetail({ lead }: { lead: Lead }) {
  const allMediaUrls = [...(lead.media_urls || []), ...(lead.notes_media_urls || [])]
  const notes = (() => {
    try { return JSON.parse(lead.notes || '{}') } catch { return {} }
  })()

  return (
    <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
      {/* Solicitante */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Solicitante</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div><p className="text-gray-400">Nome</p><p className="font-semibold text-gray-900">{lead.name}</p></div>
          {lead.email && <div>
            <p className="text-gray-400">E-mail</p>
            <p className="font-medium text-gray-800">{lead.email}</p>
            {lead.email_confirmation_sent !== undefined && (
              <span className={`text-[10px] ${lead.email_confirmation_sent ? 'text-green-600' : 'text-yellow-600'}`}>
                {lead.email_confirmation_sent ? '✅ Email enviado' : '⏳ Pendente'}
              </span>
            )}
          </div>}
          {lead.phone && <div>
            <p className="text-gray-400">WhatsApp</p>
            <a href={`https://wa.me/55${lead.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
              className="font-medium text-brand hover:underline">{lead.phone}</a>
          </div>}
          <div><p className="text-gray-400">Protocolo</p>
            <span className="font-mono font-bold text-brand bg-orange-50 px-1.5 py-0.5 rounded text-xs">{lead.protocol}</span>
          </div>
          <div><p className="text-gray-400">Cadastrado</p><p className="font-medium">{formatDate(lead.created_at)}</p></div>
          {lead.sent_to_painters_at && <div><p className="text-gray-400">Enviado pintores</p><p className="font-medium">{formatDate(lead.sent_to_painters_at)}</p></div>}
        </div>
      </div>

      {/* Serviço */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Serviço</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div><p className="text-gray-400">Tipo</p><p className="font-medium">{lead.service_interest}</p></div>
          <div><p className="text-gray-400">Bairro</p><p className="font-medium">{lead.neighborhood}</p></div>
          {(lead.property_type || notes.property_type) && <div><p className="text-gray-400">Imóvel</p><p className="font-medium">{lead.property_type || notes.property_type}</p></div>}
          {(lead.wall_condition || notes.wall_condition) && <div><p className="text-gray-400">Paredes</p><p className="font-medium">{lead.wall_condition || notes.wall_condition}</p></div>}
          {(lead.deadline || notes.deadline) && <div><p className="text-gray-400">Prazo</p><p className="font-medium">{lead.deadline || notes.deadline}</p></div>}
          {(lead.material || notes.material) && <div><p className="text-gray-400">Material</p><p className="font-medium">{lead.material || notes.material}</p></div>}
        </div>
      </div>

      {/* Briefing IA */}
      {lead.ai_briefing && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Briefing técnico (IA)</p>
          <p className="text-xs text-gray-700 bg-blue-50 border border-blue-100 rounded-lg p-3 leading-relaxed">
            {lead.ai_briefing}
          </p>
          {lead.ai_price_min && (
            <p className="text-xs font-semibold text-brand mt-1.5">
              💰 Estimativa IA: R$ {lead.ai_price_min?.toLocaleString('pt-BR')} – R$ {lead.ai_price_max?.toLocaleString('pt-BR')}
            </p>
          )}
        </div>
      )}

      {/* Observações finais */}
      {lead.final_notes && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Observações do cliente</p>
          <p className="text-xs text-gray-700 bg-yellow-50 border border-yellow-100 rounded-lg p-3 italic">
            "{lead.final_notes}"
          </p>
        </div>
      )}

      {/* Fotos/vídeos */}
      {allMediaUrls.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
            Fotos/vídeos enviados ({allMediaUrls.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {allMediaUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="block w-20 h-20 rounded-xl overflow-hidden border border-gray-200 hover:opacity-90 transition-opacity">
                <img src={url} alt="" className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Motor de Orçamento IA vs Pintor */}
      {(lead.ai_price_min || lead.ai_price_max) && (
        <BudgetComparisonPanel lead={lead} />
      )}

      {/* Alterar estágio */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
        <span className="text-xs text-gray-400">Estágio:</span>
        <select defaultValue={lead.stage}
          onChange={async e => {
            await supabase.from('leads').update({ stage: e.target.value, stage_updated_at: new Date().toISOString() }).eq('id', lead.id)
          }}
          className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand bg-white cursor-pointer">
          {Object.entries(STAGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
    </div>
  )
}

// ─── Comparação IA vs Pintor ──────────────────────────────────────────────────

function BudgetComparisonPanel({ lead }: { lead: Lead }) {
  const [painterPrice, setPainterPrice] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [modalCategory, setModalCategory] = useState('')
  const [modalReason, setModalReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const aiMin = lead.ai_price_min ?? 0
  const aiMax = lead.ai_price_max ?? 0
  const painterNum = Number(painterPrice) || 0
  const divergence = painterNum > 0 ? calculateDivergence(aiMin, aiMax, painterNum) : 0
  const highDivergence = Math.abs(divergence) > 15

  async function saveDivergence() {
    if (!modalCategory || !modalReason.trim()) return
    setSaving(true)
    await supabase.from('budget_ai_adjustments').insert({
      lead_id: lead.id,
      field_adjusted: 'price',
      ai_value: `R$ ${aiMin}–R$ ${aiMax}`,
      painter_value: `R$ ${painterNum}`,
      difference_percent: divergence,
      error_category: modalCategory,
      reason: modalReason,
      created_by: 'admin',
    })
    // Salvar preço do pintor no lead
    await supabase.from('leads').update({ estimated_value: painterNum }).eq('id', lead.id)
    setSaving(false)
    setSaved(true)
    setShowModal(false)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="border-t border-gray-100 pt-4">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <Calculator className="w-3.5 h-3.5" /> Motor de Orçamento IA
      </p>

      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Estimativa IA */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1">⚡ Estimativa IA (interna)</p>
          <p className="text-sm font-bold text-gray-900">
            {aiMin > 0 ? `R$ ${aiMin.toLocaleString('pt-BR')} – R$ ${aiMax.toLocaleString('pt-BR')}` : '—'}
          </p>
          <p className="text-[10px] text-amber-600 mt-1">Não compartilhar com o cliente</p>
        </div>

        {/* Validação do pintor */}
        <div className={`border rounded-xl p-3 ${saved ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1">✅ Validação do pintor</p>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">R$</span>
            <input
              type="number"
              value={painterPrice}
              onChange={e => setPainterPrice(e.target.value)}
              placeholder="0,00"
              className="flex-1 bg-transparent text-sm font-bold text-gray-900 outline-none w-full"
            />
          </div>
          {painterNum > 0 && (
            <p className={`text-[10px] mt-1 font-medium ${Math.abs(divergence) > 15 ? 'text-red-600' : 'text-green-600'}`}>
              {divergence > 0 ? '+' : ''}{divergence}% vs IA
            </p>
          )}
        </div>
      </div>

      {/* Alerta de divergência alta */}
      {highDivergence && painterNum > 0 && !saved && (
        <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <p className="text-xs text-red-700 font-medium">Divergência de {Math.abs(divergence)}% — registre o motivo</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="text-xs text-red-700 font-bold border border-red-200 px-2.5 py-1 rounded-lg cursor-pointer hover:bg-red-100 shrink-0">
            Registrar
          </button>
        </div>
      )}

      {saved && (
        <p className="text-xs text-green-600 font-medium flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5" /> Validação registrada com sucesso
        </p>
      )}

      {/* Modal de divergência */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Por que você alterou a análise da IA?</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Estimativa IA: <strong>R$ {aiMin.toLocaleString()} – R$ {aiMax.toLocaleString()}</strong></p>
                  <p className="text-xs text-gray-500">Valor do pintor: <strong>R$ {painterNum.toLocaleString()}</strong> ({divergence > 0 ? '+' : ''}{divergence}%)</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Categoria do erro</label>
                  <select value={modalCategory} onChange={e => setModalCategory(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand bg-white">
                    <option value="">Selecione...</option>
                    {BUDGET_ERROR_CATEGORIES.map(c => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Explicação (obrigatória)</label>
                  <textarea value={modalReason} onChange={e => setModalReason(e.target.value)}
                    placeholder="Ex: Tinha móveis pesados que a IA não considerou..."
                    rows={3}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand resize-none" />
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setShowModal(false)}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 cursor-pointer">
                    Cancelar
                  </button>
                  <button onClick={saveDivergence} disabled={saving || !modalCategory || !modalReason.trim()}
                    className="flex-1 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</> : 'Registrar divergência'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [sending, setSending] = useState<Lead | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    loadLeads()

    const channel = supabase.channel('leads-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'pintae', table: 'leads' },
        (payload) => setLeads(prev => [payload.new as Lead, ...prev]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'pintae', table: 'leads' },
        (payload) => setLeads(prev => prev.map(l => l.id === payload.new.id ? payload.new as Lead : l)))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadLeads() {
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    setLeads((data as Lead[]) || [])
    setLoading(false)
  }

  const filtered = leads.filter(l => {
    const matchSearch = !search ||
      l.protocol?.includes(search.toUpperCase()) ||
      l.name?.toLowerCase().includes(search.toLowerCase()) ||
      l.phone?.includes(search) ||
      l.email?.toLowerCase().includes(search.toLowerCase()) ||
      l.neighborhood?.toLowerCase().includes(search.toLowerCase())
    const matchStage = stageFilter === 'all' || l.stage === stageFilter
    return matchSearch && matchStage
  })

  const counts = Object.fromEntries(Object.keys(STAGES).map(s => [s, leads.filter(l => l.stage === s).length]))

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Solicitações (Leads)</h1>
          <p className="text-sm text-gray-500 mt-0.5">{leads.length} lead{leads.length !== 1 ? 's' : ''} · {counts['new'] || 0} novo{(counts['new'] || 0) !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Stage summary */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
        {Object.entries(STAGES).map(([key, { label, color }]) => (
          <button key={key} onClick={() => setStageFilter(stageFilter === key ? 'all' : key)}
            className={cn('text-center p-2.5 rounded border transition-colors cursor-pointer',
              stageFilter === key ? `${color} border-transparent ring-2 ring-brand` : 'bg-white border-gray-100 hover:border-gray-200')}>
            <p className="text-lg font-bold text-gray-900">{counts[key] || 0}</p>
            <p className="text-[10px] text-gray-500">{label}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por protocolo, nome, email, bairro..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-brand" />
        </div>
        <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
          className="border border-gray-200 rounded text-sm px-3 py-2.5 focus:outline-none focus:border-brand bg-white">
          <option value="all">Todos os estágios</option>
          {Object.entries(STAGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Leads list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-white rounded animate-pulse border border-gray-100" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded border border-gray-100 p-12 text-center">
          <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Nenhuma solicitação encontrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(lead => {
            const allMedia = [...(lead.media_urls || []), ...(lead.notes_media_urls || [])]
            return (
              <div key={lead.id} className="bg-white rounded border border-gray-100">
                <div className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-xs font-mono font-bold text-brand bg-orange-50 px-2 py-0.5 rounded">{lead.protocol || 'PT-???'}</span>
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded', STAGES[lead.stage]?.color || 'bg-gray-100 text-gray-600')}>
                        {STAGES[lead.stage]?.label || lead.stage}
                      </span>
                      <span className="text-xs text-gray-400">{SOURCE_LABELS[lead.source] || lead.source}</span>
                      <span className="text-xs text-gray-300">{formatRelativeTime(lead.created_at)}</span>
                      {lead.email_confirmation_sent && (
                        <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Mail className="w-2.5 h-2.5" /> Email ✓
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 flex-wrap text-sm">
                      <p className="font-semibold text-gray-900">{lead.name}</p>
                      {lead.neighborhood && <span className="text-xs text-gray-500"><MapPin className="w-3 h-3 inline mr-0.5" />{lead.neighborhood}</span>}
                      {lead.service_interest && <span className="text-xs text-gray-500"><Wrench className="w-3 h-3 inline mr-0.5" />{lead.service_interest}</span>}
                      {allMedia.length > 0 && <span className="text-xs text-blue-500"><ImageIcon className="w-3 h-3 inline mr-0.5" />{allMedia.length} foto{allMedia.length !== 1 ? 's' : ''}</span>}
                      {lead.final_notes && <span className="text-xs text-yellow-600"><FileText className="w-3 h-3 inline mr-0.5" />Obs.</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {lead.phone && (
                      <a href={`https://wa.me/55${lead.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                        className="w-7 h-7 flex items-center justify-center rounded bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button onClick={() => setSending(lead)}
                      className="w-7 h-7 flex items-center justify-center rounded bg-brand/10 text-brand hover:bg-brand/20 cursor-pointer transition-colors" title="Enviar para pintores">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setExpanded(expanded === lead.id ? null : lead.id)}
                      className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                <AnimatePresence>
                  {expanded === lead.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                      <LeadDetail lead={lead} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {sending && <SendToPaintersModal lead={sending} onClose={() => { setSending(null); loadLeads() }} />}
      </AnimatePresence>
    </div>
  )
}
