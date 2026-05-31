import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  Search, Send, CheckCircle, Clock, Eye, MessageCircle,
  Mail, Image as ImageIcon, FileText, MapPin, Wrench, X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn, formatRelativeTime } from '../../lib/utils'

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

    const painterIds = Array.from(selected)

    await Promise.all(painterIds.map(painterId =>
      supabase.from('messages').insert({
        channel: 'admin',
        direction: 'outbound',
        body: anonymizedBody,
        metadata: { lead_id: lead.id, painter_id: painterId, action: 'lead_sent_to_painter', protocol: lead.protocol },
      })
    ))

    // Registra interações de rastreio
    await Promise.all(painterIds.map(painterId =>
      supabase.from('lead_painter_interactions').upsert({
        lead_id: lead.id, painter_id: painterId, status: 'notified',
        notified_at: new Date().toISOString(),
      }, { onConflict: 'lead_id,painter_id' })
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

export function LeadsPage() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [sending, setSending] = useState<Lead | null>(null)

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
                    <button onClick={() => navigate(`/admin/leads/${lead.id}`)}
                      title="Ver detalhes"
                      className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

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
