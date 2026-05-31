import { useState } from 'react'
import { motion } from 'motion/react'
import { Shield, X, Loader2 } from 'lucide-react'
import { useCPF, validateCPF, formatCPFMask } from '../hooks/useCPF'

interface Props {
  onVerified: () => void
  onCancel: () => void
}

export function CPFGate({ onVerified, onCancel }: Props) {
  const { saveCPF } = useCPF()
  const [cpf, setCpf] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clean = cpf.replace(/\D/g, '')
    if (!validateCPF(clean)) { setError('CPF inválido. Verifique os dígitos.'); return }
    setSaving(true); setError('')
    const result = await saveCPF(cpf)
    if (!result.ok) { setError(result.error || 'Erro ao salvar'); setSaving(false); return }
    onVerified()
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24 }} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">

        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-2xl bg-brand/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-brand" />
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-1">CPF necessário</h2>
        <p className="text-sm text-gray-500 mb-5">
          Para finalizar seu pedido com segurança, precisamos do seu CPF.
          Ele é usado apenas para identificação e não é compartilhado com terceiros.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">CPF</label>
            <input
              type="text"
              value={cpf}
              onChange={e => { setCpf(formatCPFMask(e.target.value)); setError('') }}
              placeholder="000.000.000-00"
              maxLength={14}
              inputMode="numeric"
              className={`w-full border rounded-xl px-4 py-3 text-base font-mono tracking-wider focus:outline-none transition-colors ${
                error ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-brand'
              }`}
            />
            {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
          </div>

          <p className="text-[11px] text-gray-400 mb-4">
            Seus dados são protegidos pela LGPD. <a href="/privacidade" target="_blank" className="text-brand hover:underline">Ver Política de Privacidade</a>
          </p>

          <div className="flex gap-3">
            <button type="button" onClick={onCancel}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 font-medium cursor-pointer hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving || cpf.replace(/\D/g, '').length < 11}
              className="flex-1 py-3 bg-brand text-white rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-brand-dark transition-colors">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : 'Confirmar'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
