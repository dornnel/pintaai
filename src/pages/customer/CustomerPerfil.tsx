import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { User, Mail, Phone, Save, CheckCircle } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

export function CustomerPerfil() {
  const { user } = useAuth()
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (user?.phone) setPhone(user.phone)
  }, [user])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user?.id) return
    setSaving(true)
    await supabase.from('users').update({ phone }).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
        <p className="text-gray-500 text-sm mt-1">Informações da sua conta no Pintai.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="bg-white rounded-2xl border border-gray-100 p-6">

        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
          <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
            <User className="w-6 h-6 text-brand" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user?.name}</p>
            <p className="text-sm text-gray-400">Cliente</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Nome completo</label>
            <div className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-3.5 py-2.5 bg-gray-50">
              <User className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-500">{user?.name}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">O nome é definido no cadastro e não pode ser alterado.</p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">E-mail</label>
            <div className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-3.5 py-2.5 bg-gray-50">
              <Mail className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-500">{user?.email}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">WhatsApp / Telefone</label>
            <div className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-3.5 py-2.5 focus-within:border-brand bg-white transition-colors">
              <Phone className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(48) 99999-9999"
                className="flex-1 text-sm bg-transparent focus:outline-none"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Usado para os pintores entrarem em contato.</p>
          </div>

          <motion.button
            type="submit"
            disabled={saving}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full py-2.5 bg-brand text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition-colors hover:bg-orange-700">
            {saved
              ? <><CheckCircle className="w-4 h-4" /> Salvo!</>
              : saving
                ? 'Salvando...'
                : <><Save className="w-4 h-4" /> Salvar alterações</>
            }
          </motion.button>
        </form>
      </motion.div>
    </div>
  )
}
