import { useEffect, useState } from 'react'
import { Users, CreditCard, TrendingUp, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatDate, formatCurrency } from '../../lib/utils'

interface Subscription {
  id: string
  status: string
  current_period_end?: string
  created_at: string
  user: { name: string; email: string }
  plan: { name: string; price_monthly: number }
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  canceled: 'bg-red-100 text-red-600',
  past_due: 'bg-orange-100 text-orange-700',
  trialing: 'bg-blue-100 text-blue-700',
}

export function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('user_subscriptions')
      .select('*, user:users(name, email), plan:subscription_plans(name, price_monthly)')
      .order('created_at', { ascending: false })
    setSubscriptions((data || []) as unknown as Subscription[])
    setLoading(false)
  }

  async function cancelSubscription(id: string) {
    if (!confirm('Cancelar esta assinatura?')) return
    await supabase.from('user_subscriptions').update({ status: 'canceled', canceled_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  const active = subscriptions.filter(s => s.status === 'active').length
  const mrr = subscriptions.filter(s => s.status === 'active').reduce((sum, s) => sum + (s.plan?.price_monthly || 0), 0)
  const churnCount = subscriptions.filter(s => s.status === 'canceled').length

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Assinaturas</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gestão do plano Pintai Pro</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center"><Users className="w-4 h-4 text-green-600" /></div>
          <div><p className="text-2xl font-bold text-gray-900">{active}</p><p className="text-xs text-gray-500">Assinantes ativos</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-brand/10 rounded-xl flex items-center justify-center"><CreditCard className="w-4 h-4 text-brand" /></div>
          <div><p className="text-2xl font-bold text-gray-900">{formatCurrency(mrr)}</p><p className="text-xs text-gray-500">Receita mensal (MRR)</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center"><TrendingUp className="w-4 h-4 text-red-500" /></div>
          <div><p className="text-2xl font-bold text-gray-900">{churnCount}</p><p className="text-xs text-gray-500">Cancelamentos</p></div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-white rounded-2xl animate-pulse border border-gray-100" />)}</div>
      ) : subscriptions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <CreditCard className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Nenhum assinante ainda.</p>
          <p className="text-xs text-gray-300 mt-1">As assinaturas do plano Pintai Pro aparecerão aqui.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Assinante</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden sm:table-cell">Plano</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden md:table-cell">Próxima cobrança</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {subscriptions.map(sub => (
                <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{sub.user?.name}</p>
                    <p className="text-xs text-gray-400">{sub.user?.email}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <p className="text-sm text-gray-700">{sub.plan?.name}</p>
                    <p className="text-xs text-gray-400">{formatCurrency(sub.plan?.price_monthly)}/mês</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[sub.status] || 'bg-gray-100 text-gray-600'}`}>
                      {sub.status === 'active' ? 'Ativo' : sub.status === 'canceled' ? 'Cancelado' : sub.status === 'past_due' ? 'Em atraso' : 'Trial'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500">
                    {sub.current_period_end ? formatDate(sub.current_period_end) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      {sub.status === 'active' && (
                        <button onClick={() => cancelSubscription(sub.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 cursor-pointer transition-colors">
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
