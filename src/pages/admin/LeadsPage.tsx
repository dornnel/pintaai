import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import {
  Search, Send, Clock, Eye, MessageCircle,
  Mail, Image as ImageIcon, FileText, MapPin, Wrench, AlertCircle, ChevronLeft,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn, formatRelativeTime } from '../../lib/utils'
import { SendToPaintersModal } from '../../components/admin/SendToPaintersModal'

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
  is_partial?: boolean
  abandoned_step?: string
  tracking_data?: Record<string, unknown>
}

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

const STEP_LABELS: Record<string, string> = {
  role_select: 'Seleção de papel (cliente/pintor)',
  service_type: 'Tipo de serviço',
  property_type: 'Tipo de imóvel',
  lead_name: 'Nome',
  lead_email: 'E-mail',
  lead_whatsapp: 'WhatsApp',
  neighborhood: 'Bairro',
  area_m2: 'Metragem',
  media_upload: 'Fotos do local',
  wall_condition: 'Estado das paredes',
  deadline: 'Prazo',
  material: 'Material',
  preferred_professional: 'Profissional preferido',
  estimated_budget: 'Orçamento estimado',
  current_color: 'Cor atual',
  final_notes: 'Observações finais',
  confirmation: 'Confirmação',
  painter_neighborhoods: 'Bairros atendidos (pintor)',
  painter_specialties: 'Especialidades (pintor)',
  painter_experience: 'Experiência (pintor)',
}

function stepLabel(key?: string): string {
  if (!key) return 'Início'
  return STEP_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function LeadsPage() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [sending, setSending] = useState<Lead | null>(null)
  const [showPartial, setShowPartial] = useState(false)
  const [partialLeads, setPartialLeads] = useState<Lead[]>([])
  const [partialLoading, setPartialLoading] = useState(false)
  const [partialCount, setPartialCount] = useState(0)

  useEffect(() => {
    loadLeads()
    loadPartialCount()

    const channel = supabase.channel('leads-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'pintae', table: 'leads' },
        (payload) => {
          const lead = payload.new as Lead
          if (!lead.is_partial) setLeads(prev => [lead, ...prev])
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'pintae', table: 'leads' },
        (payload) => setLeads(prev => prev.map(l => l.id === payload.new.id ? payload.new as Lead : l)))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (showPartial && partialLeads.length === 0) loadPartialLeads()
  }, [showPartial]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadLeads() {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('is_partial', false)
      .order('created_at', { ascending: false })
    setLeads((data as Lead[]) || [])
    setLoading(false)
  }

  async function loadPartialLeads() {
    setPartialLoading(true)
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('is_partial', true)
      .order('created_at', { ascending: false })
    setPartialLeads((data as Lead[]) || [])
    setPartialLoading(false)
  }

  async function loadPartialCount() {
    const { count } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('is_partial', true)
    setPartialCount(count || 0)
  }

  const funnelSteps = Object.entries(
    partialLeads.reduce<Record<string, number>>((acc, l) => {
      const key = l.abandoned_step || 'início'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

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

  // ── Incomplete conversations view ──────────────────────────────────────────
  if (showPartial) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setShowPartial(false)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Conversas incompletas</h1>
            <p className="text-sm text-gray-500 mt-0.5">{partialLeads.length} sessão(ões) abandonada(s)</p>
          </div>
        </div>

        {/* Abandonment funnel */}
        {funnelSteps.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Funil de abandono — onde as pessoas desistem</p>
            <div className="flex flex-wrap gap-2">
              {funnelSteps.map(([key, count]) => (
                <div key={key} className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                  <span className="text-sm font-bold text-amber-800">{count}</span>
                  <span className="text-xs text-amber-700">{stepLabel(key)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Partial leads list */}
        {partialLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded animate-pulse border border-gray-100" />)}</div>
        ) : partialLeads.length === 0 ? (
          <div className="bg-white rounded border border-gray-100 p-12 text-center">
            <AlertCircle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Nenhuma conversa incompleta.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {partialLeads.map(lead => {
              const tracking = lead.tracking_data || {}
              return (
                <div key={lead.id} className="bg-white rounded border border-gray-100">
                  <div className="p-4 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-xs font-mono font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded">{lead.protocol || 'PT-???'}</span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                          Parou em: {stepLabel(lead.abandoned_step)}
                        </span>
                        <span className="text-xs text-gray-300">{formatRelativeTime(lead.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap text-sm mb-1">
                        <p className="font-semibold text-gray-900">{lead.name || 'Nome não informado'}</p>
                        {lead.neighborhood && <span className="text-xs text-gray-500"><MapPin className="w-3 h-3 inline mr-0.5" />{lead.neighborhood}</span>}
                        {lead.service_interest && <span className="text-xs text-gray-500"><Wrench className="w-3 h-3 inline mr-0.5" />{lead.service_interest}</span>}
                      </div>
                      {(!!tracking.city || !!tracking.device || !!tracking.utm_source) && (
                        <div className="flex gap-3 flex-wrap text-[10px] text-gray-400">
                          {!!tracking.city && <span>📍 {String(tracking.city)}</span>}
                          {!!tracking.device && <span>📱 {String(tracking.device)}</span>}
                          {!!tracking.utm_source && <span>🔗 {String(tracking.utm_source)}</span>}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {lead.phone && (
                        <a href={`https://wa.me/55${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                          className="w-7 h-7 flex items-center justify-center rounded bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {lead.email && (
                        <a href={`mailto:${lead.email}`}
                          className="w-7 h-7 flex items-center justify-center rounded bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors">
                          <Mail className="w-3.5 h-3.5" />
                        </a>
                      )}
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
      </div>
    )
  }

  // ── Main leads view ────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Solicitações (Leads)</h1>
          <p className="text-sm text-gray-500 mt-0.5">{leads.length} lead{leads.length !== 1 ? 's' : ''} · {counts['new'] || 0} novo{(counts['new'] || 0) !== 1 ? 's' : ''}</p>
        </div>
        {partialCount > 0 && (
          <button
            onClick={() => setShowPartial(true)}
            className="flex items-center gap-1.5 text-sm text-amber-600 font-medium bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors"
          >
            <AlertCircle className="w-4 h-4" />
            Conversas incompletas ({partialCount})
          </button>
        )}
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
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded animate-pulse border border-gray-100" />)}</div>
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
                      <a href={`https://wa.me/55${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
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
