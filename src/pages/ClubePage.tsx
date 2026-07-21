import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  Crown, Sparkles, Shield, Users, Tag, Phone,
  CheckCircle, CreditCard, Barcode, Loader2, ArrowLeft, X,
  Star, Zap,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { cn } from '../lib/utils'

const BENEFITS = [
  { icon: Sparkles, title: '10 créditos de IA por mês', desc: 'Use a Prévia com IA para visualizar a pintura antes de contratar.', color: 'text-purple-600', bg: 'bg-purple-50' },
  { icon: Shield, title: 'Pintores parceiros certificados', desc: 'Acesso prioritário aos pintores verificados e avaliados pela Pinte Rápido.', color: 'text-blue-600', bg: 'bg-blue-50' },
  { icon: Tag, title: 'Descontos em materiais', desc: 'Descontos exclusivos com fornecedores parceiros de tinta, massa e primer.', color: 'text-green-600', bg: 'bg-green-50' },
  { icon: Users, title: 'Acompanhamento exclusivo', desc: 'Equipe dedicada da Pinte Rápido monitora seu projeto do início ao fim.', color: 'text-amber-600', bg: 'bg-amber-50' },
  { icon: Phone, title: 'WhatsApp dedicado', desc: 'Canal direto com especialistas para tirar dúvidas e resolver imprevistos.', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { icon: Zap, title: 'Retenção de pagamento', desc: 'O pagamento fica retido na plataforma e só é liberado após aprovação do serviço.', color: 'text-brand', bg: 'bg-orange-50' },
]

type BillingType = 'PIX' | 'BOLETO' | 'CREDIT_CARD'
type Step = 'landing' | 'checkout' | 'success'

interface ClubStatus { is_club_member: boolean; club_credits: number }

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
    const { error: fnErr } = await supabase.functions.invoke('create-club-subscription', {
      body,
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    if (fnErr) {
      setError('Erro ao processar. Verifique os dados e tente novamente.')
      setSubmitting(false)
      return
    }
    onSuccess()
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-5 cursor-pointer">
        <ArrowLeft className="w-3.5 h-3.5" /> Voltar
      </button>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
          <Crown className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900">Assinar o Clube</h2>
          <p className="text-sm text-gray-500">R$49/mês · Cancele a qualquer momento</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Forma de pagamento</p>
          <div className="grid grid-cols-3 gap-2">
            {([['PIX', 'Pix'], ['BOLETO', 'Boleto'], ['CREDIT_CARD', 'Cartão']] as [BillingType, string][]).map(([val, label]) => (
              <button key={val} type="button" onClick={() => setBilling(val)}
                className={cn('py-2.5 rounded-xl text-xs font-semibold border-2 cursor-pointer transition-colors flex flex-col items-center gap-1',
                  billing === val ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
                {val === 'CREDIT_CARD' ? <CreditCard className="w-4 h-4" /> : <Barcode className="w-4 h-4" />}
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">CPF</label>
          <input value={cpf} onChange={e => setCpf(e.target.value)} required placeholder="000.000.000-00"
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500" />
        </div>

        <AnimatePresence>
          {billing === 'CREDIT_CARD' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Nome no cartão</label>
                <input value={cardHolder} onChange={e => setCardHolder(e.target.value)} required placeholder="NOME SOBRENOME"
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500 uppercase" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Número do cartão</label>
                <input value={cardNumber} onChange={e => setCardNumber(e.target.value)} required placeholder="0000 0000 0000 0000"
                  maxLength={19} className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500 font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Validade</label>
                  <input value={cardExpiry} onChange={e => setCardExpiry(e.target.value)} required placeholder="MM/AA" maxLength={5}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500 font-mono" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">CVV</label>
                  <input value={cardCvv} onChange={e => setCardCvv(e.target.value)} required placeholder="123" maxLength={4}
                    type="password" className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500 font-mono" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {billing !== 'CREDIT_CARD' && (
          <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
            {billing === 'PIX' ? 'Você receberá o QR Code Pix por email para ativar o Clube.' : 'Boleto enviado por email com vencimento em 3 dias úteis.'}
          </p>
        )}

        {error && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

        <button type="submit" disabled={submitting}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Processando...</>
            : <><Crown className="w-4 h-4" /> Confirmar — R$49/mês</>}
        </button>
        <p className="text-center text-[10px] text-gray-400">Cancele a qualquer momento · Sem fidelidade</p>
      </form>
    </div>
  )
}

function CancelModal({ onConfirm, onClose, loading }: { onConfirm: () => void; onClose: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Cancelar o Clube?</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-gray-600 mb-5">Você perderá acesso às ferramentas de IA e demais benefícios imediatamente.</p>
        <div className="flex gap-2">
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 cursor-pointer hover:bg-red-700 flex items-center justify-center gap-1.5">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Cancelar assinatura
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 cursor-pointer">Manter</button>
        </div>
      </motion.div>
    </div>
  )
}

export function ClubePage() {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('landing')
  const [clubStatus, setClubStatus] = useState<ClubStatus | null>(null)
  const [showCancel, setShowCancel] = useState(false)
  const [canceling, setCanceling] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('users').select('is_club_member, club_credits')
      .eq('auth_user_id', user.id).maybeSingle()
      .then(({ data }) => setClubStatus(data))
  }, [user])

  const isMember = clubStatus?.is_club_member === true

  async function handleCancel() {
    setCanceling(true)
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.functions.invoke('cancel-club-subscription', {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    setClubStatus(prev => prev ? { ...prev, is_club_member: false } : null)
    setCanceling(false)
    setShowCancel(false)
  }

  return (
    <div className="max-w-2xl mx-auto pb-16">
      {showCancel && <CancelModal onConfirm={handleCancel} onClose={() => setShowCancel(false)} loading={canceling} />}

      <AnimatePresence mode="wait">

        {/* ── Success ── */}
        {step === 'success' && (
          <motion.div key="success" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="p-6 text-center pt-16">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center mx-auto mb-4">
              <Crown className="w-8 h-8 text-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Bem-vindo ao Clube!</h2>
            <p className="text-gray-500 text-sm mb-6">Seus 10 créditos de IA já estão disponíveis. Explore as ferramentas exclusivas.</p>
            <Link to="/ferramentas"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity cursor-pointer">
              <Sparkles className="w-4 h-4" /> Ir para Ferramentas
            </Link>
          </motion.div>
        )}

        {/* ── Checkout ── */}
        {step === 'checkout' && (
          <motion.div key="checkout" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="p-4 sm:p-6">
            <CheckoutForm onSuccess={() => setStep('success')} onBack={() => setStep('landing')} />
          </motion.div>
        )}

        {/* ── Landing ── */}
        {step === 'landing' && (
          <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Hero */}
            <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-950 px-6 pt-10 pb-12 text-white">
              <div className="absolute inset-0 opacity-5">
                {[...Array(6)].map((_, i) => (
                  <Star key={i} className="absolute text-white" style={{ top: `${10 + i * 15}%`, left: `${5 + i * 17}%`, width: 24, height: 24, opacity: 0.4 }} />
                ))}
              </div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-bold tracking-widest text-purple-300 uppercase">Clube Pinte Rápido</span>
                </div>
                <h1 className="text-2xl font-bold leading-tight mb-2">
                  Transforme sua reforma com<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-300">IA e pintores parceiros</span>
                </h1>
                <p className="text-gray-400 text-sm leading-relaxed mb-6">
                  Visualize o resultado antes de pintar, conte com pintores certificados e tenha toda a experiência gerenciada pela nossa equipe.
                </p>

                {isMember ? (
                  <div className="bg-white/10 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <div>
                        <p className="font-semibold text-sm">Membro ativo</p>
                        <p className="text-gray-400 text-xs">{clubStatus?.club_credits ?? 0} créditos disponíveis</p>
                      </div>
                    </div>
                    <button onClick={() => setShowCancel(true)} className="text-xs text-red-400 hover:text-red-300 cursor-pointer">Cancelar</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button onClick={() => user ? setStep('checkout') : window.location.assign('/entrar?next=/clube')}
                      className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl text-base hover:opacity-95 transition-opacity cursor-pointer flex items-center justify-center gap-2">
                      <Crown className="w-5 h-5" /> Assinar o Clube — R$49/mês
                    </button>
                    <p className="text-center text-gray-500 text-xs">10 créditos de IA inclusos · Cancele quando quiser</p>
                  </div>
                )}
              </div>
            </div>

            {/* Benefits */}
            <div className="p-4 sm:p-6 space-y-6">
              <div>
                <h2 className="font-bold text-gray-900 text-base mb-4">O que está incluso</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {BENEFITS.map(({ icon: Icon, title, desc, color, bg }) => (
                    <motion.div key={title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3">
                      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-4.5 h-4.5 ${color}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm mb-0.5">{title}</p>
                        <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Pricing */}
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-5">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-3xl font-bold text-gray-900">R$49</span>
                  <span className="text-gray-400 text-sm">/mês</span>
                </div>
                <p className="text-xs text-gray-500 mb-4">10 créditos de IA renovados mensalmente</p>
                <ul className="space-y-1.5 mb-5">
                  {['Prévia com IA — 10 gerações/mês', 'Pintores certificados Pinte Rápido', 'Acompanhamento exclusivo da equipe', 'Descontos em materiais parceiros'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle className="w-3.5 h-3.5 text-purple-500 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                {!isMember && (
                  <button onClick={() => user ? setStep('checkout') : window.location.assign('/entrar?next=/clube')}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl text-sm hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2">
                    <Crown className="w-4 h-4" /> Quero ser membro
                  </button>
                )}
              </div>

              {/* FAQ */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 text-sm">Perguntas frequentes</h3>
                {[
                  { q: 'O que são os créditos de IA?', a: 'Cada crédito gera uma prévia da pintura com IA. Você recebe 10 créditos por mês, renovados na data de renovação.' },
                  { q: 'Como funciona o acompanhamento exclusivo?', a: 'Nossa equipe gerencia todo o processo: indica pintores, acompanha o andamento e garante que o resultado atenda às expectativas.' },
                  { q: 'Como cancelo?', a: 'Cancele na página do Clube a qualquer momento, sem multa. Não há reembolso proporcional.' },
                ].map(({ q, a }) => (
                  <div key={q} className="bg-white rounded-2xl border border-gray-100 p-4">
                    <p className="font-medium text-gray-900 text-sm mb-1.5">{q}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{a}</p>
                  </div>
                ))}
              </div>

              <div className="text-center">
                <Link to="/ferramentas" className="text-xs text-gray-400 hover:text-gray-600">
                  Ver ferramentas gratuitas →
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
