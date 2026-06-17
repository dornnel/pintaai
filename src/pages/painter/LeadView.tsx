import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  ArrowLeft, MapPin, Home, Calendar, Package2, Ruler,
  ChevronDown, ChevronUp, Send, CheckCircle, Loader2,
  Pencil, Image as ImageIcon, Zap, Star, FileDown, Eye, History, Info,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import { useAuth } from '../../lib/auth'
import { BudgetBreakdownModal } from '../../components/BudgetBreakdownModal'

interface Lead {
  id: string
  protocol: string
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
}

interface Interaction {
  id: string
  lead_id: string
  painter_id: string
  status: string
  metadata: InteractionMetadata
  notified_at: string | null
  proposal_sent_at: string | null
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

const CONFIDENCE_CFG: Record<string, { color: string; text: string }> = {
  alta: { color: 'bg-green-100 text-green-700', text: 'Alta confiança' },
  média: { color: 'bg-yellow-100 text-yellow-700', text: 'Confiança média' },
  baixa: { color: 'bg-gray-100 text-gray-600', text: 'Confiança baixa' },
}

export function LeadView() {
  const { interactionId } = useParams<{ interactionId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.roles?.includes('admin') || user?.role === 'admin'

  const [interaction, setInteraction] = useState<Interaction | null>(null)
  const [loading, setLoading] = useState(true)
  const [briefingOpen, setBriefingOpen] = useState(false)
  const [mediaOpen, setMediaOpen] = useState(false)
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
    setLoading(false)
  }, [interactionId, navigate])

  useEffect(() => { load() }, [load])

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

    setSubmitting(false)
    setEditing(false)
    await load()
  }

  async function startEditing() {
    if (!interactionId) return
    await supabase.from('lead_painter_interactions').update({ status: 'interested' }).eq('id', interactionId)
    setEditing(true)
    await load()
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
  const confidenceCfg = CONFIDENCE_CFG[lead.calc_confidence || ''] ?? CONFIDENCE_CFG.baixa
  const savedQuote = interaction.metadata?.quote
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

        {/* Media gallery */}
        {lead.media_urls && lead.media_urls.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <button onClick={() => setMediaOpen(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-gray-900 text-sm">Fotos e vídeos ({lead.media_urls.length})</span>
              </div>
              {mediaOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {mediaOpen && (
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
            )}
          </motion.div>
        )}

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
          </div>

          {!isAdmin && !isSubmitted && (
            <div className="mb-4 px-3 py-2.5 bg-orange-50 border border-orange-100 rounded-xl text-xs text-orange-800">
              💡 Dica: coloque um preço justo. O cliente verá seu perfil e avaliações ao lado desta proposta.
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
                Enviar proposta ao cliente
              </motion.button>
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

        {/* Profile reminder */}
        {!isAdmin && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
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
