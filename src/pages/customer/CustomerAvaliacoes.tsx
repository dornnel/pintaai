import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Star, MessageSquare } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { formatDate } from '../../lib/utils'

interface ReceivedReview {
  id: string
  rating: number
  content: string | null
  created_at: string
  reviewer_id: string | null
  reviewer_user: { name: string } | null
}

function StarRow({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`${cls} ${i <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} />
      ))}
    </div>
  )
}

export function CustomerAvaliacoes() {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<ReceivedReview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('reviews')
      .select('id, rating, content, created_at, reviewer_id, reviewer_user:users!reviewer_id(name)')
      .eq('customer_id', user.id)
      .eq('direction', 'painter_to_customer')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setReviews((data as unknown as ReceivedReview[]) ?? [])
        setLoading(false)
      })
  }, [user])

  const avg = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Avaliações</h1>
        <p className="text-gray-500 text-sm mt-1">O que os pintores disseram sobre você após cada serviço.</p>
      </motion.div>

      {!loading && reviews.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 flex items-center gap-5">
          <div className="text-5xl font-bold text-gray-900 leading-none">{avg.toFixed(1)}</div>
          <div>
            <StarRow rating={Math.round(avg)} size="md" />
            <p className="text-sm text-gray-500 mt-1">
              Média de {reviews.length} avaliação{reviews.length > 1 ? 'ões' : ''}
            </p>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Nenhuma avaliação recebida ainda.</p>
          <p className="text-gray-400 text-xs mt-1">As avaliações aparecerão aqui após concluir um serviço.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review, i) => (
            <motion.div key={review.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <StarRow rating={review.rating} />
                  <p className="text-xs text-gray-400 mt-1">
                    {review.reviewer_user?.name ?? 'Pintor'} · {formatDate(review.created_at)}
                  </p>
                </div>
                <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                  <Star className="w-3.5 h-3.5 text-brand" />
                </div>
              </div>
              {review.content && (
                <p className="text-sm text-gray-700 leading-relaxed">{review.content}</p>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
