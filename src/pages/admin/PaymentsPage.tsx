import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { DollarSign, CheckCircle, Clock, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn, formatCurrency, formatDate } from '../../lib/utils'

interface Transaction {
  id: string
  gross_amount: number
  platform_fee: number
  painter_amount: number
  payment_method: string
  status: string
  paid_at: string | null
  created_at: string
  service_request_id: string
  milestones: Milestone[]
}

interface Milestone {
  id: string
  name: string
  label: string
  percentage: number
  amount: number
  status: string
  approved_at: string | null
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  awaiting_payment: 'bg-yellow-100 text-yellow-700',
  held: 'bg-blue-100 text-blue-700',
  partially_released: 'bg-orange-100 text-orange-700',
  released: 'bg-green-100 text-green-700',
  refunded: 'bg-red-100 text-red-600',
  disputed: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente', awaiting_payment: 'Aguardando pagamento',
  held: 'Retido', partially_released: 'Parcialmente liberado',
  released: 'Liberado', refunded: 'Reembolsado', disputed: 'Disputado',
}

export function PaymentsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [releasing, setReleasing] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('payment_transactions')
      .select('*, milestones:payment_milestones(*)')
      .order('created_at', { ascending: false })
    setTransactions((data as Transaction[]) || [])
    setLoading(false)
  }

  async function approveMilestone(transactionId: string, milestoneId: string) {
    setReleasing(milestoneId)
    await supabase.from('payment_milestones').update({
      status: 'released',
      approved_at: new Date().toISOString(),
      released_at: new Date().toISOString(),
    }).eq('id', milestoneId)

    // Check if all milestones released → mark transaction as released
    const { data: remaining } = await supabase.from('payment_milestones')
      .select('status').eq('payment_transaction_id', transactionId).neq('name', 'booking_confirmed')
    const allReleased = (remaining || []).every((m: { status: string }) => m.status === 'released')

    await supabase.from('payment_transactions').update({
      status: allReleased ? 'released' : 'partially_released',
      updated_at: new Date().toISOString(),
    }).eq('id', transactionId)

    setReleasing(null)
    load()
  }

  // Summary stats
  const totalHeld = transactions.filter(t => t.status === 'held' || t.status === 'partially_released')
    .reduce((sum, t) => sum + t.painter_amount, 0)
  const totalFees = transactions.filter(t => ['held', 'partially_released', 'released'].includes(t.status))
    .reduce((sum, t) => sum + t.platform_fee, 0)
  const totalReleased = transactions.filter(t => t.status === 'released')
    .reduce((sum, t) => sum + t.painter_amount, 0)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Pagamentos & Escrow</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gestão de retenção e liberação por milestone</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: Clock, label: 'Retido', value: totalHeld, color: 'text-blue-500', bg: 'bg-blue-50' },
          { icon: CheckCircle, label: 'Liberado', value: totalReleased, color: 'text-green-600', bg: 'bg-green-50' },
          { icon: DollarSign, label: 'Comissões', value: totalFees, color: 'text-brand', bg: 'bg-orange-50' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-2`}>
              <Icon className={`w-4.5 h-4.5 ${color}`} />
            </div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(value)}</p>
            <p className="text-xs text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Transactions list */}
      {loading ? (
        <div className="text-center py-12 text-sm text-gray-400">Carregando...</div>
      ) : transactions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <DollarSign className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Nenhuma transação ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map(t => (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {/* Header */}
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-600')}>
                      {STATUS_LABELS[t.status] || t.status}
                    </span>
                    <span className="text-xs text-gray-400">{t.payment_method?.toUpperCase()} · {formatDate(t.created_at)}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-gray-900">{formatCurrency(t.gross_amount)}</span>
                    <span className="text-xs text-gray-400">→ pintor {formatCurrency(t.painter_amount)} · comissão {formatCurrency(t.platform_fee)}</span>
                  </div>
                </div>
                <button onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer">
                  {expanded === t.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>

              {/* Milestones */}
              {expanded === t.id && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  className="border-t border-gray-100 p-4">
                  <p className="text-xs font-semibold text-gray-600 mb-3">Milestones de liberação</p>
                  <div className="space-y-2">
                    {(t.milestones || []).sort((a, b) => a.percentage - b.percentage).map(m => (
                      <div key={m.id} className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm text-gray-700">{m.label}</p>
                          <p className="text-xs text-gray-400">
                            {m.percentage}% · {m.amount > 0 ? formatCurrency(m.amount) : 'Marco apenas'}
                            {m.approved_at && ` · ${formatDate(m.approved_at)}`}
                          </p>
                        </div>
                        <div>
                          {m.status === 'released' && (
                            <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> Liberado
                            </span>
                          )}
                          {m.status === 'pending' && m.percentage > 0 && t.status === 'held' && (
                            <motion.button
                              onClick={() => approveMilestone(t.id, m.id)}
                              disabled={releasing === m.id}
                              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                              className="text-xs px-3 py-1.5 bg-brand text-white rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                            >
                              {releasing === m.id && <Loader2 className="w-3 h-3 animate-spin" />}
                              Liberar {formatCurrency(m.amount)}
                            </motion.button>
                          )}
                          {m.status === 'pending' && m.percentage === 0 && (
                            <span className="text-xs text-gray-400">Marco</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
