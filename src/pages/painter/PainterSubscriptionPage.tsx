import { motion } from 'motion/react'
import {
  CheckCircle, Zap, Shield,
  Gift, Clock, ChevronRight,
} from 'lucide-react'
import { usePainterContext } from './PainterLayout'
import { cn } from '../../lib/utils'

// Early adopter deadline (60 days from now, hardcoded for v1)
const EARLY_ADOPTER_DEADLINE = 'até 15 de agosto de 2026'

const FREE_FEATURES = [
  'Até 3 leads por mês',
  '1 proposta ativa',
  'Perfil básico no marketplace',
  'Calculadora de tinta',
  'Suporte por email',
]

const PRO_FEATURES = [
  'Leads ilimitados + prioridade no envio',
  'Propostas ilimitadas',
  'PDF de orçamento profissional com logo',
  'Visualizador de cores para clientes',
  'Perfil em destaque no marketplace',
  'Selo "Verificado Pintaê"',
  'Análise de desempenho (taxa de resposta e conversão)',
  'Suporte prioritário via WhatsApp',
]

export function PainterSubscriptionPage() {
  const { painter } = usePainterContext()
  const isPro = painter?.pro_plan_status === 'active'
  const isTrial = painter?.pro_plan_status === 'trial'

  const whatsappUrl = `https://wa.me/5548999999999?text=Quero%20assinar%20o%20Plano%20Pro%20Pintai!%20Meu%20email%20de%20cadastro%20%C3%A9%3A%20`

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">

      <div>
        <h1 className="text-xl font-bold text-gray-900">Assinatura</h1>
        <p className="text-gray-500 text-sm mt-0.5">Escolha o plano ideal para seu negócio.</p>
      </div>

      {/* Current plan badge */}
      {(isPro || isTrial) && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-900 text-sm">
              {isTrial ? 'Trial Pro ativo' : 'Plano Pro ativo'}
            </p>
            <p className="text-xs text-green-700">
              {isTrial ? 'Aproveite todos os recursos Pro durante seu período de teste!' : 'Você tem acesso completo a todos os recursos.'}
            </p>
          </div>
        </motion.div>
      )}

      {/* Promo banner — trial offer */}
      {!isPro && !isTrial && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-brand to-orange-400 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-5 h-5" />
            <span className="font-bold text-base">30 dias grátis — sem cartão de crédito</span>
          </div>
          <p className="text-white/80 text-xs mb-4 leading-relaxed">
            Comece agora com acesso completo ao Plano Pro. Sem compromisso.
            Cancele a qualquer momento antes do término do teste.
          </p>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white text-brand font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-orange-50 transition-colors">
            <Zap className="w-4 h-4" /> Começar trial grátis
          </a>
        </motion.div>
      )}

      {/* Plans */}
      <div className="grid gap-4 sm:grid-cols-2">

        {/* Free plan */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className={cn('rounded-2xl border p-5', !isPro && !isTrial ? 'border-brand bg-orange-50/30' : 'border-gray-200 bg-white')}>
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Grátis</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-gray-900">R$0</span>
              <span className="text-gray-400 text-sm">/mês</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Para quem está começando</p>
          </div>

          <ul className="space-y-2 mb-5">
            {FREE_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <div className="text-xs text-center text-gray-400 py-2">Plano atual</div>
        </motion.div>

        {/* Pro plan */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl border-2 border-brand bg-white p-5 relative overflow-hidden">
          <div className="absolute top-3 right-3 bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            RECOMENDADO
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield className="w-4 h-4 text-brand" />
              <p className="text-xs font-bold text-brand uppercase tracking-wide">Pro</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-gray-900">R$97</span>
              <span className="text-gray-400 text-sm">/mês</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">ou R$77/mês no plano anual (R$924/ano)</p>
          </div>

          <ul className="space-y-2 mb-5">
            {PRO_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle className="w-3.5 h-3.5 text-brand shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3 bg-brand text-white font-semibold rounded-xl text-sm hover:bg-orange-600 transition-colors">
            {isPro || isTrial ? (
              <><CheckCircle className="w-4 h-4" /> Plano ativo</>
            ) : (
              <><Zap className="w-4 h-4" /> Assinar Pro</>
            )}
          </a>
        </motion.div>
      </div>

      {/* Early adopter promo */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
        <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-900 text-sm">Preço especial Early Adopter</p>
          <p className="text-amber-800 text-xs mt-1 leading-relaxed">
            Pintores que assinarem <strong>{EARLY_ADOPTER_DEADLINE}</strong> travam o preço em{' '}
            <strong>R$67/mês para sempre</strong> — mesmo quando o preço padrão subir.
          </p>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900">
            Quero esse preço <ChevronRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </motion.div>

      {/* Feature comparison */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">Comparativo de funcionalidades</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {[
            { label: 'Leads por mês', free: '3', pro: 'Ilimitados' },
            { label: 'Propostas simultâneas', free: '1', pro: 'Ilimitadas' },
            { label: 'PDF de orçamento', free: '—', pro: '✓ Com logo' },
            { label: 'Destaque no marketplace', free: '—', pro: '✓ Top 3' },
            { label: 'Selo Verificado', free: '—', pro: '✓' },
            { label: 'Análise de desempenho', free: '—', pro: '✓' },
            { label: 'Suporte', free: 'Email', pro: 'WhatsApp prioritário' },
          ].map(({ label, free, pro }) => (
            <div key={label} className="grid grid-cols-3 px-5 py-3 text-sm">
              <span className="text-gray-700">{label}</span>
              <span className="text-gray-400 text-center">{free}</span>
              <span className={cn('text-center font-medium', pro === '—' ? 'text-gray-400' : 'text-brand')}>{pro}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 px-5 py-2 text-xs text-gray-400 font-medium bg-gray-50 border-t border-gray-100">
          <span>Recurso</span>
          <span className="text-center">Grátis</span>
          <span className="text-center text-brand">Pro</span>
        </div>
      </motion.div>

      {/* FAQ */}
      <div className="space-y-3">
        <h2 className="font-semibold text-gray-900 text-sm">Dúvidas frequentes</h2>
        {[
          { q: 'Como funciona o trial de 30 dias?', a: 'Você acessa todos os recursos Pro por 30 dias. Não pedimos cartão de crédito. Ao final, você decide se quer continuar ou voltar ao plano grátis.' },
          { q: 'Como cancelo?', a: 'Entre em contato via WhatsApp e cancelamos imediatamente. Sem multa, sem burocracia.' },
          { q: 'O preço pode aumentar?', a: 'Para quem assinar durante o lançamento, o preço fica congelado para sempre. Novos pintores pagarão o preço vigente.' },
        ].map(({ q, a }) => (
          <div key={q} className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="font-medium text-gray-900 text-sm mb-1.5">{q}</p>
            <p className="text-xs text-gray-500 leading-relaxed">{a}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
