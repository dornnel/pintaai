import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  ArrowLeft, MapPin, Home, Calendar, Package2, Ruler,
  ChevronDown, ChevronUp, Send, CheckCircle, Loader2,
  Pencil, Image as ImageIcon, Zap, Star, FileDown, Eye, History, Info,
  Bot, MessageCircle, User, Paperclip, XCircle, TrendingUp, BarChart2, Lock,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import { useAuth } from '../../lib/auth'
import { BudgetBreakdownModal } from '../../components/BudgetBreakdownModal'

const BENCHMARK: Record<string, { m2Labor: [number,number]; m2Full: [number,number]; hourly: [number,number] }> = {
  'Pintura interna':   { m2Labor: [18,32],  m2Full: [45,80],   hourly: [35,55] },
  'Pintura externa':   { m2Labor: [22,40],  m2Full: [50,95],   hourly: [40,65] },
  'Fachada':           { m2Labor: [25,50],  m2Full: [60,110],  hourly: [45,80] },
  'Textura':           { m2Labor: [30,60],  m2Full: [65,120],  hourly: [50,90] },
  'Pós-obra':          { m2Labor: [25,45],  m2Full: [55,100],  hourly: [40,70] },
  'Arte / mural':      { m2Labor: [60,150], m2Full: [80,180],  hourly: [60,120] },
  'Impermeabilização': { m2Labor: [30,65],  m2Full: [70,130],  hourly: [50,85] },
}

interface Lead {
  id: string
  protocol: string
  name: string | null
  email: string | null
  phone: string | null
  service_interest: string | null
  neighborhood: string | null
  property_type: string | null
  wall_condition: string | null
  deadline: string | null
  material: string | null
  area_m2: number | null
  num_rooms: number | null
  calc_price_min: number | null
  calc_price_max: number | null
  calc_confidence: string | null
  calc_explanation: string | null
  media_urls: string[]
  final_notes: string | null
  ai_briefing: string | null
  created_at: string
  max_proposals: number | null
  proposals_received_count: number | null
  proposals_closed: boolean | null
}

interface Interaction {
  id: string
  lead_id: string
  painter_id: string
  status: string
  metadata: InteractionMetadata
  notified_at: string | null
  proposal_sent_at: string | null
  proposal_viewed_at: string | null
  lead: Lead
}

interface SavedQuote {
  total_price: number
  includes_material: boolean
  duration_days: number
  validity_days: number
  payment_terms: string
  notes: string
  submitted_at?: string
  archived_at?: string
}

interface InteractionMetadata {
  quote?: SavedQuote
  painter_notes?: string
  quote_history?: SavedQuote[]
}

interface ProposalForm {
  total_price: string
  includes_material: boolean
  duration_days: string
  validity_days: string
  payment_terms: string
  notes: string
}

interface ConvMessage {
  id: string
  sender_role: 'customer' | 'painter'
  body: string
  created_at: string
}

interface AgentMsg {
  role: 'user' | 'assistant'
  content: string
}

const CONFIDENCE_CFG: Record<string, { color: string; text: string }> = {
  alta: { color: 'bg-green-100 text-green-700', text: 'Alta confiança' },
  média: { color: 'bg-yellow-100 text-yellow-700', text: 'Confiança média' },
  baixa: { color: 'bg-gray-100 text-gray-600', text: 'Confiança baixa' },
}

