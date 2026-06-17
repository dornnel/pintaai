import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  Briefcase, Send, CheckCircle, Star, MapPin, ChevronRight,
  Sparkles, Zap, Shield, CreditCard, TrendingUp,
} from 'lucide-react'
import { usePainterContext } from './PainterLayout'
import { formatCurrency } from '../../lib/utils'
import { cn } from '../../lib/utils'

export function PainterDashboard() {
  const { painter, score, leadInteractions, myQuotes, loading } = usePainterContext()

  const selectedCount = myQuotes.filter(q => q.status === 'selected').length
  const newCount = leadInteractions.filter(i => i.status === 'notified').length
  const recentInteractions = leadInteractions.slice(0, 3)
  const isPro = painter?.pro_plan_status === 'active' || painter?.pro_plan_status === 'trial'

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Welcome card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-brand to-orange-500 rounded-2xl p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-white/70 text-xs font-medium mb-1">Portal do Pintor</p>
            <h1 className="text-xl font-bold mb-1">
              {painter?.user ? `Olá, ${(painter.user as { name?: string }).name?.split(' ')[0]}!` : 'Bem-vindo!'}
            </h1>
            {score && score.overall_score > 0 ? (
              <div className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                <span className="text-sm font-semibold">{score.overall_score.toFixed(1)}</span>
                <span className="text-white/60 text-xs">· {score.reviews_count} avaliações</span>
              </div>
            ) : (
              <p className="text-white/70 text-xs">Complete trabalhos para ganhar avaliações</p>
            )}
          </div>
          {isPro ? (
            <div className="bg-white/20 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">PRO</span>
            </div>
          ) : (
            <div className="bg-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white/70">Grátis</div>
          )}
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="grid grid-cols-4 gap-3">
        {[
          { icon: Briefcase, label: 'Solicitações', value: leadInteractions.length, color: 'text-blue-500', to: '/portal/pintor/solicitacoes' },
          { icon: Send, label: 'Propostas', value: myQuotes.length, color: 'text-brand', to: '/portal/pintor/propostas' },
          { icon: CheckCircle, label: 'Selecionadas', value: selectedCount, color: 'text-green-500', to: '/portal/pintor/propostas' },
          { icon: Star, label: 'Score', value: score && score.overall_score > 0 ? score.overall_score.toFixed(1) : '—', color: 'text-amber-400', to: '/portal/pintor/avaliacoes' },
        ].map(({ icon: Icon, label, value, color, to }) => (
          <Link key={label} to={to} className="bg-white rounded-2xl border border-gray-100 p-3 text-center hover:border-brand/20 transition-colors">
            <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
            <p className="text-lg font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400 leading-tight">{label}</p>
          </Link>
        ))}
      </motion.div>

      {/* New solicitations alert */}
      {newCount > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">
                {newCount} nova{newCount > 1 ? 's' : ''} solicitação{newCount > 1 ? 'ões' : ''}!
              </p>
              <p className="text-xs text-gray-500">Clientes aguardando sua proposta</p>
            </div>
          </div>
          <Link to="/portal/pintor/solicitacoes"
            className="flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-900 shrink-0">
            Ver <ChevronRight className="w-4 h-4" />
          </Link>
        </motion.div>
      )}

      {/* Recent solicitations */}
      {recentInteractions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 text-sm">Solicitações recentes</h2>
            <Link to="/portal/pintor/solicitacoes" className="text-xs text-brand hover:text-brand-dark">
              Ver todas →
            </Link>
          </div>
          <div className="space-y-2">
            {recentInteractions.map(interaction => {
              const lead = interaction.lead
              const isSent = interaction.status === 'proposal_sent'
              const isNew = interaction.status === 'notified'
              return (
                <Link key={interaction.id} to={`/portal/pintor/solicitacao/${interaction.id}`}
                  className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between gap-3 hover:border-brand/20 transition-colors">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {lead.service_interest ?? 'Pintura'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-400 truncate">{lead.neighborhood}</span>
                      {lead.calc_price_min && lead.calc_price_max && (
                        <span className="text-xs text-gray-400">
                          · {formatCurrency(lead.calc_price_min)}–{formatCurrency(lead.calc_price_max)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
                    isSent ? 'bg-green-100 text-green-700' :
                    isNew ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-700'
                  )}>
                    {isSent ? 'Proposta enviada' : isNew ? 'Novo' : 'Em avaliação'}
                  </span>
                </Link>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Pro upsell — only if on free plan */}
      {!isPro && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 text-white">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-brand" />
            </div>
            <div>
              <p className="font-bold text-base mb-0.5">Experimente o Plano Pro</p>
              <p className="text-gray-400 text-xs leading-relaxed">
                Leads ilimitados, PDF de orçamento profissional, perfil em destaque e Selo Verificado Pintaê.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-brand shrink-0" />
            <span className="text-xs text-brand font-medium">30 dias grátis — sem cartão de crédito</span>
          </div>
          <Link to="/portal/pintor/assinatura"
            className="mt-3 w-full flex items-center justify-center gap-2 py-3 bg-brand text-white font-semibold rounded-xl text-sm hover:bg-orange-600 transition-colors">
            <CreditCard className="w-4 h-4" /> Ver planos
          </Link>
        </motion.div>
      )}

      {/* Empty state */}
      {leadInteractions.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-100 p-5">
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
        </motion.div>
      )}
    </div>
  )
}
