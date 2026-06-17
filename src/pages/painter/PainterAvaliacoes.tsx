import { useState } from 'react'
import { motion } from 'motion/react'
import {
  Star, MessageSquare, User, Sparkles, CheckCircle, Loader2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { usePainterContext } from './PainterLayout'
import { cn } from '../../lib/utils'
import type { Review } from '../../lib/types'

// ─── Stars display ─────────────────────────────────────────────────────────────

function Stars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={cn('w-3.5 h-3.5', i < Math.round(value)
            ? 'fill-amber-400 text-amber-400'
            : 'text-gray-200 fill-gray-200'
          )}
        />
      ))}
    </div>
  )
}

// ─── Interactive star rating ──────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button"
          onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="cursor-pointer p-0.5">
          <Star className={cn('w-6 h-6 transition-colors',
            n <= (hover || value) ? 'fill-amber-400 text-amber-400' : 'text-gray-200 fill-gray-200'
          )} />
        </button>
      ))}
    </div>
  )
}

// ─── Review card ─────────────────────────────────────────────────────────────

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
            <Stars value={review.rating_overall} />
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

// ─── Customer review form (painter → customer) ────────────────────────────────

interface AcceptedLead {
  interactionId: string
  customerId: string
  leadProtocol: string
  leadService: string | null
}

function CustomerReviewForm({ lead, painterId, onDone }: { lead: AcceptedLead; painterId: string; onDone: () => void }) {
  const { user } = useAuth()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (rating === 0 || !user) return
    setLoading(true)

    await supabase.from('reviews').insert({
      customer_id: lead.customerId,
      provider_id: painterId,
      provider_type: 'painter',
      reviewer_id: user.id,
      direction: 'painter_to_customer',
      rating_overall: rating,
      comment: comment || null,
    })

    setDone(true)
    setLoading(false)
    setTimeout(onDone, 1500)
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 text-green-600 text-sm py-2">
        <CheckCircle className="w-4 h-4" />
        Avaliação enviada!
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3 pt-3 border-t border-gray-100 mt-3">
      <p className="text-xs text-gray-500 font-medium">Avaliar este cliente</p>
      <StarRating value={rating} onChange={setRating} />
      <textarea
        value={comment} onChange={e => setComment(e.target.value)} rows={2}
        placeholder="Como foi trabalhar com este cliente? (opcional)"
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand resize-none" />
      <motion.button type="submit" disabled={rating === 0 || loading}
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl disabled:opacity-50 cursor-pointer">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
        Enviar avaliação
      </motion.button>
    </form>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PainterAvaliacoes() {
  const { painter, score, leadInteractions, reviews, loading, reload } = usePainterContext()

  const acceptedLeads: AcceptedLead[] = leadInteractions
    .filter(i => i.status === 'accepted')
    .map(i => ({
      interactionId: i.id,
      customerId: '',
      leadProtocol: i.lead.protocol,
      leadService: i.lead.service_interest,
    }))

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="h-32 bg-white rounded-2xl border border-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Avaliações</h1>
        <p className="text-gray-500 text-sm mt-0.5">Feedback dos seus clientes.</p>
      </div>

      {/* Score summary */}
      {score && score.reviews_count > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-4xl font-bold text-gray-900">{score.overall_score.toFixed(1)}</p>
              <div className="flex justify-center mt-1">
                <Stars value={score.overall_score} />
              </div>
              <p className="text-xs text-gray-400 mt-1">{score.reviews_count} avaliações</p>
            </div>
            <div className="flex-1 space-y-1.5">
              {[
                { label: 'Qualidade', value: score.quality_score },
                { label: 'Pontualidade', value: score.punctuality_score },
                { label: 'Resposta', value: score.response_score },
                { label: 'Conversão', value: score.conversion_score },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="w-20 text-gray-500 shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand rounded-full" style={{ width: `${(value / 5) * 100}%` }} />
                  </div>
                  <span className="text-gray-700 font-medium w-6 text-right">{value.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Reviews received */}
      <div>
        <h2 className="font-semibold text-gray-900 text-sm mb-3">
          Avaliações recebidas ({reviews.length})
        </h2>
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
      </div>

      {/* Painter can review customers — for accepted interactions */}
      {acceptedLeads.length > 0 && painter && (
        <div>
          <h2 className="font-semibold text-gray-900 text-sm mb-3">
            Avaliar clientes
          </h2>
          <div className="space-y-3">
            {acceptedLeads.map(lead => (
              <motion.div key={lead.interactionId}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {lead.leadService ?? 'Pintura'} · {lead.leadProtocol}
                    </p>
                    <p className="text-xs text-gray-400">Proposta aceita</p>
                  </div>
                </div>
                <CustomerReviewForm lead={lead} painterId={painter.id} onDone={reload} />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