export function LeadView() {
  const { interactionId } = useParams<{ interactionId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  // Only treat as admin-readonly when actively operating as admin (activeRole), not when a multi-role user is in painter mode
  const isAdmin = user?.activeRole === 'admin'

  const [interaction, setInteraction] = useState<Interaction | null>(null)
  const [loading, setLoading] = useState(true)
  const [briefingOpen, setBriefingOpen] = useState(false)
  const [mediaOpen, setMediaOpen] = useState(false)
  const [marketOpen, setMarketOpen] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null)

  const [painterNotes, setPainterNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [form, setForm] = useState<ProposalForm>({
    total_price: '',
    includes_material: false,
    duration_days: '5',
    validity_days: '7',
    payment_terms: '50% entrada, 50% na conclusão',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const chatFileRef = useRef<HTMLInputElement>(null)

  // AI agent assistant
  const [agentOpen, setAgentOpen] = useState(false)
  const [agentMessages, setAgentMessages] = useState<AgentMsg[]>([])
  const [agentInput, setAgentInput] = useState('')
  const [agentLoading, setAgentLoading] = useState(false)
  const agentBottomRef = useRef<HTMLDivElement>(null)

  // Customer ↔ painter conversation
  const [convOpen, setConvOpen] = useState(false)
  const [convMessages, setConvMessages] = useState<ConvMessage[]>([])
  const [convInput, setConvInput] = useState('')
  const [convSending, setConvSending] = useState(false)
  const [customerTyping, setCustomerTyping] = useState(false)
  const convBottomRef = useRef<HTMLDivElement>(null)
  const convChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const convTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const customerTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    if (!interactionId) return
    const { data, error } = await supabase
      .from('lead_painter_interactions')
      .select('*, lead:leads(*)')
      .eq('id', interactionId)
      .single()

    if (error || !data) { navigate('/portal/pintor'); return }

    const int = data as unknown as Interaction
    setInteraction(int)
    setPainterNotes(int.metadata?.painter_notes || '')

    const quote = int.metadata?.quote
    if (quote) {
      setForm({
        total_price: String(quote.total_price ?? ''),
        includes_material: Boolean(quote.includes_material),
        duration_days: String(quote.duration_days ?? '5'),
        validity_days: String(quote.validity_days ?? '7'),
        payment_terms: String(quote.payment_terms ?? '50% entrada, 50% na conclusão'),
        notes: String(quote.notes ?? ''),
      })
    }

    const { data: convData } = await supabase
      .from('lead_conversation_messages')
      .select('*')
      .eq('interaction_id', interactionId)
      .order('created_at')
    setConvMessages((convData || []) as ConvMessage[])

    setLoading(false)
  }, [interactionId, navigate])

  useEffect(() => { load() }, [load])

  // Presence: broadcast that this painter is currently viewing the lead
  useEffect(() => {
    if (!interaction || isAdmin) return
    const channel = supabase.channel(`lead-presence-${interaction.lead.id}`)
    channel.subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ painter_id: interaction.painter_id, joined_at: new Date().toISOString() })
      }
    })
    return () => { supabase.removeChannel(channel) }
  }, [interaction, isAdmin])

  // Mark proposal_viewed_at on first open
  useEffect(() => {
    if (!interaction || isAdmin || !interactionId) return
    if (!interaction.proposal_viewed_at) {
      supabase.from('lead_painter_interactions')
        .update({ proposal_viewed_at: new Date().toISOString(), status: interaction.status === 'notified' ? 'interested' : interaction.status })
        .eq('id', interactionId)
        .then(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactionId, isAdmin])

  useEffect(() => { agentBottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [agentMessages])
  useEffect(() => { convBottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [convMessages, customerTyping])

  // Realtime: incoming messages from customer via Broadcast + Postgres Changes
  useEffect(() => {
    if (!interactionId) return

    const channel = supabase.channel(`chat-${interactionId}`, {
      config: { broadcast: { self: false } },
    })
      // New message from customer via Broadcast (zero-latency)
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        const msg = payload as ConvMessage
        setConvMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
      })
      // Typing indicator from customer
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const { role, typing } = payload as { role: string; typing: boolean }
        if (role === 'customer') {
          setCustomerTyping(typing)
          if (typing) {
            clearTimeout(customerTypingTimer.current!)
            customerTypingTimer.current = setTimeout(() => setCustomerTyping(false), 3500)
          }
        }
      })
      // Postgres Changes as WAL fallback
      .on('postgres_changes', {
        event: 'INSERT', schema: 'pintae',
        table: 'lead_conversation_messages',
        filter: `interaction_id=eq.${interactionId}`,
      }, ({ new: row }) => {
        const msg = row as ConvMessage
        setConvMessages(prev => {
          const tempIdx = prev.findIndex(m => m.id.startsWith('temp-') && m.body === msg.body && m.sender_role === msg.sender_role)
          if (tempIdx >= 0) {
            const next = [...prev]; next[tempIdx] = msg; return next
          }
          return prev.some(m => m.id === msg.id) ? prev : [...prev, msg]
        })
      })
      .subscribe()

    convChannelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
      convChannelRef.current = null
      clearTimeout(customerTypingTimer.current!)
    }
  }, [interactionId])

  function buildAgentContext(lead: Lead): string {
    const lines = [
      'Você é um assistente especializado em projetos de pintura para pintores profissionais em Florianópolis, SC.',
      '',
      'Contexto desta solicitação:',
      `• Protocolo: ${lead.protocol}`,
      `• Serviço: ${lead.service_interest ?? 'Não informado'}`,
      `• Bairro: ${lead.neighborhood ?? 'Não informado'}`,
      `• Imóvel: ${lead.property_type ?? 'Não informado'}`,
      `• Estado das paredes: ${lead.wall_condition ?? 'Não informado'}`,
      `• Prazo desejado: ${lead.deadline ?? 'Não informado'}`,
      `• Material: ${lead.material ?? 'Não informado'}`,
    ]
    if (lead.area_m2) lines.push(`• Área: ${lead.area_m2} m²${lead.num_rooms ? ` · ${lead.num_rooms} cômodo${lead.num_rooms > 1 ? 's' : ''}` : ''}`)
    if (lead.calc_price_min && lead.calc_price_max) {
      lines.push(`• Estimativa da plataforma: R$${lead.calc_price_min.toLocaleString('pt-BR')} – R$${lead.calc_price_max.toLocaleString('pt-BR')} (confiança: ${lead.calc_confidence ?? 'baixa'})`)
    }
    if (lead.ai_briefing) lines.push(`• Análise técnica: ${lead.ai_briefing}`)
    if (lead.final_notes) lines.push(`• Observações do cliente: ${lead.final_notes}`)
    lines.push('', 'Ajude o pintor de forma direta e prática. Foque em: materiais necessários, preço justo para Floripa, prazo realista, pontos de atenção. PT-BR.')
    return lines.join('\n')
  }

  async function sendAgentMessage() {
    if (!agentInput.trim() || agentLoading || !interaction) return
    const userMsg: AgentMsg = { role: 'user', content: agentInput }
    const newMsgs = [...agentMessages, userMsg]
    setAgentMessages(newMsgs)
    setAgentInput('')
    setAgentLoading(true)
    try {
      const { data } = await supabase.functions.invoke('agent-chat', {
        body: {
          action: 'assistant',
          messages: [
            { role: 'system', content: buildAgentContext(interaction.lead) },
            ...newMsgs,
          ],
        },
      })
      setAgentMessages(prev => [...prev, { role: 'assistant', content: String(data?.message || 'Sem resposta da IA.') }])
    } catch {
      setAgentMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao conectar com o assistente. Tente novamente.' }])
    }
    setAgentLoading(false)
  }

  function handleConvInputChange(value: string) {
    setConvInput(value)
    if (!convChannelRef.current) return
    convChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { role: 'painter', typing: true } })
    clearTimeout(convTypingTimer.current!)
    convTypingTimer.current = setTimeout(() => {
      convChannelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { role: 'painter', typing: false } })
    }, 2000)
  }

  async function sendConvMessage() {
    const body = convInput.trim()
    if (!body || convSending || !interactionId) return

    // Stop typing broadcast
    clearTimeout(convTypingTimer.current!)
    convChannelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { role: 'painter', typing: false } })

    // Optimistic update
    const tempId = `temp-${Date.now()}`
    const tempMsg: ConvMessage = { id: tempId, sender_role: 'painter', body, created_at: new Date().toISOString() }
    setConvMessages(prev => [...prev, tempMsg])
    setConvInput('')
    setConvSending(true)

    const { data } = await supabase
      .from('lead_conversation_messages')
      .insert({ interaction_id: interactionId, sender_role: 'painter', body })
      .select()
      .single()

    if (data) {
      setConvMessages(prev => prev.map(m => m.id === tempId ? data as ConvMessage : m))
      convChannelRef.current?.send({ type: 'broadcast', event: 'message', payload: data })
    }
    setConvSending(false)
  }

  function handleNotesChange(value: string) {
    setPainterNotes(value)
    setNotesSaved(false)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(async () => {
      if (!interactionId || !interaction) return
      setNotesSaving(true)
      await supabase.from('lead_painter_interactions').update({
        metadata: { ...interaction.metadata, painter_notes: value } as Record<string, unknown>,
      }).eq('id', interactionId)
      setNotesSaving(false)
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    }, 2000)
  }

  function acceptPlatformPrice() {
    const lead = interaction?.lead
    if (!lead?.calc_price_min || !lead?.calc_price_max) return
    const mid = Math.round((lead.calc_price_min + lead.calc_price_max) / 2)
    setForm(f => ({ ...f, total_price: String(mid) }))
  }

  async function submitProposal(e: React.FormEvent) {
    e.preventDefault()
    if (!interactionId || !interaction) return
    const lead = interaction.lead
    if (lead.proposals_closed && !isResending) {
      setFeedbackToast('Este lead já atingiu o limite de propostas.')
      setTimeout(() => setFeedbackToast(null), 4000)
      return
    }
    setSubmitting(true)
    const quote: SavedQuote = {
      total_price: parseFloat(form.total_price),
      includes_material: form.includes_material,
      duration_days: parseInt(form.duration_days),
      validity_days: parseInt(form.validity_days),
      payment_terms: form.payment_terms,
      notes: form.notes,
      submitted_at: new Date().toISOString(),
    }
    const prevQuote = interaction.metadata?.quote
    const prevHistory = interaction.metadata?.quote_history || []
    const quote_history = prevQuote
      ? [...prevHistory, { ...prevQuote, archived_at: new Date().toISOString() }]
      : prevHistory
    await supabase.from('lead_painter_interactions').update({
      status: 'proposal_sent',
      proposal_sent_at: new Date().toISOString(),
      metadata: { ...interaction.metadata, quote, quote_history } as Record<string, unknown>,
    }).eq('id', interactionId)

    // Increment proposal count (only for new proposals, not re-sends)
    if (!prevQuote) {
      const newCount = (lead.proposals_received_count || 0) + 1
      const maxP = lead.max_proposals || 3
      await supabase.from('leads').update({
        proposals_received_count: newCount,
        proposals_closed: newCount >= maxP,
      }).eq('id', lead.id)
    }

    // Auto-record divergence vs AI estimate for learning
    const l = interaction.lead
    if (l.calc_price_min != null && l.calc_price_max != null) {
      const aiMid = (l.calc_price_min + l.calc_price_max) / 2
      const diff = Math.round(((quote.total_price - aiMid) / aiMid) * 100)
      await supabase.from('budget_ai_adjustments').insert({
        lead_id: l.id,
        field_adjusted: 'price',
        ai_value: `R$${l.calc_price_min}–${l.calc_price_max}`,
        painter_value: `R$${quote.total_price}`,
        difference_percent: diff,
        created_by: 'painter',
      })
      setFeedbackToast(`Proposta salva! A IA estimou ${formatCurrency(aiMid)}, você cotou ${formatCurrency(quote.total_price)}.`)
      setTimeout(() => setFeedbackToast(null), 6000)
    }

    // Notify client + admin via email
    const lead = interaction.lead
    if (lead.email) {
      supabase.functions.invoke('notify-proposal', {
        body: {
          client_email: lead.email,
          client_name: lead.name || 'Cliente',
          painter_name: user?.name || 'Pintor',
          protocol: lead.protocol,
          service_type: lead.service_interest || '',
          neighborhood: lead.neighborhood || '',
          total_price: quote.total_price,
          includes_material: quote.includes_material,
          duration_days: quote.duration_days,
          payment_terms: quote.payment_terms,
          notes: quote.notes,
          lead_id: lead.id,
          is_update: !!prevQuote,
          previous_price: prevQuote?.total_price ?? null,
        },
      }).then(({ error: notifErr }) => {
        if (notifErr) console.error('[NotifyProposal] error:', notifErr)
        else console.log('[NotifyProposal] sent')
      }).catch(err => console.error('[NotifyProposal] failed:', err))
    }

    setSubmitting(false)
    setEditing(false)
    await load()
  }

  function startEditing() {
    setEditing(true)
  }

  async function cancelProposal() {
    if (!interactionId || !interaction) return
    setCancelling(true)
    const prevQuote = interaction.metadata?.quote
    const prevHistory = interaction.metadata?.quote_history || []
    const newHistory = prevQuote
      ? [...prevHistory, { ...prevQuote, archived_at: new Date().toISOString() }]
      : prevHistory
    await supabase.from('lead_painter_interactions').update({
      status: 'interested',
      proposal_sent_at: null,
      metadata: { ...interaction.metadata, quote: null, quote_history: newHistory } as Record<string, unknown>,
    }).eq('id', interactionId)
    setEditing(false)
    setCancelling(false)
    await load()
  }

  async function uploadChatMedia(file: File) {
    if (!interactionId || !interaction) return
    setUploadingMedia(true)
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `chat/${interactionId}/${Date.now()}.${ext}`
    const { data: stored, error } = await supabase.storage
      .from('lead-media')
      .upload(path, file, { upsert: false })
    if (error || !stored) { setUploadingMedia(false); return }
    const { data: { publicUrl } } = supabase.storage.from('lead-media').getPublicUrl(path)
    // Send as special chat message
    const body = `[media]${publicUrl}`
    const { data: msgData } = await supabase
      .from('lead_conversation_messages')
      .insert({ interaction_id: interactionId, sender_role: 'painter', body })
      .select().single()
    if (msgData) {
      const msg = msgData as ConvMessage
      setConvMessages(prev => [...prev, msg])
      convChannelRef.current?.send({ type: 'broadcast', event: 'message', payload: msg })
      // Also append to lead.media_urls so it shows in the photos section
      const current = interaction.lead.media_urls || []
      await supabase.from('leads').update({ media_urls: [...current, publicUrl] }).eq('id', interaction.lead.id)
      setInteraction(prev => prev
        ? { ...prev, lead: { ...prev.lead, media_urls: [...(prev.lead.media_urls || []), publicUrl] } }
        : prev)
    }
    setUploadingMedia(false)
    if (chatFileRef.current) chatFileRef.current.value = ''
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    )
  }

  if (!interaction) return null

  const lead = interaction.lead
  const isSubmitted = interaction.status === 'proposal_sent' && !editing
  const isResending = editing && !!(interaction.metadata?.quote)
  const confidenceCfg = CONFIDENCE_CFG[lead.calc_confidence || ''] ?? CONFIDENCE_CFG.baixa
  const savedQuote = interaction.metadata?.quote
  const matchedBenchmark = Object.entries(BENCHMARK).find(([key]) =>
    lead.service_interest?.toLowerCase().includes(key.toLowerCase())
  )?.[1]
  const quoteHistory = interaction.metadata?.quote_history || []

  function handlePrint() {
    window.print()
  }

  const progressStep = isSubmitted ? 3 : (painterNotes.trim() ? 2 : 1)

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Admin readonly banner */}
      {isAdmin && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-2 print:hidden">
          <Eye className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            Visualizando como o pintor vê esta solicitação — modo somente leitura
          </p>
        </div>
      )}

      <header className="bg-white border-b border-gray-100 sticky top-0 z-30 print:static print:border-0">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(isAdmin ? `/admin/painters/${interaction.painter_id}` : '/portal/pintor')}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 cursor-pointer shrink-0 print:hidden">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{lead.service_interest ?? 'Solicitação'}</p>
            <p className="text-xs text-gray-400 font-mono">{lead.protocol}</p>
          </div>
          <button onClick={handlePrint}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 cursor-pointer shrink-0 print:hidden"
            title="Exportar PDF">
            <FileDown className="w-4 h-4" />
          </button>
          {isSubmitted && (
            <span className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-medium shrink-0 print:hidden">
              Proposta enviada
            </span>
          )}
        </div>
      </header>

      {/* Progress bar — only for painters */}
      {!isAdmin && (
        <div className="bg-white border-b border-gray-100 px-4 py-3 print:hidden">
          <div className="max-w-2xl mx-auto flex items-center gap-2">
            {[
              { n: 1, label: 'Ver detalhes' },
              { n: 2, label: 'Observações' },
              { n: 3, label: 'Enviar proposta' },
            ].map(({ n, label }, i) => (
              <div key={n} className="flex items-center gap-2 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  progressStep >= n ? 'bg-brand text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {progressStep > n ? '✓' : n}
                </div>
                <span className={`text-xs font-medium ${progressStep >= n ? 'text-brand' : 'text-gray-400'}`}>
                  {label}
                </span>
                {i < 2 && <div className={`flex-1 h-px ${progressStep > n ? 'bg-brand' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Project details */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Detalhes do Projeto</h2>
          <div className="grid grid-cols-2 gap-3">
            {lead.service_interest && (
              <div className="flex items-start gap-2">
                <Star className="w-3.5 h-3.5 text-brand mt-0.5 shrink-0" />
                <div><p className="text-xs text-gray-400">Serviço</p><p className="text-sm text-gray-800 font-medium">{lead.service_interest}</p></div>
              </div>
            )}
            {lead.property_type && (
              <div className="flex items-start gap-2">
                <Home className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                <div><p className="text-xs text-gray-400">Imóvel</p><p className="text-sm text-gray-800 font-medium">{lead.property_type}</p></div>
              </div>
            )}
            {lead.neighborhood && (
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                <div><p className="text-xs text-gray-400">Bairro</p><p className="text-sm text-gray-800 font-medium">{lead.neighborhood}</p></div>
              </div>
            )}
            {(lead.area_m2 || lead.num_rooms) && (
              <div className="flex items-start gap-2">
                <Ruler className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Tamanho</p>
                  <p className="text-sm text-gray-800 font-medium">
                    {lead.area_m2 ? `${lead.area_m2} m²` : ''}
                    {lead.area_m2 && lead.num_rooms ? ' · ' : ''}
                    {lead.num_rooms ? `${lead.num_rooms} cômodos` : ''}
                  </p>
                </div>
              </div>
            )}
            {lead.wall_condition && (
              <div className="flex items-start gap-2">
                <Home className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                <div><p className="text-xs text-gray-400">Paredes</p><p className="text-sm text-gray-800 font-medium">{lead.wall_condition}</p></div>
              </div>
            )}
            {lead.deadline && (
              <div className="flex items-start gap-2">
                <Calendar className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                <div><p className="text-xs text-gray-400">Prazo</p><p className="text-sm text-gray-800 font-medium">{lead.deadline}</p></div>
              </div>
            )}
            {lead.material && (
              <div className="flex items-start gap-2">
                <Package2 className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                <div><p className="text-xs text-gray-400">Material</p><p className="text-sm text-gray-800 font-medium">{lead.material}</p></div>
              </div>
            )}
          </div>

          {lead.final_notes && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Observações do cliente</p>
              <p className="text-sm text-gray-700">{lead.final_notes}</p>
            </div>
          )}

          {lead.calc_price_min && lead.calc_price_max && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowBudgetModal(true)}
                className="w-full flex items-center justify-between group cursor-pointer hover:bg-gray-50 -mx-1 px-1 py-1 rounded-xl transition-colors">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5 text-left">Estimativa da plataforma</p>
                  <p className="text-lg font-bold text-brand text-left">
                    {formatCurrency(lead.calc_price_min)} – {formatCurrency(lead.calc_price_max)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-brand font-medium">
                  {lead.calc_confidence && (
                    <span className={`px-2.5 py-1 rounded-full ${confidenceCfg.color}`}>
                      {confidenceCfg.text}
                    </span>
                  )}
                  <Info className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </div>
              </button>
            </div>
          )}
        </motion.div>

        {/* Media gallery - always show */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <button onClick={() => setMediaOpen(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-gray-900 text-sm">
                Fotos e vídeos{lead.media_urls?.length ? ` (${lead.media_urls.length})` : ''}
              </span>
            </div>
            {mediaOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {mediaOpen && (
            lead.media_urls?.length > 0 ? (
              <div className="px-5 pb-5 grid grid-cols-3 gap-2">
                {lead.media_urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="aspect-square rounded-xl overflow-hidden bg-gray-100 block">
                    {/\.(mp4|mov|webm)$/i.test(url) ? (
                      <video src={url} className="w-full h-full object-cover" />
                    ) : (
                      <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                    )}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center px-5 pb-5 pt-1">
                O cliente não enviou fotos ou vídeos.
              </p>
            )
          )}
        </motion.div>

        {/* AI Briefing */}
        {lead.ai_briefing && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <button onClick={() => setBriefingOpen(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-brand" />
                <span className="font-medium text-gray-900 text-sm">Análise da IA</span>
              </div>
              {briefingOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {briefingOpen && (
              <div className="px-5 pb-5">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{lead.ai_briefing}</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Market Reference (painter only) */}
        {!isAdmin && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <button onClick={() => setMarketOpen(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-gray-900 text-sm">Referência de Mercado</span>
                <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">Florianópolis</span>
              </div>
              {marketOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {marketOpen && (
              <div className="px-5 pb-5 space-y-3">
                {matchedBenchmark ? (
                  <>
                    <p className="text-xs font-semibold text-gray-700">{lead.service_interest} — Florianópolis</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Mão de obra /m²</p>
                        <p className="font-bold text-gray-900 text-sm">R${matchedBenchmark.m2Labor[0]}–{matchedBenchmark.m2Labor[1]}</p>
                        {lead.area_m2 && (
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {lead.area_m2} m² → ~R${(lead.area_m2 * matchedBenchmark.m2Labor[0]).toLocaleString('pt-BR', {maximumFractionDigits: 0})}–{(lead.area_m2 * matchedBenchmark.m2Labor[1]).toLocaleString('pt-BR', {maximumFractionDigits: 0})}
                          </p>
                        )}
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Com material /m²</p>
                        <p className="font-bold text-gray-900 text-sm">R${matchedBenchmark.m2Full[0]}–{matchedBenchmark.m2Full[1]}</p>
                        {lead.area_m2 && (
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {lead.area_m2} m² → ~R${(lead.area_m2 * matchedBenchmark.m2Full[0]).toLocaleString('pt-BR', {maximumFractionDigits: 0})}–{(lead.area_m2 * matchedBenchmark.m2Full[1]).toLocaleString('pt-BR', {maximumFractionDigits: 0})}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Por hora (ref. sindical)</p>
                      <p className="font-bold text-brand text-sm">R${matchedBenchmark.hourly[0]}–{matchedBenchmark.hourly[1]}/h</p>
                    </div>
                    <p className="text-[10px] text-gray-400">Fonte: SINDUSCON-SC + fóruns de pintores profissionais.</p>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-xs text-gray-500 mb-2">Referências gerais — Florianópolis:</p>
                    {Object.entries(BENCHMARK).map(([svc, ref]) => (
                      <div key={svc} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50 last:border-0">
                        <span className="text-gray-700 font-medium">{svc}</span>
                        <span className="text-gray-500">R${ref.m2Labor[0]}–{ref.m2Labor[1]}/m²</span>
                      </div>
                    ))}
                    <p className="text-[10px] text-gray-400 pt-1">Fonte: SINDUSCON-SC + fóruns de pintores profissionais.</p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Painter notes */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 text-sm">Suas Observações</h3>
            <span className="text-xs text-gray-400">
              {notesSaving ? 'Salvando...' : notesSaved ? '✓ Salvo' : 'Salvo automaticamente'}
            </span>
          </div>
          <textarea
            value={painterNotes}
            onChange={e => !isAdmin && handleNotesChange(e.target.value)}
            readOnly={isAdmin}
            rows={3}
            placeholder={isAdmin ? 'Nenhuma observação adicionada.' : 'Adicione observações sobre o projeto: materiais necessários, pontos de atenção, dificuldades de acesso...'}
            className={`w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none resize-none placeholder:text-gray-400 ${isAdmin ? 'bg-gray-50 cursor-default' : 'focus:border-brand'}`}
          />
        </motion.div>

        {/* Proposal */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 text-sm">
              {isSubmitted ? 'Proposta Enviada' : 'Enviar Proposta'}
            </h3>
            {lead.max_proposals && (
              <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                {lead.proposals_received_count || 0}/{lead.max_proposals} propostas
              </span>
            )}
          </div>

          {!isAdmin && lead.proposals_closed && !isSubmitted && (
            <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700">
              Este lead já atingiu o limite de {lead.max_proposals} propostas. Não é possível enviar novas propostas.
            </div>
          )}

          {!isAdmin && !isSubmitted && !isResending && !lead.proposals_closed && (
            <div className="mb-4 px-3 py-2.5 bg-orange-50 border border-orange-100 rounded-xl text-xs text-orange-800">
              💡 Dica: coloque um preço justo. O cliente verá seu perfil e avaliações ao lado desta proposta.
            </div>
          )}
          {!isAdmin && isResending && savedQuote && (
            <div className="mb-4 px-3 py-2.5 bg-yellow-50 border border-yellow-200 rounded-xl text-xs text-yellow-900 space-y-0.5">
              <p className="font-semibold">Editando proposta já enviada</p>
              <p className="text-yellow-700">Valor anterior: <span className="font-medium">{formatCurrency(savedQuote.total_price)}</span> · enviada em {savedQuote.submitted_at ? new Date(savedQuote.submitted_at).toLocaleDateString('pt-BR') : '—'}</p>
              <p className="text-yellow-600">O histórico será mantido automaticamente ao reenviar.</p>
            </div>
          )}

          {isSubmitted && savedQuote ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-xl px-4 py-3">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <p className="text-sm font-medium">Proposta enviada ao cliente!</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Preço total</span><span className="font-semibold text-gray-900">{formatCurrency(savedQuote.total_price)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Material incluso</span><span className="text-gray-700">{savedQuote.includes_material ? 'Sim' : 'Não'}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Prazo de execução</span><span className="text-gray-700">{savedQuote.duration_days} dias</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Validade da proposta</span><span className="text-gray-700">{savedQuote.validity_days} dias</span></div>
                {savedQuote.payment_terms && (
                  <div className="flex justify-between"><span className="text-gray-400">Pagamento</span><span className="text-gray-700">{savedQuote.payment_terms}</span></div>
                )}
                {savedQuote.notes && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-gray-400 text-xs mb-1">Observações</p>
                    <p className="text-gray-700">{savedQuote.notes}</p>
                  </div>
                )}
              </div>
              {!isAdmin && (
                <motion.button onClick={startEditing} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="w-full py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:border-gray-300 transition-colors">
                  <Pencil className="w-3.5 h-3.5" /> Editar proposta
                </motion.button>
              )}
            </div>
          ) : isAdmin ? (
            <div className="py-8 text-center text-sm text-gray-400">
              <Eye className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              O pintor ainda não enviou uma proposta.
            </div>
          ) : lead.proposals_closed ? (
            <div className="py-8 text-center text-sm text-gray-400">
              <Lock className="w-8 h-8 mx-auto mb-2 text-red-300" />
              <p className="text-red-600 font-medium">Limite de propostas atingido</p>
              <p className="text-xs mt-1">Este lead já recebeu {lead.proposals_received_count}/{lead.max_proposals} propostas.</p>
            </div>
          ) : (
            <form onSubmit={submitProposal} className="space-y-4">
              {lead.calc_price_min && lead.calc_price_max && (
                <button type="button" onClick={acceptPlatformPrice}
                  className="w-full flex items-center justify-between px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl cursor-pointer hover:bg-orange-100 transition-colors">
                  <div className="text-left">
                    <p className="text-xs text-orange-700 font-medium">Usar estimativa da plataforma</p>
                    <p className="text-sm font-bold text-brand">{formatCurrency(Math.round((lead.calc_price_min + lead.calc_price_max) / 2))}</p>
                  </div>
                  <Zap className="w-4 h-4 text-brand shrink-0" />
                </button>
              )}

              {matchedBenchmark && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900">
                  <BarChart2 className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Ref. mercado:</span>{' '}
                    R${matchedBenchmark.m2Labor[0]}–{matchedBenchmark.m2Labor[1]}/m² (mão de obra) · R${matchedBenchmark.m2Full[0]}–{matchedBenchmark.m2Full[1]}/m² (c/ material)
                    {lead.area_m2 && (
                      <span className="block mt-0.5 text-blue-700">
                        Para {lead.area_m2} m²: ~R${(lead.area_m2 * matchedBenchmark.m2Labor[0]).toLocaleString('pt-BR', {maximumFractionDigits: 0})}–{(lead.area_m2 * matchedBenchmark.m2Full[1]).toLocaleString('pt-BR', {maximumFractionDigits: 0})}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Preço total (R$) *</label>
                  <input type="number" required value={form.total_price}
                    onChange={e => setForm(f => ({ ...f, total_price: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" placeholder="1500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Prazo (dias) *</label>
                  <input type="number" required value={form.duration_days}
                    onChange={e => setForm(f => ({ ...f, duration_days: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" placeholder="5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2.5">
                  <input type="checkbox" checked={form.includes_material}
                    onChange={e => setForm(f => ({ ...f, includes_material: e.target.checked }))}
                    className="w-4 h-4 accent-brand" />
                  <span className="text-sm text-gray-700">Material incluso</span>
                </label>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Validade (dias)</label>
                  <input type="number" value={form.validity_days}
                    onChange={e => setForm(f => ({ ...f, validity_days: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" placeholder="7" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Condições de pagamento</label>
                <input type="text" value={form.payment_terms}
                  onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Observações da proposta</label>
                <textarea value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3} placeholder="Descreva o que está incluso, materiais utilizados..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand resize-none" />
              </div>

              <motion.button type="submit" disabled={submitting} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="w-full py-3 bg-brand text-white font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {isResending ? 'Reenviar proposta' : 'Enviar proposta ao cliente'}
              </motion.button>
              {isResending && (
                <button type="button" onClick={cancelProposal} disabled={cancelling}
                  className="w-full py-2.5 border border-red-200 text-red-600 text-sm font-medium rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-red-50 transition-colors disabled:opacity-50">
                  {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  Cancelar proposta
                </button>
              )}
            </form>
          )}
        </motion.div>

        {/* Version history */}
        {quoteHistory.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden print:hidden">
            <button onClick={() => setHistoryOpen(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-gray-900 text-sm">Histórico de versões ({quoteHistory.length})</span>
              </div>
              {historyOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {historyOpen && (
              <div className="px-5 pb-4 space-y-3">
                {quoteHistory.map((q, i) => (
                  <div key={i} className="text-sm border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-gray-500">v{i + 1}</span>
                      {q.archived_at && (
                        <span className="text-xs text-gray-400">
                          {new Date(q.archived_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Valor</span>
                      <span className="font-semibold text-gray-700">{formatCurrency(q.total_price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Prazo</span>
                      <span className="text-gray-600">{q.duration_days} dias</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Assistente de Proposta IA */}
        {!isAdmin && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden print:hidden">
            <button onClick={() => setAgentOpen(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-brand" />
                <span className="font-medium text-gray-900 text-sm">Assistente de Proposta</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-brand/10 text-brand rounded font-semibold uppercase tracking-wide">IA</span>
              </div>
              {agentOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {agentOpen && (
              <div className="border-t border-gray-100">
                <div className="px-4 py-3 space-y-3 max-h-64 overflow-y-auto">
                  {agentMessages.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-3">
                      Pergunte sobre materiais, precificação ou como redigir a proposta...
                    </p>
                  )}
                  {agentMessages.map((m, i) => (
                    <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {m.role === 'assistant' && (
                        <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="w-3 h-3 text-brand" />
                        </div>
                      )}
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line ${
                        m.role === 'user'
                          ? 'bg-brand text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      }`}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {agentLoading && (
                    <div className="flex gap-2">
                      <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                        <Bot className="w-3 h-3 text-brand" />
                      </div>
                      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2.5">
                        <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                      </div>
                    </div>
                  )}
                  <div ref={agentBottomRef} />
                </div>
                <div className="border-t border-gray-100 px-4 py-3 flex gap-2">
                  <input
                    value={agentInput}
                    onChange={e => setAgentInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAgentMessage() } }}
                    placeholder="Ex: Quanto de tinta eu preciso para 80m²?"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand"
                  />
                  <button onClick={sendAgentMessage} disabled={agentLoading || !agentInput.trim()}
                    className="w-8 h-8 bg-brand text-white rounded-xl flex items-center justify-center disabled:opacity-40 cursor-pointer shrink-0">
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Conversa com o cliente */}
        {!isAdmin && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden print:hidden">
            <button onClick={() => setConvOpen(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-gray-900 text-sm">Conversa com o cliente</span>
                {convMessages.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-semibold">
                    {convMessages.length}
                  </span>
                )}
                {customerTyping && !convOpen && (
                  <span className="text-[10px] text-gray-400 italic">digitando...</span>
                )}
              </div>
              {convOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {convOpen && (
              <div className="border-t border-gray-100">
                <div className="px-4 py-3 space-y-2 max-h-72 overflow-y-auto bg-gray-50/50">
                  {convMessages.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-6">
                      {interaction.status === 'declined'
                        ? 'Conversa encerrada.'
                        : 'Nenhuma mensagem ainda. Inicie a conversa com o cliente.'}
                    </p>
                  )}
                  {convMessages.map((m, i) => {
                    const isPainter = m.sender_role === 'painter'
                    const prevMsg = convMessages[i - 1]
                    const showDate = !prevMsg || new Date(m.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString()
                    const today = new Date().toDateString()
                    const msgDay = new Date(m.created_at).toDateString()
                    const timeStr = msgDay === today
                      ? new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      : new Date(m.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                    return (
                      <div key={m.id}>
                        {showDate && (
                          <p className="text-[10px] text-gray-400 text-center my-2">
                            {new Date(m.created_at).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                          </p>
                        )}
                        <div className={`flex gap-2 ${isPainter ? 'justify-end' : 'justify-start'}`}>
                          {!isPainter && (
                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                              <User className="w-3 h-3 text-gray-500" />
                            </div>
                          )}
                          {m.body.startsWith('[media]') ? (
                            <div className={`max-w-[200px] ${m.id.startsWith('temp-') ? 'opacity-60' : ''}`}>
                              {/\.(mp4|mov|webm)/i.test(m.body) ? (
                                <video src={m.body.slice(7)} controls className="rounded-2xl max-w-full" />
                              ) : (
                                <a href={m.body.slice(7)} target="_blank" rel="noopener noreferrer">
                                  <img src={m.body.slice(7)} alt="Mídia" className="rounded-2xl max-w-full object-cover" />
                                </a>
                              )}
                              <p className={`text-[10px] mt-0.5 ${isPainter ? 'text-white/50 text-right' : 'text-gray-400'}`}>
                                {m.id.startsWith('temp-') ? '⏳' : timeStr}
                              </p>
                            </div>
                          ) : (
                            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                              isPainter
                                ? 'bg-gray-800 text-white rounded-br-sm'
                                : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'
                            } ${m.id.startsWith('temp-') ? 'opacity-60' : ''}`}>
                              <p className="whitespace-pre-wrap">{m.body}</p>
                              <p className={`text-[10px] mt-0.5 ${isPainter ? 'text-white/50 text-right' : 'text-gray-400'}`}>
                                {m.id.startsWith('temp-') ? '⏳' : timeStr}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Typing indicator */}
                  {customerTyping && (
                    <div className="flex gap-2 justify-start">
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                        <User className="w-3 h-3 text-gray-500" />
                      </div>
                      <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm shadow-sm px-3 py-2 flex gap-1 items-center">
                        {[0, 1, 2].map(i => (
                          <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }} />
                        ))}
                      </div>
                    </div>
                  )}

                  <div ref={convBottomRef} />
                </div>

                {interaction.status === 'declined' ? (
                  <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <p className="text-xs text-gray-400">Conversa encerrada · histórico preservado</p>
                  </div>
                ) : (
                  <div className="border-t border-gray-100 px-4 py-3 flex gap-2">
                    <input ref={chatFileRef} type="file" accept="image/*,video/*" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) uploadChatMedia(e.target.files[0]) }} />
                    <button type="button" onClick={() => chatFileRef.current?.click()} disabled={uploadingMedia}
                      title="Enviar foto ou vídeo"
                      className="w-8 h-8 bg-gray-100 text-gray-500 rounded-xl flex items-center justify-center disabled:opacity-40 cursor-pointer shrink-0 hover:bg-gray-200 transition-colors">
                      {uploadingMedia ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                    </button>
                    <input
                      value={convInput}
                      onChange={e => handleConvInputChange(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendConvMessage() } }}
                      placeholder="Mensagem ao cliente..."
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand"
                    />
                    <button onClick={sendConvMessage} disabled={convSending || !convInput.trim()}
                      className="w-8 h-8 bg-gray-800 text-white rounded-xl flex items-center justify-center disabled:opacity-40 cursor-pointer shrink-0 transition-opacity">
                      {convSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Profile reminder */}
        {!isAdmin && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }}
            className="bg-gray-50 rounded-2xl border border-gray-100 p-4 flex items-center gap-3 print:hidden">
            <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
              <Star className="w-4 h-4 text-brand" />
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Seu perfil completo — especialidades, score e avaliações — será exibido ao cliente junto com esta proposta.
            </p>
          </motion.div>
        )}

      </div>

      {/* Budget breakdown modal */}
      <AnimatePresence>
        {showBudgetModal && (
          <BudgetBreakdownModal lead={lead} onClose={() => setShowBudgetModal(false)} />
        )}
      </AnimatePresence>

      {/* Feedback toast */}
      <AnimatePresence>
        {feedbackToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-xs px-4 py-3 rounded-2xl shadow-xl max-w-sm text-center print:hidden">
            {feedbackToast}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
