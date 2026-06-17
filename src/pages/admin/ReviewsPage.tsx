import { useEffect, useState } from 'react'
import { Star, TrendingDown, Trash2, AlertCircle } from 'lucide-react'
import { motion } from 'motion/react'
import { supabase } from '../../lib/supabase'
import { cn, formatDate } from '../../lib/utils'

interface Review {
  id: string
  rating_overall: number
  rating_quality?: number
  rating_punctuality?: number
  rating_cleanliness?: number
  rating_communication?: number
  comment?: string
  sentiment_label?: string
  sentiment_score?: number
  ai_summary?: string
  created_at: string
  provider_id: string
  customer_id?: string
  direction?: string
  reviewer_id?: string
  painter?: { user?: { name?: string } }
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'bg-green-100 text-green-700',
  neutral: 'bg-gray-100 text-gray-600',
  negative: 'bg-red-100 text-red-600',
  mixed: 'bg-yellow-100 text-yellow-700',
}

const SENTIMENT_LABELS: Record<string, string> = {
  positive: 'Positivo', neutral: 'Neutro', negative: 'Negativo', mixed: 'Misto',
}

function StarRow({ value, label }: { value?: number; label: string }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between text-xs text-gray-500">
      <span>{label}</span>
      <div className="flex gap-0.5">
        {[1,2,3,4,5].map(i => (
          <Star key={i} className={cn('w-2.5 h-2.5', i <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200')} />
        ))}
      </div>
    </div>
  )
}

export function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [painterReviews, setPainterReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'low' | 'negative'>('all')
  const [tab, setTab] = useState<'customer_to_painter' | 'painter_to_customer'>('customer_to_painter')

  useEffect(() => { loadReviews() }, [])

  async function loadReviews() {
    const [resAll, resPainter] = await Promise.all([
      supabase.from('reviews')
        .select('*, painter:painters!reviews_provider_id_fkey(user:users!painters_user_id_fkey(name))')
        .or('direction.is.null,direction.eq.customer_to_painter')
        .order('created_at', { ascending: false }),
      supabase.from('reviews')
        .select('*')
        .eq('direction', 'painter_to_customer')
        .order('created_at', { ascending: false }),
    ])
    setReviews((resAll.data as unknown as Review[]) || [])
    setPainterReviews((resPainter.data as unknown as Review[]) || [])
    setLoading(false)
  }

  async function removeReview(id: string) {
    if (!confirm('Remover esta avaliação? Esta ação será registrada no log de auditoria.')) return
    await supabase.from('reviews').delete().eq('id', id)
    await supabase.from('audit_logs').insert({
      entity_type: 'review', entity_id: id, action: 'admin_removed',
      new_values: { removed_by: 'admin', reason: 'admin_moderation' },
    })
    setReviews(prev => prev.filter(r => r.id !== id))
  }

  const activeReviews = tab === 'customer_to_painter' ? reviews : painterReviews
  const avgRating = activeReviews.length > 0 ? activeReviews.reduce((s, r) => s + r.rating_overall, 0) / activeReviews.length : 0
  const filtered = activeReviews.filter(r => {
    if (filter === 'low') return r.rating_overall < 3
    if (filter === 'negative') return r.sentiment_label === 'negative'
    return true
  })

  // Rating distribution
  const dist = [5,4,3,2,1].map(n => ({
    n, count: activeReviews.filter(r => r.rating_overall === n).length,
    pct: activeReviews.length > 0 ? (activeReviews.filter(r => r.rating_overall === n).length / activeReviews.length) * 100 : 0
  }))

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Avaliações</h1>
        <p className="text-sm text-gray-500 mt-0.5">{activeReviews.length} avaliações · Média: {avgRating.toFixed(1)} ★</p>
      </div>

      {/* Direction tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit">
        {([
          { id: 'customer_to_painter', label: `Clientes → Pintores (${reviews.length})` },
          { id: 'painter_to_customer', label: `Pintores → Clientes (${painterReviews.length})` },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Distribution + filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 lg:col-span-1">
          <p className="text-sm font-semibold text-gray-700 mb-3">Distribuição</p>
          <div className="space-y-1.5">
            {dist.map(({ n, count, pct }) => (
              <div key={n} className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 w-4 text-right">{n}</span>
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 shrink-0" />
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-yellow-400 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-gray-400 w-6">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 flex items-start gap-2 flex-wrap">
          {(['all', 'low', 'negative'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors border',
                filter === f ? 'bg-brand text-white border-brand' : 'bg-white border-gray-200 text-gray-600 hover:border-brand hover:text-brand')}>
              {f === 'all' && 'Todas'}
              {f === 'low' && <><TrendingDown className="w-3.5 h-3.5" /> Nota baixa (&lt; 3)</>}
              {f === 'negative' && <><AlertCircle className="w-3.5 h-3.5" /> Sentimento negativo</>}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews list */}
      {loading ? (
        <div className="text-center py-8 text-sm text-gray-400">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Star className="w-10 h-10 text-gray-200 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Nenhuma avaliação encontrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(review => (
            <motion.div key={review.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={cn('bg-white rounded-2xl border p-5', review.rating_overall < 3 && 'border-l-4 border-l-red-400 border-t-gray-100 border-r-gray-100 border-b-gray-100')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  {review.painter?.user?.name && (
                    <p className="text-xs font-semibold text-brand mb-1.5">{review.painter.user.name}</p>
                  )}
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} className={cn('w-4 h-4', i <= review.rating_overall ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200')} />
                      ))}
                    </div>
                    {review.sentiment_label && (
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', SENTIMENT_COLORS[review.sentiment_label])}>
                        {SENTIMENT_LABELS[review.sentiment_label]}
                        {review.sentiment_score !== undefined && ` (${Math.round(review.sentiment_score * 100)}%)`}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{formatDate(review.created_at)}</span>
                  </div>

                  {review.comment && (
                    <p className="text-sm text-gray-700 mb-3 leading-relaxed">"{review.comment}"</p>
                  )}

                  {review.ai_summary && (
                    <p className="text-xs text-gray-400 italic mb-3">IA: {review.ai_summary}</p>
                  )}

                  <div className="grid grid-cols-2 gap-1">
                    <StarRow value={review.rating_quality} label="Qualidade" />
                    <StarRow value={review.rating_punctuality} label="Pontualidade" />
                    <StarRow value={review.rating_cleanliness} label="Limpeza" />
                    <StarRow value={review.rating_communication} label="Comunicação" />
                  </div>
                </div>

                <button onClick={() => removeReview(review.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 text-red-400 hover:bg-red-100 cursor-pointer transition-colors shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
