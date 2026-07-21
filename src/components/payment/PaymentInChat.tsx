import { useState } from 'react'
import { motion } from 'motion/react'
import { CreditCard, Smartphone, FileText, Copy, CheckCircle, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'

interface PaymentResult {
  transaction_id: string
  payment_url: string
  pix_qr_code?: string
  pix_copy_paste?: string
  boleto_url?: string
  gross_amount: number
  platform_fee: number
  painter_amount: number
}

interface Props {
  serviceRequestId: string
  quoteId: string
  amount: number
  painterName: string
  onPaymentCreated?: (result: PaymentResult) => void
}

type Method = 'PIX' | 'BOLETO' | 'CREDIT_CARD'

export function PaymentInChat({ serviceRequestId, quoteId, amount, painterName, onPaymentCreated }: Props) {
  const [method, setMethod] = useState<Method | null>(null)
  const [step, setStep] = useState<'choose' | 'form' | 'qr' | 'done'>('choose')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PaymentResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', cpf: '' })

  const platformFee = Math.round(amount * 0.08 * 100) / 100
  const painterAmt = amount - platformFee

  async function createPayment() {
    if (!method) return
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          service_request_id: serviceRequestId,
          quote_id: quoteId,
          customer_name: form.name || 'Cliente Pinte Rápido',
          customer_email: form.email || 'cliente@pintae.com',
          customer_cpf_cnpj: form.cpf.replace(/\D/g, '') || '00000000000',
          payment_method: method,
        },
      })
      if (error) throw error
      setResult(data)
      setStep(method === 'PIX' ? 'qr' : 'done')
      onPaymentCreated?.(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function copyPix() {
    if (!result?.pix_copy_paste) return
    await navigator.clipboard.writeText(result.pix_copy_paste)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const methods = [
    { id: 'PIX' as Method, icon: Smartphone, label: 'Pix', desc: 'Aprovação imediata' },
    { id: 'BOLETO' as Method, icon: FileText, label: 'Boleto', desc: 'Vence em 3 dias' },
    { id: 'CREDIT_CARD' as Method, icon: CreditCard, label: 'Cartão', desc: 'Parcelamento disponível' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-100 rounded-2xl p-4 w-full max-w-sm shadow-sm"
    >
      {step === 'choose' && (
        <>
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-1">Confirmar pagamento</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-900">{formatCurrency(amount)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Comissão da plataforma ({formatCurrency(platformFee)}) · {painterName} recebe {formatCurrency(painterAmt)}
            </p>
            <p className="text-xs text-green-600 mt-1 font-medium">
              ✓ Valor retido — só liberado após você aprovar o serviço
            </p>
          </div>

          <p className="text-xs font-medium text-gray-600 mb-2">Como deseja pagar?</p>
          <div className="space-y-2 mb-4">
            {methods.map(m => (
              <button key={m.id} onClick={() => setMethod(m.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer text-left ${
                  method === m.id ? 'border-brand bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <m.icon className={`w-4 h-4 shrink-0 ${method === m.id ? 'text-brand' : 'text-gray-400'}`} />
                <div>
                  <p className="text-sm font-medium text-gray-800">{m.label}</p>
                  <p className="text-xs text-gray-400">{m.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <motion.button
            onClick={() => method && setStep('form')}
            disabled={!method}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="w-full py-3 bg-brand text-white font-semibold rounded-xl text-sm disabled:opacity-40 cursor-pointer"
          >
            Continuar
          </motion.button>
        </>
      )}

      {step === 'form' && (
        <>
          <button onClick={() => setStep('choose')} className="text-xs text-gray-400 mb-4 cursor-pointer">← Voltar</button>
          <p className="text-sm font-semibold text-gray-900 mb-3">Seus dados para cobrança</p>
          <div className="space-y-3 mb-4">
            {[
              { key: 'name', label: 'Nome completo', placeholder: 'João da Silva', type: 'text' },
              { key: 'email', label: 'E-mail', placeholder: 'joao@email.com', type: 'email' },
              { key: 'cpf', label: 'CPF', placeholder: '000.000.000-00', type: 'text' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-gray-600 mb-1 block">{f.label}</label>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={(form as Record<string, string>)[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand"
                />
              </div>
            ))}
          </div>
          <motion.button
            onClick={createPayment} disabled={loading || !form.name || !form.email}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="w-full py-3 bg-brand text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Gerar {method === 'PIX' ? 'Pix' : method === 'BOLETO' ? 'Boleto' : 'Cobrança'}
          </motion.button>
        </>
      )}

      {step === 'qr' && result && (
        <>
          <div className="text-center mb-4">
            <CheckCircle className="w-6 h-6 text-brand mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-900">Pix gerado!</p>
            <p className="text-xs text-gray-400">{formatCurrency(result.gross_amount)}</p>
          </div>
          {result.pix_qr_code && (
            <div className="flex justify-center mb-3">
              <img src={`data:image/png;base64,${result.pix_qr_code}`} alt="QR Code Pix" className="w-40 h-40 rounded-xl border border-gray-100" />
            </div>
          )}
          <button onClick={copyPix}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-brand text-brand rounded-xl text-sm font-medium cursor-pointer hover:bg-orange-50 transition-colors">
            {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado!' : 'Copiar código Pix'}
          </button>
          <p className="text-center text-xs text-gray-400 mt-3">
            Após o pagamento, o serviço será agendado automaticamente.
          </p>
        </>
      )}

      {step === 'done' && result && (
        <div className="text-center py-4">
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
          <p className="font-semibold text-gray-900 mb-1">Cobrança gerada!</p>
          <p className="text-xs text-gray-400 mb-3">Valor retido na plataforma após pagamento.</p>
          <a href={result.payment_url} target="_blank" rel="noopener noreferrer"
            className="text-sm text-brand font-medium underline">
            Acessar link de pagamento →
          </a>
        </div>
      )}
    </motion.div>
  )
}
