import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Painter } from '../../lib/types'
import { cn } from '../../lib/utils'

const verificationColors = {
  unverified: 'bg-gray-100 text-gray-500',
  pending: 'bg-yellow-100 text-yellow-700',
  verified: 'bg-green-100 text-green-700',
}

export function PaintersPage() {
  const [painters, setPainters] = useState<Painter[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('painters')
        .select('*, user:users(name,phone,status), score:painter_scores(*)')
        .order('created_at', { ascending: false })
      setPainters((data as Painter[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Pintores</h1>
        <p className="text-sm text-gray-500 mt-0.5">{painters.length} profissional{painters.length !== 1 ? 'is' : ''} cadastrado{painters.length !== 1 ? 's' : ''}</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-gray-400">Carregando...</div>
      ) : (
        <div className="grid gap-3">
          {painters.map((p) => {
            const user = p.user as unknown as { name: string; phone: string; status: string }
            const score = p.score as unknown as { overall_score: number; completed_jobs_count: number }
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-brand font-bold text-sm shrink-0">
                  {user?.name?.[0]?.toUpperCase() || 'P'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 truncate">{user?.name || 'Pintor'}</p>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', verificationColors[p.verification_status])}>
                      {p.verification_status === 'verified' ? '✓ Verificado' : p.verification_status === 'pending' ? 'Pendente' : 'Não verificado'}
                    </span>
                    {p.pro_plan_status === 'active' && (
                      <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">PRO</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-400">{p.specialties.slice(0, 2).join(', ')}</span>
                    <span className={cn('text-xs', p.availability_status === 'available' ? 'text-green-500' : 'text-gray-400')}>
                      {p.availability_status === 'available' ? '● Disponível' : p.availability_status === 'busy' ? '● Ocupado' : '● Pausado'}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {score ? (
                    <>
                      <div className="flex items-center gap-1 justify-end">
                        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                        <span className="text-sm font-bold text-gray-900">{score.overall_score.toFixed(1)}</span>
                      </div>
                      <p className="text-xs text-gray-400">{score.completed_jobs_count} jobs</p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400">Sem score</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
