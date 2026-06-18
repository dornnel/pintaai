import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Plus, FileText, MessageSquare, CheckCircle, Clock, ArrowRight, Paintbrush } from 'lucide-react'
import { useCustomerContext } from './CustomerLayout'
import { formatCurrency, formatDate } from '../../lib/utils'

export function CustomerDashboard() {
  const { leads, loading } = useCustomerContext()

  const totalProposals = leads.reduce((acc, l) =>
    acc + l.lead_painter_interactions.filter(i => i.status === 'proposal_sent' || i.status === 'accepted').length, 0)
  const totalContracted = leads.reduce((acc, l) =>
    acc + l.lead_painter_interactions.filter(i => i.status === 'accepted').length, 0)
  const recentLeads = leads.slice(0, 3)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Minha Área</h1>
        <p className="text-gray-500 text-sm mt-1">Acompanhe suas solicitações e as propostas dos pintores.</p>
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="grid grid-cols-3 gap-3 mb-6">
        {([
          { icon: FileText, label: 'Solicitações', value: leads.length, color: 'text-brand', bg: 'bg-orange-50', to: '/minha-area/pedidos' },
          { icon: MessageSquare, label: 'Propostas', value: totalProposals, color: 'text-blue-500', bg: 'bg-blue-50', to: '/minha-area/pedidos' },
          { icon: CheckCircle, label: 'Pedidos', value: totalContracted, color: 'text-green-500', bg: 'bg-green-50', to: '/minha-area/contratos' },
        ] as const).map(({ icon: Icon, label, value, color, bg, to }) => (
          <Link key={label} to={to}
            className="bg-white rounded-2xl border border-gray-100 p-4 text-center hover:border-gray-200 transition-colors">
            <div className={`w-8 h-8 ${bg} rounded-xl flex items-center justify-center mx-auto mb-2`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-xl font-bold text-gray-900">{loading ? '—' : value}</p>
            <p className="text-xs text-gray-400 leading-tight">{label}</p>
          </Link>
        ))}
      </motion.div>

      {/* New request CTA */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        whileHover={{ scale: 1.01 }}>
        <Link to="/chat"
          className="flex items-center justify-between bg-brand rounded-2xl p-5 mb-8 group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-white">Nova solicitação de orçamento</p>
              <p className="text-white/70 text-xs">Receba propostas de pintores qualificados</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" />
        </Link>
      </motion.div>

      {/* Recent orders */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Solicitações Recentes</h2>
          {leads.length > 3 && (
            <Link to="/minha-area/pedidos" className="text-xs text-brand font-medium hover:underline">
              Ver todos →
            </Link>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-20 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
          </div>
        ) : leads.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Paintbrush className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Nenhuma solicitação ainda.</p>
            <p className="text-gray-400 text-xs mt-1">Use o chat para solicitar um orçamento grátis!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentLeads.map(lead => {
              const proposals = lead.lead_painter_interactions.filter(
                i => i.status === 'proposal_sent' || i.status === 'accepted'
              )
              const accepted = lead.lead_painter_interactions.find(i => i.status === 'accepted')
              return (
                <Link key={lead.id} to="/minha-area/pedidos"
                  className="block bg-white rounded-2xl border border-gray-100 p-4 hover:border-gray-200 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-mono text-gray-400">{lead.protocol}</span>
                        {accepted ? (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Contratado</span>
                        ) : proposals.length > 0 ? (
                          <span className="text-xs px-2 py-0.5 bg-brand/10 text-brand rounded-full font-medium">
                            {proposals.length} proposta{proposals.length > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Aguardando
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-800">
                        {lead.service_interest ?? 'Pintura'}
                        {lead.neighborhood ? ` · ${lead.neighborhood}` : ''}
                      </p>
                      {lead.calc_price_min && lead.calc_price_max && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Est. {formatCurrency(lead.calc_price_min)} – {formatCurrency(lead.calc_price_max)}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 shrink-0">{formatDate(lead.created_at)}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
