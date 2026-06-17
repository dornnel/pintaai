import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Send, MapPin, ChevronRight } from 'lucide-react'
import { usePainterContext } from './PainterLayout'
import { formatCurrency, formatDate } from '../../lib/utils'
import { cn } from '../../lib/utils'

export function PainterPropostas() {
  const { leadInteractions, loading } = usePainterContext()

  const sentInteractions = leadInteractions.filter(i =>
    i.status === 'proposal_sent' || i.status === 'accepted' || i.status === 'interested'
  )

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
        <p className="text-gray-500 text-sm mt-0.5">Orçamentos que você enviou ou está preparando.</p>
      </div>

      {sentInteractions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Send className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Nenhuma proposta enviada ainda.</p>
          <p className="text-gray-300 text-xs mt-1">Acesse Solicitações para ver pedidos de clientes e enviar propostas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sentInteractions.map((interaction, i) => {
            const lead = interaction.lead
            const quote = (interaction.metadata as { quote?: { total_price: number; includes_material: boolean; duration_days: number; notes?: string } })?.quote
            const isSent = interaction.status === 'proposal_sent'
            const isAccepted = interaction.status === 'accepted'

            return (
              <motion.div key={interaction.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link to={`/portal/pintor/solicitacao/${interaction.id}`}
                  className="block bg-white rounded-2xl border border-gray-100 p-5 hover:border-brand/20 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {lead.service_interest ?? 'Pintura'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="text-xs text-gray-400 truncate">{lead.neighborhood}</span>
                        {lead.created_at && (
                          <span className="text-xs text-gray-300">· {formatDate(lead.created_at)}</span>
                        )}
                      </div>
                    </div>
                    <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium shrink-0',
                      isAccepted ? 'bg-green-100 text-green-700' :
                      isSent ? 'bg-blue-100 text-blue-700' :
                      'bg-yellow-100 text-yellow-700'
                    )}>
                      {isAccepted ? 'Aceita' : isSent ? 'Enviada' : 'Em preparo'}
                    </span>
                  </div>

                  {quote ? (
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-bold text-gray-900">{formatCurrency(quote.total_price)}</span>
                      <span className="text-gray-400">{quote.duration_days} dias</span>
                      <span className="text-gray-400">{quote.includes_material ? 'c/ material' : 's/ material'}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">Sem proposta enviada ainda</p>
                  )}

                  <div className="flex items-center justify-end mt-2 text-xs text-brand">
                    Ver detalhes <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
