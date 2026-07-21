import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  Briefcase, CheckCircle, MapPin, Send, Loader2, X,
  Star, MessageSquare, User, ChevronRight, Pencil,
  Zap, Clock, Sparkles, Shield, LayoutGrid,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { RoleSwitcher } from '../../components/RoleSwitcher'
import type { Quote, Review, PainterScore, Painter } from '../../lib/types'

interface LeadInteraction {
  id: string
  lead_id: string
  status: string
  notified_at: string | null
  proposal_sent_at: string | null
  metadata: Record<string, unknown>
  lead: {
    id: string
    protocol: string
    service_interest: string | null
    neighborhood: string | null
    area_m2: number | null
    num_rooms: number | null
    calc_price_min: number | null
    calc_price_max: number | null
    created_at: string
  }
}
import { cn, formatCurrency } from '../../lib/utils'

// ─── Star display ─────────────────────────────────────────────────────────────

function Stars({ value, max = 5, size = 'sm' }: { value: number; max?: number; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'w-5 h-5' : size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={cn(sz, i < Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-gray-200 fill-gray-200')}
        />
      ))}
    </div>
  )
}

// ─── Proposal modal ───────────────────────────────────────────────────────────

interface ProposalForm {
  total_price: string
  estimated_duration_days: string
  material_included: boolean
  payment_terms: string
  notes: string
}

