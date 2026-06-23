import { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  ArrowLeft, Phone, Mail, MessageCircle, Send, CheckCircle,
  Image as ImageIcon, ChevronDown, ChevronUp, Sparkles, Loader2,
  Calendar, X, Bot, User, AlertTriangle, Calculator, Check, Plus,
  FileText, Activity, Play, Mic, Map,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatDate, formatRelativeTime, formatCurrency } from '../../lib/utils'
import { calculateDivergence, BUDGET_ERROR_CATEGORIES } from '../../lib/budgetEngine'
import { SendToPaintersModal } from '../../components/admin/SendToPaintersModal'
import type { Neighborhood } from '../../lib/types'

const LeadCoverageMap = lazy(() =>
  import('../../components/LeadCoverageMap').then(m => ({ default: m.LeadCoverageMap }))
)

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string; protocol: string; name: string; phone?: string; email?: string
  source: string; service_interest?: string; neighborhood?: string
  property_type?: string; wall_condition?: string; deadline?: string; material?: string
  final_notes?: string; media_urls?: string[]; notes_media_urls?: string[]
  ai_briefing?: string; ai_price_min?: number; ai_price_max?: number
  ai_sentiment?: string; ai_client_profile?: string
  email_confirmation_sent?: boolean; sent_to_painters_at?: string
  stage: string; stage_updated_at: string; notes?: string; tags: string[]
  created_at: string; service_request_id?: string
  area_m2?: number; preferred_professional?: string; current_color?: string; estimated_budget?: string
  calc_price_min?: number; calc_price_max?: number; calc_confidence?: string; calc_explanation?: string
  distribution_mode?: string; max_proposals?: number; proposals_received_count?: number; proposals_closed?: boolean
}

interface LeadMessage {
  id: string; direction: string; channel: string; body: string
  media_url?: string; created_at: string; metadata?: Record<string, unknown>
}

interface PainterInteraction {
  id: string; painter_id: string; status: string
  notified_at: string; email_opened_at?: string; proposal_viewed_at?: string
  proposal_sent_at?: string; replied_at?: string; declined_at?: string
  painter: { id: string; neighborhoods_ids?: string[]; service_radius_km?: number; user: { name: string; phone: string } }
}

interface VisitSchedule {
  id: string; type: string; scheduled_at: string; duration_minutes: number
  location_notes?: string; notes?: string; status: string
  confirmed_by_painter: boolean; confirmed_by_customer: boolean
  painter?: { user: { name: string } }
}

interface Painter { id: string; user: { name: string; phone: string } }
interface AIMessage { role: 'user' | 'assistant'; content: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES: Record<string, { label: string; color: string }> = {
  new: { label: 'Novo', color: 'bg-gray-100 text-gray-700' },
  contacted: { label: 'Contatado', color: 'bg-blue-100 text-blue-700' },
  qualified: { label: 'Qualificado', color: 'bg-violet-100 text-violet-700' },
  proposal_sent: { label: 'Proposta Enviada', color: 'bg-yellow-100 text-yellow-700' },
  won: { label: 'Ganho', color: 'bg-green-100 text-green-700' },
  lost: { label: 'Perdido', color: 'bg-red-100 text-red-600' },
}

const SOURCE_ICONS: Record<string, string> = {
  chat: '💬', whatsapp: '📱', web: '🌐', instagram: '📸', admin: '🔧',
}

const VISIT_TYPES = [
  { value: 'technical_visit', label: '🔍 Visita técnica' },
  { value: 'service_start', label: '🎨 Início do serviço' },
  { value: 'service_end', label: '✅ Conclusão do serviço' },
  { value: 'follow_up', label: '📞 Follow-up' },
]

const BENCHMARK: Record<string, { m2Labor: [number, number]; m2Full: [number, number]; hourly: [number, number] }> = {
  'Pintura interna':  { m2Labor: [18, 32], m2Full: [45, 80],  hourly: [35, 55] },
  'Pintura externa':  { m2Labor: [22, 40], m2Full: [50, 95],  hourly: [40, 65] },
  'Fachada':          { m2Labor: [25, 50], m2Full: [60, 110], hourly: [45, 80] },
  'Textura':          { m2Labor: [30, 60], m2Full: [65, 120], hourly: [50, 90] },
  'Pós-obra':         { m2Labor: [25, 45], m2Full: [55, 100], hourly: [40, 70] },
  'Arte / mural':     { m2Labor: [60, 150], m2Full: [80, 180], hourly: [60, 120] },
  'Impermeabilização':{ m2Labor: [30, 65], m2Full: [70, 130], hourly: [50, 85] },
}

const INTERACTION_STEPS = [
  { key: 'notified_at',       label: 'Notificado',         icon: '📨' },
  { key: 'email_opened_at',   label: 'Email aberto',        icon: '📧' },
  { key: 'proposal_viewed_at',label: 'Proposta visualizada',icon: '👀' },
  { key: 'proposal_sent_at',  label: 'Proposta enviada',    icon: '📝' },
  { key: 'replied_at',        label: 'Respondeu',           icon: '✅' },
] as const

// ─── Media helpers ──────────────────────────────────────────────────────────

const VIDEO_EXT = /\.(mp4|mov|webm|m4v)(\?|$)/i
const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i
const PDF_EXT = /\.pdf(\?|$)/i

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white/70 hover:text-white cursor-pointer"><X className="w-6 h-6" /></button>
      {VIDEO_EXT.test(url) ? (
        <video src={url} controls autoPlay className="max-w-full max-h-full rounded-xl object-contain" onClick={e => e.stopPropagation()} />
      ) : (
        <img src={url} alt="" className="max-w-full max-h-full rounded-xl object-contain" onClick={e => e.stopPropagation()} />
      )}
    </motion.div>
  )
}

