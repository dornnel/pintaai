import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  CheckCircle, Zap, Shield, Gift, Clock, ChevronRight,
  Crown, CreditCard, Barcode, Loader2, ArrowLeft, X,
} from 'lucide-react'
import { usePainterContext } from './PainterLayout'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'

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
  'Selo "Verificado Pinte Rápido"',
  'Análise de desempenho (taxa de resposta e conversão)',
  'Suporte prioritário via WhatsApp',
]

type BillingType = 'PIX' | 'BOLETO' | 'CREDIT_CARD'
type Step = 'plans' | 'checkout' | 'success'

function CheckoutForm({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) {
  const [billing, setBilling] = useState<BillingType>('PIX')
  const [cpf, setCpf] = useState('')
  const [cardHolder, setCardHolder] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const body: Record<string, string> = { billing_type: billing, cpf_cnpj: cpf }
    if (billing === 'CREDIT_CARD') {
      const [month, year] = cardExpiry.split('/')
      body.card_holder_name = cardHolder
      body.card_number = cardNumber.replace(/\D/g, '')
      body.card_expiry_month = month?.trim()
      body.card_expiry_year = year?.trim()
      body.card_ccv = cardCvv
      body.card_holder_cpf_cnpj = cpf
    }
    const { error: fnErr } = await supabase.functions.invoke('create-subscription', {
      body,
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    if (fnErr) {
      setError('Erro ao processar pagamento. Verifique os dados e tente novamente.')
      setSubmitting(false)
      return
    }
    onSuccess()
  }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      className="bg-white rounded-2xl border border-gray-100 p-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-5 cursor-pointer">
        <ArrowLeft className="w-3.5 h-3.5" /> Voltar
      </button>
      <h2 className="text-base font-bold text-gray-900 mb-1">Assinar Plano Pro</h2>
      <p className="text-sm text-gray-500 mb-5">R$97/mês · Cancele a qualquer momento</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Billing method */}
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Forma de pagamento</p>
          <div className="grid grid-cols-3 gap-2">
            {([['PIX', 'Pix'], ['BOLETO', 'Boleto'], ['CREDIT_CARD', 'Cartão']] as [BillingType, string][]).map(([val, label]) => (
              <button key={val} type="button" onClick={() => setBilling(val)}
                className={cn('py-2.5 rounded-xl text-xs font-semibold border-2 cursor-pointer transition-colors flex flex-col items-center gap-1',
                  billing === val ? 'border-brand bg-orange-50 text-brand' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
                {val === 'CREDIT_CARD' ? <CreditCard className="w-4 h-4" /> : <Barcode className="w-4 h-4" />}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* CPF */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">CPF</label>
          <input value={cpf} onChange={e => setCpf(e.target.value)} required placeholder="000.000.000-00"
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand" />
        </div>

        {/* Card fields */}
        <AnimatePresence>
          {billing === 'CREDIT_CARD' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Nome no cartão</label>
                <input value={cardHolder} onChange={e => setCardHolder(e.target.value)} required placeholder="NOME SOBRENOME"
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand uppercase" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Número do cartão</label>
                <input value={cardNumber} onChange={e => setCardNumber(e.target.value)} required placeholder="0000 0000 0000 0000"
                  maxLength={19}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Validade (MM/AA)</label>
                  <input value={cardExpiry} onChange={e => setCardExpiry(e.target.value)} required placeholder="12/28" maxLength={5}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand font-mono" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">CVV</label>
                  <input value={cardCvv} onChange={e => setCardCvv(e.target.value)} required placeholder="123" maxLength={4}
                    type="password"
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand font-mono" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {billing !== 'CREDIT_CARD' && (
          <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
            {billing === 'PIX'
              ? 'Após confirmar, você receberá o QR Code Pix por email para ativar a assinatura.'
              : 'O boleto será enviado por email com vencimento em 3 dias úteis.'}
          </p>
        )}

        {error && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

        <button type="submit" disabled={submitting}
          className="w-full py-3 bg-brand text-white font-semibold rounded-xl cursor-pointer hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Processando...</>
            : <><Zap className="w-4 h-4" /> Confirmar assinatura — R$97/mês</>}
        </button>
        <p className="text-center text-[10px] text-gray-400">Cancele a qualquer momento · Sem fidelidade</p>
      </form>
    </motion.div>
  )
}

function CancelModal({ onConfirm, onClose, loading }: { onConfirm: () => void; onClose: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Cancelar assinatura?</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-gray-600 mb-5">Você perderá acesso aos leads e recursos Pro imediatamente. Não há reembolso proporcional.</p>
        <div className="flex gap-2">
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 cursor-pointer hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Cancelar assinatura
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 cursor-pointer">Manter</button>
        </div>
      </motion.div>
    </div>
  )
}

export function PainterSubscriptionPage() {
  const { painter, reload } = usePainterContext()
  const isPro = painter?.pro_plan_status === 'active'
  const isTrial = painter?.pro_plan_status === 'trial'
  const isAdminGranted = painter?.pro_granted_by_admin === true

  const [step, setStep] = useState<Step>('plans')
  const [showCancel, setShowCancel] = useState(false)
  const [canceling, setCanceling] = useState(false)

  async function handleCancel() {
    setCanceling(true)
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.functions.invoke('cancel-subscription', {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    setCanceling(false)
    setShowCancel(false)
    reload?.()
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">

      {showCancel && (
        <CancelModal onConfirm={handleCancel} onClose={() => setShowCancel(false)} loading={canceling} />
      )}

      <div>
        <h1 className="text-xl font-bold text-gray-900">Assinatura</h1>
        <p className="text-gray-500 text-sm mt-0.5">Escolha o plano ideal para seu negócio.</p>
      </div>

      {/* Success state */}
      <AnimatePresence mode="wait">
        {step === 'success' && (
          <motion.div key="success" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-green-900 mb-1">Assinatura ativada!</h2>
            <p className="text-sm text-green-700">Você agora tem acesso completo ao Plano Pro. Bem-vindo!</p>
          </motion.div>
        )}

        {/* Checkout step */}
        {step === 'checkout' && (
          <CheckoutForm key="checkout" onSuccess={() => { setStep('success'); reload?.() }} onBack={() => setStep('plans')} />
        )}

        {/* Plans step */}
        {step === 'plans' && (
          <motion.div key="plans" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Admin-granted badge */}
            {isPro && isAdminGranted && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-center gap-3">
                <Crown className="w-5 h-5 text-purple-600 shrink-0" />
                <div>
                  <p className="font-semibold text-purple-900 text-sm">Plano Pro — Cortesia Pinte Rápido</p>
                  <p className="text-xs text-purple-700">Ativado pelo time Pinte Rápido. Nenhum pagamento necessário.</p>
                </div>
              </motion.div>
            )}

            {/* Active paid badge + cancel option */}
            {(isPro || isTrial) && !isAdminGranted && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-green-900 text-sm">{isTrial ? 'Trial Pro ativo' : 'Plano Pro ativo'}</p>
                    <p className="text-xs text-green-700">Acesso completo a todos os recursos Pro.</p>
                  </div>
                </div>
                {isPro && !isTrial && (
                  <button onClick={() => setShowCancel(true)}
                    className="text-xs text-red-400 hover:text-red-600 cursor-pointer whitespace-nowrap shrink-0">
                    Cancelar
                  </button>
                )}
              </motion.div>
            )}

            {/* Trial promo banner — only for free users */}
            {!isPro && !isTrial && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-brand to-orange-400 rounded-2xl p-5 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="w-5 h-5" />
                  <span className="font-bold text-base">30 dias grátis — sem compromisso</span>
                </div>
                <p className="text-white/80 text-xs mb-4 leading-relaxed">
                  Comece agora com acesso completo ao Plano Pro. Cancele a qualquer momento antes do término.
                </p>
                <button onClick={() => setStep('checkout')}
                  className="inline-flex items-center gap-2 bg-white text-brand font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-orange-50 transition-colors cursor-pointer">
                  <Zap className="w-4 h-4" /> Começar agora
                </button>
              </motion.div>
            )}

            {/* Plan cards */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Free */}
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
                      <CheckCircle className="w-3.5 h-3.5 text-gray-400 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <div className="text-xs text-center text-gray-400 py-2">
                  {!isPro && !isTrial ? 'Plano atual' : 'Plano gratuito'}
                </div>
              </motion.div>

              {/* Pro */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className={cn('rounded-2xl border-2 bg-white p-5 relative overflow-hidden',
                  isPro ? 'border-purple-300' : 'border-brand')}>
                <div className={cn('absolute top-3 right-3 text-white text-[10px] font-bold px-2 py-0.5 rounded-full',
                  isAdminGranted ? 'bg-purple-500' : 'bg-brand')}>
                  {isAdminGranted ? 'CORTESIA' : 'RECOMENDADO'}
                </div>
                <div className="mb-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    {isAdminGranted ? <Crown className="w-4 h-4 text-purple-500" /> : <Shield className="w-4 h-4 text-brand" />}
                    <p className={cn('text-xs font-bold uppercase tracking-wide', isAdminGranted ? 'text-purple-600' : 'text-brand')}>Pro</p>
                  </div>
                  {isAdminGranted ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-gray-900">R$0</span>
                      <span className="text-xs text-purple-600 font-medium bg-purple-50 px-2 py-0.5 rounded-full">cortesia</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-gray-900">R$97</span>
                        <span className="text-gray-400 text-sm">/mês</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">ou R$77/mês no plano anual (R$924/ano)</p>
                    </>
                  )}
                </div>
                <ul className="space-y-2 mb-5">
                  {PRO_FEATURES.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle className={cn('w-3.5 h-3.5 shrink-0', isAdminGranted ? 'text-purple-500' : 'text-brand')} />{f}
                    </li>
                  ))}
                </ul>
                {isAdminGranted ? (
                  <div className="w-full flex items-center justify-center gap-2 py-3 bg-purple-100 text-purple-700 font-semibold rounded-xl text-sm">
                    <Crown className="w-4 h-4" /> Ativo — sem cobrança
                  </div>
                ) : isPro || isTrial ? (
                  <div className="w-full flex items-center justify-center gap-2 py-3 bg-green-100 text-green-700 font-semibold rounded-xl text-sm">
                    <CheckCircle className="w-4 h-4" /> Plano ativo
                  </div>
                ) : (
                  <button onClick={() => setStep('checkout')}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-brand text-white font-semibold rounded-xl text-sm hover:bg-orange-600 transition-colors cursor-pointer">
                    <Zap className="w-4 h-4" /> Assinar Pro
                  </button>
                )}
              </motion.div>
            </div>

            {/* Early adopter promo */}
            {!isAdminGranted && !isPro && !isTrial && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900 text-sm">Preço especial Early Adopter</p>
                  <p className="text-amber-800 text-xs mt-1 leading-relaxed">
                    Pintores que assinarem <strong>{EARLY_ADOPTER_DEADLINE}</strong> travam o preço em{' '}
                    <strong>R$67/mês para sempre</strong> — mesmo quando o preço padrão subir.
                  </p>
                  <button onClick={() => setStep('checkout')}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 cursor-pointer">
                    Quero esse preço <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* FAQ */}
            <div className="space-y-3">
              <h2 className="font-semibold text-gray-900 text-sm">Dúvidas frequentes</h2>
              {[
                { q: 'Como funciona o trial de 30 dias?', a: 'Você acessa todos os recursos Pro por 30 dias. Ao final, você decide se quer continuar ou voltar ao plano grátis.' },
                { q: 'Como cancelo?', a: 'Clique em "Cancelar" na página de assinatura. Cancelamos imediatamente, sem multa.' },
                { q: 'O preço pode aumentar?', a: 'Para quem assinar durante o lançamento, o preço fica congelado para sempre. Novos pintores pagarão o preço vigente.' },
              ].map(({ q, a }) => (
                <div key={q} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <p className="font-medium text-gray-900 text-sm mb-1.5">{q}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
