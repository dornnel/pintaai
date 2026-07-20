import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { User, Mail, Phone, Save, CheckCircle, AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'

function isAutoPhone(phone: string | undefined) {
  return !phone || phone.startsWith('auto_') || phone.trim() === ''
}

export function CustomerPerfil() {
  const { user, updateProfile, signOut } = useAuth()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    if (user) {
      setName(user.name ?? '')
      // Clear auto-generated placeholder so the field looks empty
      setPhone(isAutoPhone(user.phone) ? '' : (user.phone ?? ''))
    }
  }, [user])

  const phoneMissing = isAutoPhone(user?.phone)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user?.id) return
    if (!name.trim() || name.trim().length < 2) {
      setError('Nome precisa ter pelo menos 2 caracteres.')
      return
    }
    setError('')
    setSaving(true)

    const oldValues: Record<string, string> = {}
    const newValues: Record<string, string> = {}

    if (name.trim() !== user.name) {
      oldValues.name = user.name
      newValues.name = name.trim()
    }
    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone !== (user.phone ?? '').replace(/\D/g, '') && !isAutoPhone(user.phone) || (isAutoPhone(user.phone) && cleanPhone)) {
      oldValues.phone = user.phone ?? ''
      newValues.phone = phone.trim()
    }

    const updates: { name?: string; phone?: string } = {}
    if (newValues.name) updates.name = newValues.name
    if (newValues.phone !== undefined) updates.phone = phone.trim() || null as unknown as string

    if (Object.keys(updates).length > 0) {
      await updateProfile(updates)
      await logAudit({
        actor_user_id: user.id,
        entity_type: 'user',
        entity_id: user.id,
        action: 'profile_updated',
        old_values: oldValues,
        new_values: newValues,
      })
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleDeleteAccount() {
    if (deleteInput !== 'EXCLUIR') return
    setDeleting(true)
    setDeleteError('')
    const { data: { session } } = await supabase.auth.getSession()
    const { error: fnErr } = await supabase.functions.invoke('delete-account', {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    if (fnErr) {
      setDeleteError('Erro ao excluir conta. Tente novamente ou entre em contato.')
      setDeleting(false)
      return
    }
    await signOut()
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
        <p className="text-gray-500 text-sm mt-1">Informações da sua conta no Pintai.</p>
      </motion.div>

      {/* WhatsApp alert */}
      <AnimatePresence>
        {phoneMissing && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Adicione seu WhatsApp</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Os pintores entram em contato via WhatsApp após receberem sua proposta.
                Sem número cadastrado, você pode perder o contato.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
          {/* Name — editable */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Nome completo</label>
            <div className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-3.5 py-2.5 focus-within:border-brand bg-white transition-colors">
              <User className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Seu nome completo"
                className="flex-1 text-sm bg-transparent focus:outline-none"
                required minLength={2}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Alterações ficam registradas no histórico de auditoria.</p>
          </div>

          {/* Email — read-only */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">E-mail</label>
            <div className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-3.5 py-2.5 bg-gray-50">
              <Mail className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-500">{user?.email}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">O e-mail não pode ser alterado por aqui.</p>
          </div>

          {/* WhatsApp — editable */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">
              WhatsApp / Telefone
              {phoneMissing && <span className="ml-1.5 text-amber-500 font-semibold">· Obrigatório</span>}
            </label>
            <div className={`flex items-center gap-2.5 border rounded-xl px-3.5 py-2.5 focus-within:border-brand bg-white transition-colors ${phoneMissing ? 'border-amber-300' : 'border-gray-200'}`}>
              <Phone className={`w-4 h-4 shrink-0 ${phoneMissing ? 'text-amber-400' : 'text-gray-400'}`} />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(48) 99999-9999"
                className="flex-1 text-sm bg-transparent focus:outline-none"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Usado para os pintores entrarem em contato via WhatsApp.</p>
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

          <motion.button
            type="submit"
            disabled={saving}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full py-2.5 bg-brand text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition-colors hover:bg-orange-700">
            {saved
              ? <><CheckCircle className="w-4 h-4" /> Salvo!</>
              : saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                : <><Save className="w-4 h-4" /> Salvar alterações</>
            }
          </motion.button>
        </form>
      </motion.div>

      {/* ── Zona de perigo: excluir conta ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="mt-4 bg-white rounded-2xl border border-red-100 p-6">
        <div className="flex items-start gap-3 mb-4">
          <Trash2 className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Excluir minha conta</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Ação permanente e irreversível. Todos os seus dados serão removidos conforme a LGPD.
            </p>
          </div>
        </div>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors cursor-pointer font-medium"
          >
            Quero excluir minha conta
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-600">
              Para confirmar, digite <strong className="text-red-600">EXCLUIR</strong> abaixo:
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder="EXCLUIR"
              autoFocus
              className="w-full border border-red-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-red-400"
            />
            {deleteError && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteInput !== 'EXCLUIR' || deleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl font-semibold disabled:opacity-40 cursor-pointer hover:bg-red-700 transition-colors flex items-center gap-1.5"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Excluir permanentemente
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); setDeleteError('') }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