function ProposalModal({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const { user } = useAuth()
  const [form, setForm] = useState<ProposalForm>({
    total_price: '', estimated_duration_days: '3', material_included: false,
    payment_terms: '50% adiantado, 50% na conclusão', notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    const { data: painter } = await supabase.from('painters').select('id').eq('user_id', user.id).single()
    if (!painter) { setLoading(false); return }

    await supabase.from('quotes').insert({
      service_request_id: requestId,
      provider_type: 'painter',
      provider_id: painter.id,
      total_price: parseFloat(form.total_price),
      estimated_duration_days: parseInt(form.estimated_duration_days),
      material_included: form.material_included,
      payment_terms: form.payment_terms,
      notes: form.notes,
      status: 'submitted',
    })
    setDone(true)
    setLoading(false)
    setTimeout(onClose, 1500)
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
        className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {done ? (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-gray-900">Proposta enviada!</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-900">Enviar proposta</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Preço total (R$)</label>
                  <input type="number" required value={form.total_price} onChange={e => setForm({...form, total_price: e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" placeholder="1500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Duração (dias)</label>
                  <input type="number" required value={form.estimated_duration_days} onChange={e => setForm({...form, estimated_duration_days: e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" placeholder="3" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.material_included} onChange={e => setForm({...form, material_included: e.target.checked})} className="w-4 h-4 accent-brand" />
                <span className="text-sm text-gray-700">Material incluso no preço</span>
              </label>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Condições de pagamento</label>
                <input type="text" value={form.payment_terms} onChange={e => setForm({...form, payment_terms: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Observações</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand resize-none" placeholder="Descreva o que está incluso..." />
              </div>
              <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="w-full py-3 bg-brand text-white font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar proposta
              </motion.button>
            </form>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Score breakdown card ─────────────────────────────────────────────────────

function ScoreCard({ score }: { score: PainterScore }) {
  const dimensions = [
    { label: 'Qualidade', value: score.quality_score, icon: Sparkles },
    { label: 'Pontualidade', value: score.punctuality_score, icon: Clock },
    { label: 'Resposta', value: score.response_score, icon: Zap },
    { label: 'Conversão', value: score.conversion_score, icon: ChevronRight },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
      className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Score geral</p>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-gray-900">{score.overall_score.toFixed(1)}</span>
            <div>
              <Stars value={score.overall_score} size="md" />
              <p className="text-xs text-gray-400 mt-0.5">{score.reviews_count} avaliação{score.reviews_count !== 1 ? 'ões' : ''} · {score.completed_jobs_count} trabalhos</p>
            </div>
          </div>
        </div>
        {score.overall_score >= 4.5 && (
          <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 rounded-full border border-amber-100">
            <Shield className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-semibold text-amber-600">Top Pintor</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {dimensions.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5">
            <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-400">{label}</p>
              <div className="flex items-center gap-1">
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-brand rounded-full" style={{ width: `${(value / 5) * 100}%` }} />
                </div>
                <span className="text-xs font-semibold text-gray-700 shrink-0">{value.toFixed(1)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Review card ──────────────────────────────────────────────────────────────

function ReviewCard({ review, index }: { review: Review; index: number }) {
  const subRatings = [
    { label: 'Qualidade', value: review.rating_quality },
    { label: 'Pontualidade', value: review.rating_punctuality },
    { label: 'Limpeza', value: review.rating_cleanliness },
    { label: 'Comunicação', value: review.rating_communication },
  ].filter(r => r.value != null) as { label: string; value: number }[]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}
      className="bg-white rounded-2xl border border-gray-100 p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-gray-400" />
          </div>
          <div>
            <Stars value={review.rating_overall} size="sm" />
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(review.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        {review.sentiment_label && (
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
            review.sentiment_label === 'positive' ? 'bg-green-100 text-green-700' :
            review.sentiment_label === 'negative' ? 'bg-red-100 text-red-600' :
            'bg-gray-100 text-gray-600'
          )}>
            {review.sentiment_label === 'positive' ? 'Positivo' :
             review.sentiment_label === 'negative' ? 'Negativo' : 'Neutro'}
          </span>
        )}
      </div>

      {review.ai_summary && (
        <p className="text-sm text-gray-700 bg-blue-50 rounded-xl px-3 py-2 mb-3 flex gap-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
          {review.ai_summary}
        </p>
      )}

      {review.comment && (
        <p className="text-sm text-gray-600 mb-3">"{review.comment}"</p>
      )}

      {subRatings.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {subRatings.map(({ label, value }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-20 shrink-0">{label}</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(value / 5) * 100}%` }} />
              </div>
              <span className="font-medium text-gray-700">{value}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ─── Profile tab ──────────────────────────────────────────────────────────────

const SPECIALTY_OPTIONS = [
  'Residencial', 'Comercial', 'Fachada', 'Pós-obra', 'Artístico',
  'Mural', 'Textura', 'Grafiato', 'Stencil', 'Epóxi',
]

function ProfileTab({ painter, onSaved }: { painter: Painter; onSaved: () => void }) {
  const [bio, setBio] = useState(painter.bio || '')
  const [years, setYears] = useState(String(painter.years_experience || 0))
  const [specialties, setSpecialties] = useState<string[]>(painter.specialties || [])
  const [availability, setAvailability] = useState(painter.availability_status)
  const [basePrice, setBasePrice] = useState(String(painter.base_price_m2 || ''))
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  function toggleSpecialty(s: string) {
    setSpecialties(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.from('painters').update({
      bio,
      years_experience: parseInt(years) || 0,
      specialties,
      availability_status: availability,
      base_price_m2: parseFloat(basePrice) || null,
    }).eq('id', painter.id)
    setLoading(false)
    setSaved(true)
    setTimeout(() => { setSaved(false); onSaved() }, 1500)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <form onSubmit={save} className="space-y-4">
        {/* Availability */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <label className="text-xs font-medium text-gray-600 mb-2 block">Disponibilidade</label>
          <div className="flex gap-2">
            {(['available', 'busy', 'paused'] as const).map(s => (
              <button key={s} type="button" onClick={() => setAvailability(s)}
                className={cn('flex-1 py-2 text-xs font-medium rounded-xl border transition-colors cursor-pointer',
                  availability === s
                    ? s === 'available' ? 'bg-green-50 text-green-700 border-green-200'
                      : s === 'busy' ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                      : 'bg-gray-100 text-gray-600 border-gray-200'
                    : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200')}>
                {s === 'available' ? 'Disponível' : s === 'busy' ? 'Ocupado' : 'Pausado'}
              </button>
            ))}
          </div>
        </div>

        {/* Bio + experience */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand resize-none"
              placeholder="Conte sobre seu trabalho e experiência..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Anos de experiência</label>
              <input type="number" value={years} onChange={e => setYears(e.target.value)} min="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Preço base (R$/m²)</label>
              <input type="number" value={basePrice} onChange={e => setBasePrice(e.target.value)} step="0.5"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" placeholder="25" />
            </div>
          </div>
        </div>

        {/* Specialties */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <label className="text-xs font-medium text-gray-600 mb-2 block">Especialidades</label>
          <div className="flex flex-wrap gap-2">
            {SPECIALTY_OPTIONS.map(s => (
              <button key={s} type="button" onClick={() => toggleSpecialty(s)}
                className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                  specialties.includes(s)
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-brand hover:text-brand')}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          className="w-full py-3 bg-brand text-white font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
          {saved ? 'Salvo!' : 'Salvar perfil'}
        </motion.button>
      </form>
    </motion.div>
  )
}

// ─── Main portal ──────────────────────────────────────────────────────────────

export function PainterPortal() {
  const { user, signOut } = useAuth()
  const [painter, setPainter] = useState<Painter | null>(null)
  const [score, setScore] = useState<PainterScore | null>(null)
  const [leadInteractions, setLeadInteractions] = useState<LeadInteraction[]>([])
  const [myQuotes, setMyQuotes] = useState<Quote[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [proposalTarget, setProposalTarget] = useState<string | null>(null)
  const [tab, setTab] = useState<'solicitations' | 'proposals' | 'reviews' | 'profile'>('solicitations')

  async function load() {
    if (!user) return
    const { data: painterData } = await supabase
      .from('painters')
      .select('*')
      .eq('user_id', user.id)
      .single()

    const painterId = painterData?.id

    const [interactionsRes, quotesRes, scoreRes, reviewsRes] = await Promise.all([
      painterId
        ? supabase.from('lead_painter_interactions')
            .select('*, lead:leads(id,protocol,service_interest,neighborhood,area_m2,num_rooms,calc_price_min,calc_price_max,created_at)')
            .eq('painter_id', painterId)
            .neq('status', 'declined')
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase.from('quotes')
        .select('*, service_request:service_requests(request_type, neighborhood:neighborhoods(name))')
        .order('created_at', { ascending: false }),
      painterId
        ? supabase.from('painter_scores').select('*').eq('painter_id', painterId).single()
        : Promise.resolve({ data: null }),
      painterId
        ? supabase.from('reviews')
            .select('*')
            .eq('provider_id', painterId)
            .eq('provider_type', 'painter')
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ])

    setPainter(painterData)
    setLeadInteractions((interactionsRes.data as LeadInteraction[]) || [])
    setMyQuotes((quotesRes.data as Quote[]) || [])
    setScore(scoreRes.data as PainterScore | null)
    setReviews((reviewsRes.data as Review[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const notifiedCount = leadInteractions.filter(i => i.status === 'notified').length

  async function declineInteraction(id: string) {
    await supabase.from('lead_painter_interactions').update({
      status: 'declined',
      metadata: { declined_at: new Date().toISOString() },
    }).eq('id', id)
    setLeadInteractions(prev => prev.filter(i => i.id !== id))
  }

  const TABS = [
    { id: 'solicitations', label: 'Solicitações', count: notifiedCount || leadInteractions.length, icon: Briefcase },
    { id: 'proposals', label: 'Propostas', count: myQuotes.length, icon: Send },
    { id: 'reviews', label: 'Avaliações', count: reviews.length, icon: Star },
    { id: 'profile', label: 'Perfil', count: 0, icon: User },
  ] as const

  const selectedCount = myQuotes.filter(q => q.status === 'selected').length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-brand">Pinte Rápido</Link>
          <div className="flex items-center gap-3">
            <RoleSwitcher />
            {score && score.overall_score > 0 && (
              <div className="hidden sm:flex items-center gap-1.5">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="text-sm font-semibold text-gray-800">{score.overall_score.toFixed(1)}</span>
              </div>
            )}
            <span className="text-sm text-gray-500 hidden sm:block">{user?.name}</span>
            <button onClick={signOut} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">Sair</button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Portal do Pintor</h1>
            <p className="text-gray-500 text-sm mt-1">Oportunidades de trabalho próximas a você.</p>
          </div>
          <Link to="/crm"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white text-xs font-semibold rounded-xl hover:bg-gray-800 transition-colors shrink-0">
            <LayoutGrid className="w-3.5 h-3.5" /> Meus Leads (CRM)
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-4 gap-3 mb-5">
          {[
            { icon: Briefcase, label: 'Solicitações', value: leadInteractions.length, color: 'text-blue-500' },
            { icon: Send, label: 'Propostas', value: myQuotes.length, color: 'text-brand' },
            { icon: CheckCircle, label: 'Selecionadas', value: selectedCount, color: 'text-green-500' },
            {
              icon: Star, label: 'Score',
              value: score && score.overall_score > 0 ? score.overall_score.toFixed(1) : '—',
              color: 'text-amber-400',
            },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
              <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
              <p className="text-lg font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 leading-tight">{label}</p>
            </div>
          ))}
        </motion.div>

        {/* Score breakdown — only if has reviews */}
        {score && score.reviews_count > 0 && tab === 'reviews' && (
          <ScoreCard score={score} />
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
              className={cn('flex-1 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 min-w-0',
                tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              <t.icon className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">{t.label}</span>
              {t.count > 0 && <span className="text-xs text-brand font-semibold">({t.count})</span>}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-32 bg-white rounded-2xl animate-pulse border border-gray-100" />)}</div>
        ) : tab === 'solicitations' ? (
          leadInteractions.length === 0 ? (
            <div className="space-y-4">
              {/* Welcome / how-it-works banner — shown when no solicitations yet */}
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-100 p-5">
                <p className="font-bold text-gray-900 mb-4 text-base">Como funciona</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { n: 1, icon: Zap, label: 'Receba pedidos', desc: 'Você será notificado quando houver um cliente perto de você' },
                    { n: 2, icon: Briefcase, label: 'Veja os detalhes', desc: 'Confira o projeto, fotos e estimativa de preço da plataforma' },
                    { n: 3, icon: Send, label: 'Envie proposta', desc: 'Monte seu orçamento e envie diretamente ao cliente' },
                  ].map(({ n, icon: Icon, label, desc }) => (
                    <div key={n} className="flex flex-col items-center text-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center font-bold text-sm">
                        {n}
                      </div>
                      <Icon className="w-5 h-5 text-brand" />
                      <p className="text-xs font-semibold text-gray-800">{label}</p>
                      <p className="text-[10px] text-gray-500 leading-snug">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <Briefcase className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm font-medium">Nenhuma solicitação recebida ainda</p>
                <p className="text-gray-300 text-xs mt-1">Pedidos de clientes da sua região aparecerão aqui automaticamente.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {leadInteractions.map((interaction, i) => {
                const lead = interaction.lead
                const isNew = interaction.status === 'notified'
                const isSent = interaction.status === 'proposal_sent'
                return (
                  <motion.div key={interaction.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">{lead.service_interest ?? 'Pintura'}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs text-gray-500">{lead.neighborhood}</span>
                          {(lead.area_m2 || lead.num_rooms) && (
                            <span className="text-xs text-gray-400">
                              · {lead.area_m2 ? `${lead.area_m2}m²` : `${lead.num_rooms} cômodos`}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium shrink-0',
                        isSent ? 'bg-green-100 text-green-700' :
                        isNew ? 'bg-amber-100 text-amber-700 animate-pulse' :
                        'bg-blue-100 text-blue-700'
                      )}>
                        {isSent ? 'Proposta enviada' : isNew ? 'Novo' : 'Em avaliação'}
                      </span>
                    </div>

                    {lead.calc_price_min && lead.calc_price_max && (
                      <p className="text-xs text-gray-400 mb-3">
                        Estimativa plataforma: <span className="font-semibold text-gray-700">{formatCurrency(lead.calc_price_min)} – {formatCurrency(lead.calc_price_max)}</span>
                      </p>
                    )}

                    <div className="flex gap-2">
                      <Link to={`/portal/pintor/solicitacao/${interaction.id}`}
                        className="flex-1 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-brand-dark transition-colors">
                        <Send className="w-3.5 h-3.5" />
                        {isSent ? 'Ver proposta' : 'Ver solicitação'}
                      </Link>
                      {!isSent && (
                        <motion.button onClick={() => declineInteraction(interaction.id)} whileTap={{ scale: 0.96 }}
                          className="px-4 py-2.5 border border-gray-200 text-gray-500 text-sm rounded-xl cursor-pointer hover:border-red-200 hover:text-red-500 transition-colors">
                          Recusar
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )
        ) : tab === 'proposals' ? (
          myQuotes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <Send className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Nenhuma proposta enviada ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myQuotes.map((q, i) => {
                const sr = (q as unknown as { service_request: { request_type: string; neighborhood: { name: string } } }).service_request
                return (
                  <motion.div key={q.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-gray-900 capitalize">{sr?.request_type?.replace('_',' ')} · {sr?.neighborhood?.name}</p>
                      <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium',
                        q.status === 'selected' ? 'bg-green-100 text-green-700' :
                        q.status === 'rejected' ? 'bg-red-100 text-red-600' :
                        'bg-yellow-100 text-yellow-700'
                      )}>{q.status === 'selected' ? 'Selecionada' : q.status === 'rejected' ? 'Recusada' : 'Aguardando'}</span>
                    </div>
                    <div className="flex gap-4 text-sm text-gray-600">
                      <span className="font-semibold text-gray-900">{formatCurrency(q.total_price)}</span>
                      <span className="text-gray-400">{q.estimated_duration_days} dias</span>
                      <span className="text-gray-400">{q.material_included ? 'c/ material' : 's/ material'}</span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )
        ) : tab === 'reviews' ? (
          <>
            {score && score.reviews_count > 0 && <ScoreCard score={score} />}
            {reviews.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Nenhuma avaliação ainda.</p>
                <p className="text-gray-300 text-xs mt-1">Complete trabalhos para receber avaliações dos clientes.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((r, i) => <ReviewCard key={r.id} review={r} index={i} />)}
              </div>
            )}
          </>
        ) : tab === 'profile' && painter ? (
          <ProfileTab painter={painter} onSaved={load} />
        ) : null}
      </div>

      <AnimatePresence>
        {proposalTarget && (
          <ProposalModal requestId={proposalTarget} onClose={() => setProposalTarget(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
