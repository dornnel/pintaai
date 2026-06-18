import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Briefcase, CheckCircle, User, Phone, Calendar, DollarSign, Package, ArrowRight } from 'lucide-react'
import { useCustomerContext } from './CustomerLayout'
import { formatCurrency, formatDate } from '../../lib/utils'

export function CustomerContratos() {
  const { leads, loading } = useCustomerContext()

  const contracted = leads.flatMap(lead => {
    const accepted = lead.lead_painter_interactions.find(i => i.status === 'accepted')
    if (!accepted) return []
    return [{ lead, interaction: accepted }]
  })

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="h-36 bg-white rounded-2xl border border-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pedidos Contratados</h1>
        <p className="text-gray-500 text-sm mt-1">Serviços que você confirmou com um pintor.</p>
      </motion.div>

      {contracted.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Briefcase className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Nenhum pedido contratado ainda.</p>
          <p className="text-gray-400 text-xs mt-1">
            Quando você aceitar uma proposta, ela aparecerá aqui.
          </p>
          <Link to="/minha-area/pedidos"
            className="inline-flex items-center gap-1.5 mt-4 text-sm text-brand font-medium hover:underline">
            Ver minhas solicitações <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {contracted.map(({ lead, interaction }, idx) => {
            const quote = interaction.metadata?.quote
            const painter = interaction.painter
            const painterName = painter?.user?.name ?? 'Pintor'
            const painterPhone = painter?.user?.phone

            return (
              <motion.div key={lead.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
                className="bg-white rounded-2xl border border-gray-100 p-5">

                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-gray-400">{lead.protocol}</span>
                      <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                        <CheckCircle className="w-3 h-3" /> Contratado
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">
                      {lead.service_interest ?? 'Pintura'}
                      {lead.neighborhood ? ` · ${lead.neighborhood}` : ''}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 shrink-0">{formatDate(lead.created_at)}</p>
                </div>

                {/* Painter info */}
                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl mb-4">
                  <div className="w-9 h-9 rounded-full bg-brand/20 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{painterName}</p>
                    {painterPhone && (
                      <a href={`tel:${painterPhone}`}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand transition-colors">
                        <Phone className="w-3 h-3" /> {painterPhone}
                      </a>
                    )}
                  </div>
                  {painter?.years_experience != null && (
                    <span className="text-xs text-gray-400 shrink-0">{painter.years_experience} anos exp.</span>
                  )}
                </div>

                {/* Quote details */}
                {quote && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl">
                      <DollarSign className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <div>
                        <p className="text-[10px] text-gray-400">Valor</p>
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(quote.total_price)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl">
                      <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <div>
                        <p className="text-[10px] text-gray-400">Prazo</p>
                        <p className="text-sm font-bold text-gray-900">{quote.duration_days}d</p>
                      </div>
                    </div>
                    {quote.includes_material && (
                      <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl col-span-2">
                        <Package className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <p className="text-xs text-gray-600">Material incluso</p>
                      </div>
                    )}
                    {quote.payment_terms && (
                      <div className="col-span-2 p-2.5 bg-gray-50 rounded-xl">
                        <p className="text-[10px] text-gray-400 mb-0.5">Pagamento</p>
                        <p className="text-xs text-gray-700">{quote.payment_terms}</p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
