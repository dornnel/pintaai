import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Briefcase, MapPin, Send, Zap } from 'lucide-react'
import { usePainterContext } from './PainterLayout'
import { formatCurrency } from '../../lib/utils'
import { cn } from '../../lib/utils'

export function PainterSolicitacoes() {
  const { leadInteractions, loading, declineInteraction } = usePainterContext()

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-white rounded-2xl border border-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Solicitações</h1>
        <p className="text-gray-500 text-sm mt-0.5">Pedidos de clientes na sua região.</p>
      </div>

      {leadInteractions.length === 0 ? (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-100 p-5">
            <p className="font-bold text-gray-900 mb-4 text-base">Como funciona</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { n: 1, icon: Zap, label: 'Receba pedidos', desc: 'Você será notificado quando houver um cliente perto de você' },
                { n: 2, icon: Briefcase, label: 'Veja os detalhes', desc: 'Confira o projeto, fotos e estimativa de preço da plataforma' },
                { n: 3, icon: Send, label: 'Envie proposta', desc: 'Monte seu orçamento e envie diretamente ao cliente' },
              ].map(({ n, icon: Icon, label, desc }) => (
                <div key={n} className="flex flex-col items-center text-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center font-bold text-sm">{n}</div>
                  <Icon className="w-5 h-5 text-brand" />
                  <p className="text-xs font-semibold text-gray-800">{label}</p>
                  <p className="text-[10px] text-gray-500 leading-snug">{desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Briefcase className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm font-medium">Nenhuma solicitação recebida ainda</p>
            <p className="text-gray-300 text-xs mt-1">Pedidos de clientes da sua região aparecerão aqui automaticamente.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {leadInteractions.map((interaction, i) => {
            const lead = interaction.lead
            const isNew = interaction.status === 'notified'
            const isSent = interaction.status === 'proposal_sent'
            return (
              <motion.div key={interaction.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{lead.service_interest ?? 'Pintura'}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs text-gray-500">{lead.neighborhood}</span>
                      {(lead.area_m2 || lead.num_rooms) && (
                        <span className="text-xs text-gray-400">
                          · {lead.area_m2 ? `${lead.area_m2}m²` : `${lead.num_rooms} cômodos`}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium shrink-0',
                    isSent ? 'bg-green-100 text-green-700' :
                    isNew ? 'bg-amber-100 text-amber-700 animate-pulse' :
                    'bg-blue-100 text-blue-700'
                  )}>
                    {isSent ? 'Proposta enviada' : isNew ? 'Novo' : 'Em avaliação'}
                  </span>
                </div>

                {lead.calc_price_min && lead.calc_price_max && (
                  <p className="text-xs text-gray-400 mb-3">
                    Estimativa plataforma:{' '}
                    <span className="font-semibold text-gray-700">
                      {formatCurrency(lead.calc_price_min)} – {formatCurrency(lead.calc_price_max)}
                    </span>
                  </p>
                )}

                <div className="flex gap-2">
                  <Link to={`/portal/pintor/solicitacao/${interaction.id}`}
                    className="flex-1 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-orange-600 transition-colors">
                    <Send className="w-3.5 h-3.5" />
                    {isSent ? 'Ver proposta' : 'Ver solicitação'}
                  </Link>
                  {!isSent && (
                    <motion.button
                      onClick={() => declineInteraction(interaction.id)}
                      whileTap={{ scale: 0.96 }}
                      className="px-4 py-2.5 border border-gray-200 text-gray-500 text-sm rounded-xl cursor-pointer hover:border-red-200 hover:text-red-500 transition-colors">
                      Recusar
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
