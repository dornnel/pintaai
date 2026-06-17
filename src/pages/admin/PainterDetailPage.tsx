import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  ArrowLeft, Star, Mail, MapPin, Briefcase, CheckCircle,
  Clock, MessageCircle, Edit3,
  Users, Loader2, AlertCircle, Package, ThumbsUp, ThumbsDown,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn, formatRelativeTime, formatDate } from '../../lib/utils'

interface PainterDetail {
  id: string
  user_id: string
  bio: string
  years_experience: number
  specialties: string[]
  availability_status: string
  verification_status: string
  kyc_status: string
  pro_plan_status: string
  service_radius_km: number
  base_price_m2?: number
  has_transport: boolean
  accepts_material_included: boolean
  created_at: string
  user: { id: string; name: string; email: string; phone: string; status: string }
  score?: {
    overall_score: number
    completed_jobs_count: number
    response_rate?: number
    acceptance_rate?: number
    avg_response_time_minutes?: number
  }
}

interface Interaction {
  id: string
  status: string
  notified_at: string
  created_at: string
  replied_at?: string
  declined_at?: string
  proposal_sent_at?: string
  lead: {
    id: string
    name: string
    protocol: string
    service_interest?: string
    neighborhood?: string
    stage: string
    created_at: string
  }
}

interface Review {
  id: string
  rating_overall: number
  rating_quality?: number
  rating_punctuality?: number
  rating_cleanliness?: number
  rating_communication?: number
  comment?: string
  sentiment_label?: string
  ai_summary?: string
  created_at: string
}

type Tab = 'profile' | 'requests' | 'reviews'

const KYC_COLORS: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-500',
  submitted: 'bg-yellow-100 text-yellow-700',
  under_review: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}

const KYC_LABELS: Record<string, string> = {
  not_started: 'KYC N/A', submitted: 'KYC Pendente', under_review: 'KYC Em análise',
  approved: 'KYC Aprovado', rejected: 'KYC Rejeitado',
}

const INTERACTION_STATUS: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  notified:       { label: 'Notificado',       color: 'bg-gray-100 text-gray-600',   icon: Clock },
  interested:     { label: 'Interessado',      color: 'bg-blue-100 text-blue-700',   icon: ThumbsUp },
  proposal_sent:  { label: 'Proposta enviada', color: 'bg-yellow-100 text-yellow-700', icon: Package },
  declined:       { label: 'Recusou',          color: 'bg-red-100 text-red-600',     icon: ThumbsDown },
  accepted:       { label: 'Aceitou',          color: 'bg-green-100 text-green-700', icon: CheckCircle },
}

function StarDisplay({ value, size = 'sm' }: { value?: number; size?: 'sm' | 'lg' }) {
  if (!value) return null
  const cls = size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5'
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={cn(cls, i <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200')} />
      ))}
    </div>
  )
}

