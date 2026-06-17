import { motion } from 'motion/react'
import { Send } from 'lucide-react'
import { usePainterContext } from './PainterLayout'
import { formatCurrency } from '../../lib/utils'
import { cn } from '../../lib/utils'

export function PainterPropostas() {
  const { myQuotes, loading } = usePainterContext()

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Propostas</h1>
        <p className="text-gray-500 text-sm mt-0.5">Orçamentos que você enviou para clientes.</p>
      </div>

      {myQuotes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Send className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Nenhuma proposta enviada ainda.</p>
          <p className="text-gray-300 text-xs mt-1">Acesse Solicitações para ver pedidos de clientes e enviar propostas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {myQuotes.map((q, i) => {
            const sr = (q as unknown as { service_request: { request_type: string; neighborhood: { name: string } } }).service_request
            return (
              <motion.div key={q.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-gray-900 capitalize">
                    {sr?.request_type?.replace('_', ' ')} · {sr?.neighborhood?.name}
                  </p>
                  <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium',
                    q.status === 'selected' ? 'bg-green-100 text-green-700' :
                    q.status === 'rejected' ? 'bg-red-100 text-red-600' :
                    'bg-yellow-100 text-yellow-700'
                  )}>
                    {q.status === 'selected' ? 'Selecionada' : q.status === 'rejected' ? 'Recusada' : 'Aguardando'}
                  </span>
                </div>
                <div className="flex gap-4 text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">{formatCurrency(q.total_price)}</span>
                  <span className="text-gray-400">{q.estimated_duration_days} dias</span>
                  <span className="text-gray-400">{q.material_included ? 'c/ material' : 's/ material'}</span>
                </div>
                {q.payment_terms && (
                  <p className="text-xs text-gray-400 mt-1.5">{q.payment_terms}</p>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