// ─── MediaThumb ───────────────────────────────────────────────────────────────

function MediaThumb({ url, onOpen }: { url: string; onOpen: () => void }) {
  if (VIDEO_EXT.test(url)) {
    return (
      <button onClick={onOpen}
        className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 hover:opacity-90 transition-opacity cursor-pointer bg-black">
        <video src={url} muted className="w-full h-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Play className="w-6 h-6 text-white" />
        </div>
      </button>
    )
  }
  if (AUDIO_EXT.test(url)) {
    return (
      <div className="aspect-square rounded-xl border border-gray-200 bg-gray-50 p-2 flex flex-col items-center justify-center gap-1.5">
        <Mic className="w-5 h-5 text-brand" />
        <audio src={url} controls className="w-full max-w-full" style={{ height: 28 }} />
      </div>
    )
  }
  if (PDF_EXT.test(url)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="aspect-square rounded-xl border border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-1.5 hover:bg-gray-100 transition-colors">
        <FileText className="w-5 h-5 text-brand" />
        <span className="text-[10px] text-gray-500">Abrir PDF</span>
      </a>
    )
  }
  return (
    <button onClick={onOpen}
      className="aspect-square rounded-xl overflow-hidden border border-gray-200 hover:opacity-90 transition-opacity cursor-pointer">
      <img src={url} alt="" className="w-full h-full object-cover" />
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()

  const [lead, setLead] = useState<Lead | null>(null)
  const [messages, setMessages] = useState<LeadMessage[]>([])
  const [interactions, setInteractions] = useState<PainterInteraction[]>([])
  const [schedules, setSchedules] = useState<VisitSchedule[]>([])
  const [availablePainters, setAvailablePainters] = useState<Painter[]>([])
  const [loading, setLoading] = useState(true)

  // UI state
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [showSendModal, setShowSendModal] = useState(false)
  const [briefingExpanded, setBriefingExpanded] = useState(false)
  const [showScheduleForm, setShowScheduleForm] = useState(false)

  // Schedule form
  const [schedType, setSchedType] = useState('technical_visit')
  const [schedPainter, setSchedPainter] = useState('')
  const [schedAt, setSchedAt] = useState('')
  const [schedDuration, setSchedDuration] = useState(60)
  const [schedNotes, setSchedNotes] = useState('')
  const [savingSched, setSavingSched] = useState(false)

  // AI chat
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const aiBottomRef = useRef<HTMLDivElement>(null)

  // Budget comparison
  const [painterPrice, setPainterPrice] = useState('')
  const [showDivModal, setShowDivModal] = useState(false)
  const [divCategory, setDivCategory] = useState('')
  const [divReason, setDivReason] = useState('')
  const [savingDiv, setSavingDiv] = useState(false)
  const [divSaved, setDivSaved] = useState(false)

  // Stage
  const [savingStage, setSavingStage] = useState(false)

  // Comments
  const [comments, setComments] = useState<{ id: string; body: string; user: { name: string } | null; created_at: string }[]>([])
  const [commentInput, setCommentInput] = useState('')
  const [savingComment, setSavingComment] = useState(false)

  // Geolocation
  const [liveViewers, setLiveViewers] = useState<string[]>([]) // painter_ids currently viewing
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([])
  const [showMap, setShowMap] = useState(false)

  const loadAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [leadRes, msgRes, interRes, schedRes, paintRes, commentsRes, nbhdRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase.from('messages').select('*').filter('metadata->>lead_id', 'eq', id).order('created_at'),
      supabase.from('lead_painter_interactions')
        .select('*, painter:painters(id, neighborhoods_ids, service_radius_km, user:users!painters_user_id_fkey(name,phone))')
        .eq('lead_id', id).order('notified_at'),
      supabase.from('visit_schedules')
        .select('*, painter:painters(user:users!painters_user_id_fkey(name))')
        .eq('lead_id', id).order('scheduled_at'),
      supabase.from('painters').select('id, user:users!painters_user_id_fkey(name,phone)').eq('availability_status', 'available'),
      supabase.from('lead_comments').select('id, body, created_at, user:users(name)').eq('lead_id', id).order('created_at'),
      supabase.from('neighborhoods').select('id,name,city,region,latitude,longitude,active,launch_priority').eq('active', true),
    ])
    if (leadRes.data) setLead(leadRes.data as Lead)
    setMessages((msgRes.data || []) as LeadMessage[])
    setInteractions((interRes.data as unknown as PainterInteraction[]) || [])
    setSchedules((schedRes.data as unknown as VisitSchedule[]) || [])
    setAvailablePainters((paintRes.data as unknown as Painter[]) || [])
    setComments((commentsRes.data as unknown as { id: string; body: string; user: { name: string } | null; created_at: string }[]) || [])
    setNeighborhoods((nbhdRes.data as unknown as Neighborhood[]) || [])
    setLoading(false)
  }, [id])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { aiBottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [aiMessages])

  // Real-time: reload interactions when any painter responds
  useEffect(() => {
    if (!id) return
    const channel = supabase.channel(`lead-interactions-${id}`)
      .on('postgres_changes', {
        event: '*', schema: 'pintae', table: 'lead_painter_interactions',
        filter: `lead_id=eq.${id}`,
      }, () => { loadAll() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id, loadAll])

  // Presence: track which painters are viewing this lead right now
  useEffect(() => {
    if (!id) return
    const channel = supabase.channel(`lead-presence-${id}`)
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ painter_id: string }>()
        setLiveViewers(Object.values(state).flat().map(p => p.painter_id).filter(Boolean))
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        setLiveViewers(prev => {
          const ids = (newPresences as unknown as { painter_id: string }[]).map(p => p.painter_id)
          return [...new Set([...prev, ...ids])]
        })
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const ids = new Set((leftPresences as unknown as { painter_id: string }[]).map(p => p.painter_id))
        setLiveViewers(prev => prev.filter(id => !ids.has(id)))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  async function changeStage(stage: string) {
    if (!lead) return
    setSavingStage(true)
    await supabase.from('leads').update({ stage, stage_updated_at: new Date().toISOString() }).eq('id', lead.id)
    setLead(prev => prev ? { ...prev, stage } : prev)
    setSavingStage(false)
  }

  async function markInteraction(interactionId: string, field: string) {
    await supabase.from('lead_painter_interactions').update({
      [field]: new Date().toISOString(),
      status: field.replace('_at', ''),
      updated_at: new Date().toISOString(),
    }).eq('id', interactionId)
    loadAll()
  }

  async function addComment() {
    if (!id || !commentInput.trim()) return
    setSavingComment(true)
    const body = commentInput.trim()
    setCommentInput('')
    const { data } = await supabase.from('lead_comments')
      .insert({ lead_id: id, body })
      .select('id, body, created_at, user:users(name)')
      .single()
    if (data) setComments(prev => [...prev, data as unknown as { id: string; body: string; user: { name: string } | null; created_at: string }])
    setSavingComment(false)
  }

  async function saveSchedule() {
    if (!id || !schedAt) return
    setSavingSched(true)
    await supabase.from('visit_schedules').insert({
      lead_id: id,
      painter_id: schedPainter || null,
      type: schedType,
      scheduled_at: schedAt,
      duration_minutes: schedDuration,
      notes: schedNotes || null,
    })
    setShowScheduleForm(false)
    setSchedAt(''); setSchedNotes(''); setSchedPainter('')
    setSavingSched(false)
    loadAll()
  }

  async function sendAiMessage() {
    if (!aiInput.trim() || !lead) return
    const userMsg: AIMessage = { role: 'user', content: aiInput }
    const newMsgs = [...aiMessages, userMsg]
    setAiMessages(newMsgs); setAiInput(''); setAiLoading(true)

    const systemContext = `Você é um assistente especialista em pintura e negociação. Analise esta solicitação e ajude o admin a tomar decisões.\n\nLEAD: ${lead.protocol} — ${lead.name}\nServiço: ${lead.service_interest}\nBairro: ${lead.neighborhood}\nImóvel: ${lead.property_type || '?'}\nParedes: ${lead.wall_condition || '?'}\nPrazo: ${lead.deadline || '?'}\nMaterial: ${lead.material || '?'}\nEstimativa IA: R$${lead.ai_price_min || '?'}–R$${lead.ai_price_max || '?'}\nBriefing: ${lead.ai_briefing || 'N/A'}\nObs cliente: ${lead.final_notes || 'N/A'}`

    try {
      const { data } = await supabase.functions.invoke('agent-chat', {
        body: {
          messages: [
            { role: 'system', content: systemContext },
            ...newMsgs.map(m => ({ role: m.role, content: m.content })),
          ],
          adminMode: true,
        },
      })
      const reply = data?.message || data?.content || data?.reply || 'Sem resposta da IA.'
      setAiMessages(prev => [...prev, { role: 'assistant', content: String(reply) }])
    } catch {
      setAiMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao conectar com a IA. Verifique as configurações da edge function.' }])
    }
    setAiLoading(false)
  }

  async function saveDivergence() {
    if (!lead || !divCategory || !divReason.trim()) return
    setSavingDiv(true)
    const aiMin = lead.ai_price_min ?? 0, aiMax = lead.ai_price_max ?? 0
    const painterNum = Number(painterPrice) || 0
    const divergence = calculateDivergence(aiMin, aiMax, painterNum)
    await supabase.from('budget_ai_adjustments').insert({
      lead_id: lead.id, field_adjusted: 'price',
      ai_value: `R$${aiMin}–R$${aiMax}`, painter_value: `R$${painterNum}`,
      difference_percent: divergence, error_category: divCategory, reason: divReason, created_by: 'admin',
    })
    await supabase.from('leads').update({ estimated_value: painterNum }).eq('id', lead.id)
    setSavingDiv(false); setDivSaved(true); setShowDivModal(false)
    setTimeout(() => setDivSaved(false), 3000)
  }

  if (loading) return (
    <div className="p-6 space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
    </div>
  )
  if (!lead) return (
    <div className="p-6 text-center text-gray-400">
      <p>Solicitação não encontrada.</p>
      <Link to="/admin/leads" className="text-brand hover:underline text-sm mt-2 inline-block">← Voltar</Link>
    </div>
  )

  const allMedia = [...(lead.media_urls || []), ...(lead.notes_media_urls || [])]
  const aiMin = lead.ai_price_min ?? 0, aiMax = lead.ai_price_max ?? 0
  const painterNum = Number(painterPrice) || 0
  const divergence = painterNum > 0 ? calculateDivergence(aiMin, aiMax, painterNum) : 0
  const highDiv = Math.abs(divergence) > 15

  const matchedBenchmark = Object.entries(BENCHMARK).find(([key]) =>
    lead.service_interest?.toLowerCase().includes(key.toLowerCase())
  )?.[1]

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start gap-4 mb-6">
        <Link to="/admin/leads" className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors shrink-0 mt-0.5">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono font-bold text-brand text-lg">{lead.protocol}</span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STAGES[lead.stage]?.color || 'bg-gray-100 text-gray-600'}`}>
              {STAGES[lead.stage]?.label || lead.stage}
            </span>
            <span className="text-xs text-gray-400">{SOURCE_ICONS[lead.source] || '🌐'} {lead.source}</span>
            <span className="text-xs text-gray-300">{formatRelativeTime(lead.created_at)}</span>
          </div>
          <p className="text-gray-600 text-sm">{lead.name} · {lead.service_interest} · {lead.neighborhood}</p>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* ── LEFT COLUMN ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* 1. Dados do cliente + serviço */}
          <section className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><User className="w-4 h-4 text-brand" /> Cliente e Serviço</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div><p className="text-xs text-gray-400 mb-0.5">Nome</p><p className="font-semibold text-gray-900">{lead.name}</p></div>
              {lead.phone && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">WhatsApp</p>
                  <a href={`https://wa.me/55${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                    className="font-medium text-green-600 hover:underline flex items-center gap-1">
                    <Phone className="w-3 h-3" />{lead.phone}
                  </a>
                </div>
              )}
              {lead.email && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Email</p>
                  <p className="font-medium text-gray-800 text-xs truncate">{lead.email}</p>
                  {lead.email_confirmation_sent !== undefined && (
                    <span className={`text-[10px] ${lead.email_confirmation_sent ? 'text-green-600' : 'text-yellow-600'}`}>
                      {lead.email_confirmation_sent ? '✅ Confirmado' : '⏳ Pendente'}
                    </span>
                  )}
                </div>
              )}
              {lead.neighborhood && <div><p className="text-xs text-gray-400 mb-0.5">Bairro</p><p className="font-medium">{lead.neighborhood}</p></div>}
              {lead.service_interest && <div><p className="text-xs text-gray-400 mb-0.5">Serviço</p><p className="font-medium">{lead.service_interest}</p></div>}
              {lead.property_type && <div><p className="text-xs text-gray-400 mb-0.5">Imóvel</p><p className="font-medium">{lead.property_type}</p></div>}
              {lead.wall_condition && <div><p className="text-xs text-gray-400 mb-0.5">Paredes</p><p className="font-medium">{lead.wall_condition}</p></div>}
              {lead.deadline && <div><p className="text-xs text-gray-400 mb-0.5">Prazo</p><p className="font-medium">{lead.deadline}</p></div>}
              {lead.material && <div><p className="text-xs text-gray-400 mb-0.5">Material</p><p className="font-medium">{lead.material}</p></div>}
              {lead.area_m2 != null && <div><p className="text-xs text-gray-400 mb-0.5">Metragem (m²)</p><p className="font-medium">{lead.area_m2} m²</p></div>}
              {lead.current_color && <div><p className="text-xs text-gray-400 mb-0.5">Cor atual</p><p className="font-medium">{lead.current_color}</p></div>}
              {lead.preferred_professional && <div><p className="text-xs text-gray-400 mb-0.5">Profissional preferido</p><p className="font-medium">{lead.preferred_professional}</p></div>}
              <div><p className="text-xs text-gray-400 mb-0.5">Criado em</p><p className="font-medium text-xs">{formatDate(lead.created_at)}</p></div>
            </div>
            {lead.estimated_budget && (
              <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
                <p className="text-xs text-blue-700 font-bold mb-0.5">💭 Cliente espera pagar (faixa informada por ele)</p>
                <p className="text-sm font-medium text-gray-800">{lead.estimated_budget}</p>
                <p className="text-[10px] text-blue-500 mt-0.5">Não é a estimativa técnica — veja "Estimativa calculada" abaixo.</p>
              </div>
            )}
            {lead.final_notes && (
              <div className="mt-4 bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3">
                <p className="text-xs font-bold text-yellow-700 mb-1">💬 Observações do cliente</p>
                <p className="text-sm text-gray-700 italic">"{lead.final_notes}"</p>
              </div>
            )}
            {lead.ai_briefing && (
              <div className="mt-4">
                <button onClick={() => setBriefingExpanded(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 mb-2 cursor-pointer hover:text-blue-800">
                  <Sparkles className="w-3.5 h-3.5" /> Briefing IA
                  {briefingExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                <AnimatePresence>
                  {briefingExpanded && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                      <p className="text-xs text-gray-700 bg-blue-50 border border-blue-100 rounded-xl p-4 leading-relaxed">{lead.ai_briefing}</p>
                      {lead.ai_client_profile && (
                        <p className="text-xs text-gray-600 bg-violet-50 border border-violet-100 rounded-xl p-3 mt-2">
                          <strong>Perfil:</strong> {lead.ai_client_profile}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </section>

          {/* 1.5 Estimativa calculada (motor de regras) */}
          {(lead.calc_price_min != null || lead.calc_price_max != null) && (
            <section className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-brand" /> Estimativa calculada (motor de regras)
              </h2>
              <p className="text-lg font-bold text-gray-900">
                R$ {lead.calc_price_min?.toLocaleString('pt-BR')} – R$ {lead.calc_price_max?.toLocaleString('pt-BR')}
              </p>
              <p className="text-xs text-gray-500 mt-1">Confiança: {lead.calc_confidence || '—'}</p>
              {lead.calc_explanation && <p className="text-xs text-gray-400 mt-2 italic">{lead.calc_explanation}</p>}
            </section>
          )}

          {/* 2. Chat que gerou o lead */}
          {messages.length > 0 && (
            <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-brand" />
                <h2 className="text-sm font-bold text-gray-700">Histórico do Chat ({messages.length} mensagens)</h2>
              </div>
              <div className="p-4 max-h-96 overflow-y-auto space-y-3">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs rounded-2xl px-3.5 py-2.5 text-sm ${
                      msg.direction === 'outbound'
                        ? 'bg-brand text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                    }`}>
                      {msg.media_url && (
                        <img src={msg.media_url} alt="" className="w-40 h-28 object-cover rounded-xl mb-2 cursor-pointer"
                          onClick={() => setLightboxUrl(msg.media_url!)} />
                      )}
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                      <p className={`text-[10px] mt-1 ${msg.direction === 'outbound' ? 'text-white/60' : 'text-gray-400'}`}>
                        {SOURCE_ICONS[msg.channel] || '💬'} {formatRelativeTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 3. Galeria de mídias */}
          {allMedia.length > 0 && (
            <section className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-brand" /> Mídias enviadas ({allMedia.length})
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {allMedia.map((url, i) => (
                  <MediaThumb key={i} url={url} onOpen={() => setLightboxUrl(url)} />
                ))}
              </div>
            </section>
          )}

          {/* 4. Motor de orçamento IA vs Pintor */}
          {(aiMin > 0 || aiMax > 0) && (
            <section className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-brand" /> Comparação IA vs. Pintor
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1">⚡ Estimativa IA (interna)</p>
                  <p className="text-base font-bold text-gray-900">
                    {aiMin > 0 ? `R$ ${aiMin.toLocaleString('pt-BR')} – R$ ${aiMax.toLocaleString('pt-BR')}` : '—'}
                  </p>
                  <p className="text-[10px] text-amber-600 mt-1">Não compartilhar com o cliente</p>
                </div>
                <div className={`border rounded-xl p-4 ${divSaved ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1">✅ Validação do pintor</p>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">R$</span>
                    <input type="number" value={painterPrice} onChange={e => setPainterPrice(e.target.value)}
                      placeholder="0,00" className="flex-1 bg-transparent text-base font-bold text-gray-900 outline-none w-full" />
                  </div>
                  {painterNum > 0 && (
                    <p className={`text-[10px] mt-1 font-medium ${Math.abs(divergence) > 15 ? 'text-red-600' : 'text-green-600'}`}>
                      {divergence > 0 ? '+' : ''}{divergence}% vs IA
                    </p>
                  )}
                </div>
              </div>
              {highDiv && painterNum > 0 && !divSaved && (
                <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <p className="text-xs text-red-700 font-medium">Divergência de {Math.abs(divergence)}% — registre o motivo</p>
                  </div>
                  <button onClick={() => setShowDivModal(true)}
                    className="text-xs text-red-700 font-bold border border-red-200 px-2.5 py-1 rounded-lg cursor-pointer hover:bg-red-100 shrink-0">
                    Registrar
                  </button>
                </div>
              )}
              {divSaved && (
                <p className="text-xs text-green-600 font-medium flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" /> Validação registrada com sucesso
                </p>
              )}
            </section>
          )}

          {/* 5. Chat IA */}
          <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Bot className="w-4 h-4 text-violet-600" />
              <h2 className="text-sm font-bold text-gray-700">Análise com IA</h2>
              <span className="text-xs text-gray-400 ml-auto">Pergunte sobre o projeto, argumente preço, identifique riscos</span>
            </div>
            <div className="min-h-32 max-h-80 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {aiMessages.length === 0 && (
                <div className="text-center py-8">
                  <Bot className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">Faça uma pergunta sobre este lead</p>
                  <div className="flex flex-wrap gap-2 justify-center mt-3">
                    {['Como argumentar o preço?', 'Quais riscos deste projeto?', 'Qual pintor indicar?'].map(q => (
                      <button key={q} onClick={() => { setAiInput(q) }}
                        className="text-xs bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 cursor-pointer hover:border-violet-300 hover:text-violet-700">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {aiMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-sm rounded-2xl px-4 py-3 text-sm ${
                    msg.role === 'user' ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-800'
                  }`}>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                    <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={aiBottomRef} />
            </div>
            <div className="p-3 border-t border-gray-100 flex gap-2">
              <input value={aiInput} onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiMessage() } }}
                placeholder="Pergunte sobre este lead..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400 resize-none" />
              <button onClick={sendAiMessage} disabled={aiLoading || !aiInput.trim()}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-violet-600 text-white cursor-pointer disabled:opacity-40 hover:bg-violet-700 transition-colors shrink-0">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </section>
        </div>

        {/* ── SIDEBAR ── */}
        <div className="space-y-4">

          {/* Estimativa IA */}
          {(aiMin > 0 || aiMax > 0) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Estimativa IA
              </h3>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(aiMin)} – {formatCurrency(aiMax)}
              </p>
              {lead.ai_sentiment && (
                <p className="text-xs text-gray-500 mt-1">
                  {lead.ai_sentiment === 'positive' ? '😊 Positivo' : lead.ai_sentiment === 'negative' ? '😟 Negativo' : '😐 Neutro'}
                </p>
              )}
            </div>
          )}

          {/* Pintores — painel em tempo real */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-brand" /> Pintores em Tempo Real
              </h3>
              <button onClick={() => setShowSendModal(true)}
                className="text-xs text-brand font-semibold flex items-center gap-1 cursor-pointer hover:text-brand-dark">
                <Plus className="w-3 h-3" /> Enviar
              </button>
            </div>

            {/* Live counter */}
            {interactions.length > 0 && (() => {
              const evaluating = interactions.filter(i => i.status === 'notified').length
              const interested = interactions.filter(i => i.status === 'interested').length
              const withProposal = interactions.filter(i => i.status === 'proposal_sent').length
              const declined = interactions.filter(i => i.status === 'declined').length
              return (
                <div className="flex gap-2 flex-wrap mb-3 pb-3 border-b border-gray-50">
                  {liveViewers.length > 0 && (
                    <span className="flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1.5 rounded-lg font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      {liveViewers.length} vendo agora
                    </span>
                  )}
                  {evaluating > 0 && (
                    <span className="flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 px-2.5 py-1.5 rounded-lg font-medium">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      {evaluating} avaliando
                    </span>
                  )}
                  {interested > 0 && (
                    <span className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 px-2.5 py-1.5 rounded-lg font-medium">
                      {interested} interessado{interested !== 1 ? 's' : ''}
                    </span>
                  )}
                  {withProposal > 0 && (
                    <span className="flex items-center gap-1.5 text-xs bg-green-50 text-green-700 px-2.5 py-1.5 rounded-lg font-medium">
                      {withProposal} proposta{withProposal !== 1 ? 's' : ''} enviada{withProposal !== 1 ? 's' : ''}
                    </span>
                  )}
                  {declined > 0 && (
                    <span className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-500 px-2.5 py-1.5 rounded-lg font-medium">
                      {declined} recusou
                    </span>
                  )}
                </div>
              )
            })()}

            {interactions.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-gray-400">Nenhum pintor notificado ainda.</p>
                <button onClick={() => setShowSendModal(true)}
                  className="text-xs text-brand mt-2 cursor-pointer hover:underline">Enviar para pintores →</button>
              </div>
            ) : (
              <div className="space-y-2">
                {interactions.map(inter => {
                  const isEvaluating = inter.status === 'notified'
                  const statusColors: Record<string, string> = {
                    notified: 'bg-amber-100 text-amber-700',
                    interested: 'bg-blue-100 text-blue-700',
                    proposal_sent: 'bg-green-100 text-green-700',
                    declined: 'bg-gray-100 text-gray-500',
                    accepted: 'bg-emerald-100 text-emerald-700',
                  }
                  const statusLabels: Record<string, string> = {
                    notified: 'Avaliando...', interested: 'Interessado', proposal_sent: 'Proposta enviada',
                    declined: 'Recusou', accepted: 'Aceitou',
                  }
                  const isLive = liveViewers.includes(inter.painter_id)
                  return (
                    <motion.div key={inter.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      className={`border rounded-xl p-3 transition-colors ${
                        isLive ? 'border-emerald-200 bg-emerald-50/20' :
                        isEvaluating ? 'border-amber-100 bg-amber-50/30' : 'border-gray-100'
                      }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {isLive
                            ? <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Vendo agora" />
                            : isEvaluating
                              ? <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                              : null}
                          <p className="text-sm font-semibold text-gray-800">{inter.painter?.user?.name}</p>
                          {isLive && <span className="text-[10px] text-emerald-600 font-semibold">ao vivo</span>}
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${statusColors[inter.status] || 'bg-gray-100 text-gray-600'}`}>
                          {statusLabels[inter.status] || inter.status}
                        </span>
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        {INTERACTION_STEPS.map(step => {
                          const ts = inter[step.key as keyof PainterInteraction] as string | undefined
                          const isDone = !!ts
                          if (!isDone && step.key !== 'email_opened_at' && step.key !== 'proposal_viewed_at') return null
                          return (
                            <div key={step.key} className="flex items-center justify-between">
                              <span className={`text-[10px] flex items-center gap-1 ${isDone ? 'text-green-600' : 'text-gray-300'}`}>
                                {isDone ? <Check className="w-2.5 h-2.5" /> : <div className="w-2.5 h-2.5 rounded-full border border-gray-200" />}
                                {step.icon} {step.label}
                              </span>
                              {isDone
                                ? <span className="text-[10px] text-gray-400">{formatRelativeTime(ts)}</span>
                                : (
                                  <button onClick={() => markInteraction(inter.id, step.key)}
                                    className="text-[10px] text-blue-600 cursor-pointer hover:underline">Marcar</button>
                                )}
                            </div>
                          )
                        })}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Mapa de cobertura */}
          {interactions.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <button onClick={() => setShowMap(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Map className="w-3.5 h-3.5 text-brand" /> Mapa de Cobertura
                </h3>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showMap ? 'rotate-180' : ''}`} />
              </button>
              {showMap && (
                <div className="px-3 pb-3">
                  <div className="flex flex-wrap gap-1.5 mb-2 text-[10px]">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-brand/80 inline-block" />Cliente</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />Notificado</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />Interessado</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />Proposta</span>
                  </div>
                  <Suspense fallback={<div className="h-[280px] bg-gray-100 rounded-xl animate-pulse" />}>
                    <LeadCoverageMap
                      leadNeighborhoodName={lead?.neighborhood ?? null}
                      neighborhoods={neighborhoods}
                      painters={interactions.map(i => ({
                        painter_id: i.painter_id,
                        name: i.painter?.user?.name ?? 'Pintor',
                        status: i.status,
                        neighborhoods_ids: i.painter?.neighborhoods_ids ?? [],
                        service_radius_km: i.painter?.service_radius_km ?? 5,
                        is_live: liveViewers.includes(i.painter_id),
                      }))}
                    />
                  </Suspense>
                </div>
              )}
            </div>
          )}

          {/* Agendamentos */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand" /> Agendamentos
              </h3>
              <button onClick={() => setShowScheduleForm(v => !v)}
                className="text-xs text-brand font-semibold flex items-center gap-1 cursor-pointer hover:text-brand-dark">
                <Plus className="w-3 h-3" /> Novo
              </button>
            </div>

            {schedules.length === 0 && !showScheduleForm && (
              <p className="text-xs text-gray-400 text-center py-2">Nenhum agendamento.</p>
            )}

            {schedules.map(s => (
              <div key={s.id} className="border border-gray-100 rounded-xl p-3 mb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-800">
                      {VISIT_TYPES.find(v => v.value === s.type)?.label || s.type}
                    </p>
                    {s.painter?.user?.name && <p className="text-[11px] text-gray-500">{s.painter.user.name}</p>}
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {new Date(s.scheduled_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      {' · '}{s.duration_minutes}min
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    s.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                    s.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                    s.status === 'canceled' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                  }`}>{s.status}</span>
                </div>
                {s.notes && <p className="text-[11px] text-gray-400 mt-1 italic">{s.notes}</p>}
              </div>
            ))}

            <AnimatePresence>
              {showScheduleForm && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="border border-blue-100 bg-blue-50 rounded-xl p-3 space-y-3 overflow-hidden">
                  <p className="text-xs font-semibold text-blue-800">Novo agendamento</p>
                  <select value={schedType} onChange={e => setSchedType(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:border-brand">
                    {VISIT_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </select>
                  <select value={schedPainter} onChange={e => setSchedPainter(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:border-brand">
                    <option value="">Pintor (opcional)</option>
                    {[...interactions.map(i => i.painter), ...availablePainters.filter(p => !interactions.find(i => i.painter_id === p.id))]
                      .filter(Boolean).map(p => (
                        <option key={p!.id} value={p!.id}>{p!.user?.name}</option>
                      ))}
                  </select>
                  <input type="datetime-local" value={schedAt} onChange={e => setSchedAt(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:border-brand" />
                  <select value={schedDuration} onChange={e => setSchedDuration(Number(e.target.value))}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:border-brand">
                    <option value={30}>30 minutos</option>
                    <option value={60}>1 hora</option>
                    <option value={120}>2 horas</option>
                    <option value={180}>3 horas</option>
                  </select>
                  <textarea value={schedNotes} onChange={e => setSchedNotes(e.target.value)}
                    placeholder="Observações (opcional)" rows={2}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:border-brand resize-none" />
                  <div className="flex gap-2">
                    <button onClick={() => setShowScheduleForm(false)}
                      className="flex-1 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 cursor-pointer bg-white">Cancelar</button>
                    <button onClick={saveSchedule} disabled={!schedAt || savingSched}
                      className="flex-1 py-2 text-xs bg-brand text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50">
                      {savingSched ? 'Salvando...' : 'Agendar'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Benchmark de Precificação */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-brand" /> Referência de Mercado
            </h3>
            {matchedBenchmark ? (
              <div className="space-y-2 text-xs">
                <p className="font-semibold text-gray-700 mb-2">{lead.service_interest} — Florianópolis</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Mão de obra /m²</p>
                    <p className="font-bold text-gray-900">R${matchedBenchmark.m2Labor[0]}–{matchedBenchmark.m2Labor[1]}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Com material /m²</p>
                    <p className="font-bold text-gray-900">R${matchedBenchmark.m2Full[0]}–{matchedBenchmark.m2Full[1]}</p>
                  </div>
                </div>
                <div className="bg-orange-50 border border-orange-100 rounded-lg p-2">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Por hora (ref. sindical)</p>
                  <p className="font-bold text-brand">R${matchedBenchmark.hourly[0]}–{matchedBenchmark.hourly[1]}/h</p>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Fonte: SINDUSCON-SC + fóruns de pintores profissionais. O pintor define o preço final.</p>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Selecione um tipo de serviço no lead para ver a referência de mercado.</p>
            )}
          </div>

          {/* Distribution mode */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Distribuição</h3>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500 mb-1">Modo</p>
                <select value={lead.distribution_mode || 'auto'}
                  onChange={async (e) => {
                    await supabase.from('leads').update({ distribution_mode: e.target.value }).eq('id', lead.id)
                    loadAll()
                  }}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand bg-white cursor-pointer">
                  <option value="auto">Automático (geo + round-robin)</option>
                  <option value="admin_managed">Manual (admin seleciona)</option>
                  <option value="premium">Premium (concierge)</option>
                </select>
              </div>
              {lead.proposals_received_count != null && (
                <div className="flex items-center justify-between text-xs py-1.5">
                  <span className="text-gray-500">Propostas recebidas</span>
                  <span className="font-semibold text-gray-900">{lead.proposals_received_count}/{lead.max_proposals || 3}</span>
                </div>
              )}
              {lead.proposals_closed && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5 text-center font-medium">Limite de propostas atingido</p>
              )}
            </div>
          </div>

          {/* Ações rápidas */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Ações rápidas</h3>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500 mb-1">Estágio</p>
                <select value={lead.stage} onChange={e => changeStage(e.target.value)} disabled={savingStage}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand bg-white cursor-pointer disabled:opacity-50">
                  {Object.entries(STAGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <button onClick={() => setShowSendModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand/10 text-brand text-sm font-semibold rounded-xl cursor-pointer hover:bg-brand/20 transition-colors">
                <Send className="w-3.5 h-3.5" /> Enviar para pintores
              </button>
              {lead.phone && (
                <a href={`https://wa.me/55${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-50 text-green-700 text-sm font-semibold rounded-xl hover:bg-green-100 transition-colors">
                  <Phone className="w-3.5 h-3.5" /> WhatsApp direto
                </a>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}?subject=Solicitação ${lead.protocol}`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-100 transition-colors">
                  <Mail className="w-3.5 h-3.5" /> Enviar email
                </a>
              )}
            </div>
          </div>

          {/* Comentários internos */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-brand" /> Comentários internos
            </h3>
            <div className="space-y-3 mb-3 max-h-48 overflow-y-auto">
              {comments.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">Nenhum comentário ainda.</p>
              )}
              {comments.map(c => (
                <div key={c.id} className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-brand text-[10px] font-bold shrink-0">
                    {c.user?.name?.[0]?.toUpperCase() || 'A'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 mb-0.5">
                      <span className="text-[10px] font-semibold text-gray-700">{c.user?.name || 'Admin'}</span>
                      <span className="text-[10px] text-gray-400">{formatRelativeTime(c.created_at)}</span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <textarea
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addComment() }}
                placeholder="Adicionar comentário... (Cmd+Enter para enviar)"
                rows={2}
                className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-brand"
              />
              <button onClick={addComment} disabled={!commentInput.trim() || savingComment}
                className="px-3 py-2 bg-brand text-white rounded-xl text-xs font-semibold disabled:opacity-50 cursor-pointer hover:bg-orange-600 transition-colors flex items-center">
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
        {showSendModal && (
          <SendToPaintersModal lead={lead} onClose={() => setShowSendModal(false)} onSent={loadAll} />
        )}
        {showDivModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowDivModal(false)}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Registrar divergência de orçamento</h3>
                <button onClick={() => setShowDivModal(false)} className="text-gray-400 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-4">
                <div className="text-xs text-gray-500">
                  <p>IA: <strong>R${aiMin.toLocaleString()} – R${aiMax.toLocaleString()}</strong></p>
                  <p>Pintor: <strong>R${painterNum.toLocaleString()}</strong> ({divergence > 0 ? '+' : ''}{divergence}%)</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Categoria</label>
                  <select value={divCategory} onChange={e => setDivCategory(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand bg-white">
                    <option value="">Selecione...</option>
                    {BUDGET_ERROR_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Explicação</label>
                  <textarea value={divReason} onChange={e => setDivReason(e.target.value)} rows={3} resize-none
                    placeholder="Ex: Havia móveis pesados que a IA não considerou..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand resize-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowDivModal(false)}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 cursor-pointer">Cancelar</button>
                  <button onClick={saveDivergence} disabled={savingDiv || !divCategory || !divReason.trim()}
                    className="flex-1 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl cursor-pointer disabled:opacity-50">
                    {savingDiv ? 'Salvando...' : 'Registrar'}
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