export function PainterDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [painter, setPainter] = useState<PainterDetail | null>(null)
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('profile')
  const [editingBio, setEditingBio] = useState(false)
  const [bioValue, setBioValue] = useState('')
  const [savingBio, setSavingBio] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [painterRes, interactionsRes, reviewsRes] = await Promise.all([
      supabase.from('painters')
        .select('*, user:users!painters_user_id_fkey(id,name,email,phone,status), score:painter_scores(*)')
        .eq('id', id)
        .single(),
      supabase.from('lead_painter_interactions')
        .select('*, lead:leads!lead_painter_interactions_lead_id_fkey(id,name,protocol,service_interest,neighborhood,stage,created_at)')
        .eq('painter_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('reviews')
        .select('*')
        .eq('provider_id', id)
        .order('created_at', { ascending: false }),
    ])
    if (painterRes.data) {
      setPainter(painterRes.data as unknown as PainterDetail)
      setBioValue((painterRes.data as unknown as PainterDetail).bio || '')
    }
    setInteractions((interactionsRes.data || []) as unknown as Interaction[])
    setReviews((reviewsRes.data || []) as Review[])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // Real-time subscription for interaction updates (Uber-like)
  useEffect(() => {
    if (!id) return
    const channel = supabase.channel(`painter-interactions-${id}`)
      .on('postgres_changes', {
        event: '*', schema: 'pintae', table: 'lead_painter_interactions',
        filter: `painter_id=eq.${id}`,
      }, () => { load() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id, load])

  async function saveBio() {
    if (!painter) return
    setSavingBio(true)
    await supabase.from('painters').update({ bio: bioValue }).eq('id', painter.id)
    setPainter({ ...painter, bio: bioValue })
    setEditingBio(false)
    setSavingBio(false)
  }

  async function toggleAvailability() {
    if (!painter) return
    const next = painter.availability_status === 'available' ? 'busy' : 'available'
    await supabase.from('painters').update({ availability_status: next }).eq('id', painter.id)
    setPainter({ ...painter, availability_status: next })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    )
  }

  if (!painter) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-10 h-10 text-gray-200 mx-auto mb-2" />
        <p className="text-gray-400 text-sm">Pintor não encontrado.</p>
        <button onClick={() => navigate('/admin/painters')} className="mt-3 text-brand text-sm cursor-pointer">← Voltar</button>
      </div>
    )
  }

  const score = painter.score as unknown as { overall_score?: number; completed_jobs_count?: number; response_rate?: number; acceptance_rate?: number; avg_response_time_minutes?: number } | undefined
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating_overall, 0) / reviews.length).toFixed(1) : null
  const pendingInteractions = interactions.filter(i => i.status === 'notified' || i.status === 'interested').length
  const acceptedInteractions = interactions.filter(i => i.status === 'accepted' || i.status === 'proposal_sent').length

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'profile', label: 'Perfil' },
    { id: 'requests', label: 'Solicitações', count: interactions.length },
    { id: 'reviews', label: 'Avaliações', count: reviews.length },
  ]

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/painters')} className="text-gray-400 hover:text-gray-700 cursor-pointer transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Perfil do Pintor</h1>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center text-brand font-bold text-xl shrink-0">
            {painter.user?.name?.[0]?.toUpperCase() || 'P'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{painter.user?.name}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={cn('text-xs px-2 py-0.5 rounded font-medium', KYC_COLORS[painter.kyc_status])}>
                    {KYC_LABELS[painter.kyc_status] || painter.kyc_status}
                  </span>
                  {painter.pro_plan_status === 'active' && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">PRO</span>
                  )}
                  <button
                    onClick={toggleAvailability}
                    className={cn('text-xs px-2 py-0.5 rounded font-medium cursor-pointer transition-colors',
                      painter.availability_status === 'available'
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}
                  >
                    {painter.availability_status === 'available' ? '● Disponível' : painter.availability_status === 'busy' ? '● Ocupado' : '● Pausado'}
                  </button>
                </div>
              </div>
              <Link
                to={`/admin/painters`}
                onClick={() => {}}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 cursor-pointer transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 flex-wrap">
              {painter.user?.phone && (
                <a href={`https://wa.me/55${painter.user.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-green-600 hover:text-green-700 transition-colors">
                  <MessageCircle className="w-3.5 h-3.5" />
                  {painter.user.phone}
                </a>
              )}
              {painter.user?.email && (
                <a href={`mailto:${painter.user.email}`} className="flex items-center gap-1 hover:text-gray-700 transition-colors">
                  <Mail className="w-3.5 h-3.5" />
                  {painter.user.email}
                </a>
              )}
              {painter.service_radius_km && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Raio {painter.service_radius_km} km
                </span>
              )}
              <span className="flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5" />
                {painter.years_experience} ano{painter.years_experience !== 1 ? 's' : ''} de exp.
              </span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-gray-50">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <p className="text-xl font-bold text-gray-900">{avgRating ?? score?.overall_score?.toFixed(1) ?? '—'}</p>
            </div>
            <p className="text-[10px] text-gray-400">{reviews.length > 0 ? `${reviews.length} avaliações` : 'Avaliação geral'}</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900">{score?.completed_jobs_count ?? 0}</p>
            <p className="text-[10px] text-gray-400">Jobs concluídos</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900">{pendingInteractions}</p>
            <p className="text-[10px] text-gray-400">Propostas abertas</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900">{acceptedInteractions}</p>
            <p className="text-[10px] text-gray-400">Aceitas / Enviadas</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('flex items-center gap-1.5 flex-1 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer justify-center',
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                tab === t.id ? 'bg-brand/10 text-brand' : 'bg-gray-200 text-gray-500')}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Profile */}
      {tab === 'profile' && (
        <div className="space-y-4">
          {/* Bio */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Bio / Apresentação</h3>
              {!editingBio && (
                <button onClick={() => setEditingBio(true)} className="text-xs text-brand cursor-pointer hover:text-brand-dark">
                  Editar
                </button>
              )}
            </div>
            {editingBio ? (
              <div>
                <textarea
                  value={bioValue}
                  onChange={e => setBioValue(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand resize-none"
                  placeholder="Descreva a experiência e diferenciais do pintor..."
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setEditingBio(false)} className="text-xs text-gray-400 cursor-pointer px-3 py-1.5">Cancelar</button>
                  <button onClick={saveBio} disabled={savingBio}
                    className="flex items-center gap-1.5 text-xs bg-brand text-white px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-60">
                    {savingBio && <Loader2 className="w-3 h-3 animate-spin" />}
                    Salvar
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 leading-relaxed">
                {painter.bio || <span className="text-gray-300 italic">Sem bio cadastrada</span>}
              </p>
            )}
          </div>

          {/* Specialties */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Especialidades</h3>
            {painter.specialties?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {painter.specialties.map(s => (
                  <span key={s} className="text-xs bg-orange-50 text-brand border border-orange-100 px-3 py-1.5 rounded-lg font-medium">
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-300 italic">Nenhuma especialidade cadastrada</p>
            )}
          </div>

          {/* Extra info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Informações adicionais</h3>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
              <div>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Transporte próprio</p>
                <p className="text-gray-700">{painter.has_transport ? '✅ Sim' : '❌ Não'}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Fornece material</p>
                <p className="text-gray-700">{painter.accepts_material_included ? '✅ Sim' : '❌ Não'}</p>
              </div>
              {painter.base_price_m2 && (
                <div>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Preço base / m²</p>
                  <p className="text-gray-700">R$ {painter.base_price_m2.toFixed(2)}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Cadastro</p>
                <p className="text-gray-700">{formatDate(painter.created_at)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Requests (lead_painter_interactions) */}
      {tab === 'requests' && (
        <div className="space-y-3">
          {interactions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <Users className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nenhuma solicitação enviada para este pintor ainda.</p>
            </div>
          ) : (
            interactions.map(inter => {
              const statusInfo = INTERACTION_STATUS[inter.status] || { label: inter.status, color: 'bg-gray-100 text-gray-600', icon: Clock }
              const Icon = statusInfo.icon
              return (
                <motion.div key={inter.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {inter.lead?.protocol && (
                          <span className="text-[10px] font-mono font-bold text-brand bg-orange-50 px-1.5 py-0.5 rounded">
                            {inter.lead.protocol}
                          </span>
                        )}
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1', statusInfo.color)}>
                          <Icon className="w-3 h-3" />
                          {statusInfo.label}
                        </span>
                        <span className="text-[10px] text-gray-400">{formatRelativeTime(inter.created_at)}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-800">{inter.lead?.name || '—'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {[inter.lead?.service_interest, inter.lead?.neighborhood].filter(Boolean).join(' · ')}
                      </p>
                      {inter.replied_at && (
                        <p className="text-[10px] text-gray-400 mt-1">
                          Respondeu {formatRelativeTime(inter.replied_at)} após a notificação
                        </p>
                      )}
                    </div>
                    {inter.lead?.id && (
                      <div className="flex flex-col gap-1 items-end shrink-0">
                        <Link to={`/portal/pintor/solicitacao/${inter.id}`}
                          className="text-xs text-brand hover:text-brand-dark cursor-pointer transition-colors flex items-center gap-1">
                          Ver como pintor →
                        </Link>
                        <Link to={`/admin/leads/${inter.lead.id}`}
                          className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer transition-colors">
                          Ver detalhes admin
                        </Link>
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      )}

      {/* Tab: Reviews */}
      {tab === 'reviews' && (
        <div className="space-y-4">
          {/* Summary bar */}
          {reviews.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900">{avgRating}</p>
                <StarDisplay value={Math.round(Number(avgRating))} size="sm" />
                <p className="text-[10px] text-gray-400 mt-1">{reviews.length} avaliação(ões)</p>
              </div>
              <div className="flex-1 space-y-1.5">
                {[5, 4, 3, 2, 1].map(n => {
                  const count = reviews.filter(r => r.rating_overall === n).length
                  const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0
                  return (
                    <div key={n} className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500 w-3">{n}</span>
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 shrink-0" />
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-yellow-400 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-gray-400 w-4 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {reviews.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <Star className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nenhuma avaliação para este pintor ainda.</p>
            </div>
          ) : (
            reviews.map(review => (
              <motion.div key={review.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className={cn('bg-white rounded-2xl border p-4',
                  review.rating_overall < 3 ? 'border-l-4 border-l-red-400 border-t-gray-100 border-r-gray-100 border-b-gray-100' : 'border-gray-100')}>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <StarDisplay value={review.rating_overall} />
                      {review.sentiment_label && (
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium',
                          review.sentiment_label === 'positive' ? 'bg-green-100 text-green-700' :
                          review.sentiment_label === 'negative' ? 'bg-red-100 text-red-600' :
                          'bg-gray-100 text-gray-600')}>
                          {review.sentiment_label === 'positive' ? 'Positivo' : review.sentiment_label === 'negative' ? 'Negativo' : 'Neutro'}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400">{formatDate(review.created_at)}</span>
                    </div>
                    {review.comment && <p className="text-sm text-gray-700 mb-2 leading-relaxed">"{review.comment}"</p>}
                    {review.ai_summary && <p className="text-xs text-gray-400 italic">IA: {review.ai_summary}</p>}
                    {(review.rating_quality || review.rating_punctuality) && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 pt-2 border-t border-gray-50">
                        {review.rating_quality && (
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Qualidade</span>
                            <StarDisplay value={review.rating_quality} size="sm" />
                          </div>
                        )}
                        {review.rating_punctuality && (
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Pontualidade</span>
                            <StarDisplay value={review.rating_punctuality} size="sm" />
                          </div>
                        )}
                        {review.rating_cleanliness && (
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Limpeza</span>
                            <StarDisplay value={review.rating_cleanliness} size="sm" />
                          </div>
                        )}
                        {review.rating_communication && (
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Comunicação</span>
                            <StarDisplay value={review.rating_communication} size="sm" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
