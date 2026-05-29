import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Shield, Save, Loader2, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'

interface AdminPerm {
  id?: string
  user_id: string
  user_name: string
  user_email: string
  can_manage_users: boolean
  can_manage_painters: boolean
  can_approve_kyc: boolean
  can_view_payments: boolean
  can_manage_products: boolean
  can_view_all_crm: boolean
  can_ban_users: boolean
  can_manage_admins: boolean
  updated_at?: string
}

const PERM_LABELS: { key: keyof AdminPerm; label: string; desc: string }[] = [
  { key: 'can_manage_users', label: 'Gerenciar usuários', desc: 'Ver, editar e mudar status de usuários' },
  { key: 'can_manage_painters', label: 'Gerenciar pintores', desc: 'CRUD de pintores e validação de dados' },
  { key: 'can_approve_kyc', label: 'Aprovar KYC', desc: 'Revisar e aprovar/rejeitar documentação' },
  { key: 'can_view_payments', label: 'Ver pagamentos', desc: 'Acessar painel de escrow e comissões' },
  { key: 'can_manage_products', label: 'Gerenciar produtos', desc: 'CRUD de produtos e marketplace' },
  { key: 'can_view_all_crm', label: 'Ver CRM global', desc: 'Acesso ao pipeline de todos os workspaces' },
  { key: 'can_ban_users', label: 'Banir usuários', desc: 'Bloquear e desbanir usuários da plataforma' },
  { key: 'can_manage_admins', label: 'Gerenciar admins', desc: '⚠️ Apenas superadmin — criar e configurar admins' },
]

export function PermissionsPage() {
  const [admins, setAdmins] = useState<AdminPerm[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => { loadAdmins() }, [])

  async function loadAdmins() {
    const { data: users } = await supabase.from('users').select('id, name, email').eq('role', 'admin')
    const { data: perms } = await supabase.from('admin_permissions').select('*')

    const list: AdminPerm[] = (users || []).map(u => {
      const perm = (perms || []).find((p: { user_id: string }) => p.user_id === u.id)
      return {
        user_id: u.id,
        user_name: u.name,
        user_email: u.email,
        can_manage_users: perm?.can_manage_users ?? false,
        can_manage_painters: perm?.can_manage_painters ?? true,
        can_approve_kyc: perm?.can_approve_kyc ?? false,
        can_view_payments: perm?.can_view_payments ?? false,
        can_manage_products: perm?.can_manage_products ?? false,
        can_view_all_crm: perm?.can_view_all_crm ?? false,
        can_ban_users: perm?.can_ban_users ?? false,
        can_manage_admins: perm?.can_manage_admins ?? false,
        updated_at: perm?.updated_at,
      }
    })
    setAdmins(list)
    setLoading(false)
  }

  function togglePerm(userId: string, key: keyof AdminPerm, value: boolean) {
    setAdmins(prev => prev.map(a => a.user_id === userId ? { ...a, [key]: value } : a))
  }

  async function savePerms(admin: AdminPerm) {
    setSaving(admin.user_id)
    const permData = {
      user_id: admin.user_id,
      can_manage_users: admin.can_manage_users,
      can_manage_painters: admin.can_manage_painters,
      can_approve_kyc: admin.can_approve_kyc,
      can_view_payments: admin.can_view_payments,
      can_manage_products: admin.can_manage_products,
      can_view_all_crm: admin.can_view_all_crm,
      can_ban_users: admin.can_ban_users,
      can_manage_admins: admin.can_manage_admins,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('admin_permissions').upsert(permData, { onConflict: 'user_id' })
    setSaving(null)
    setSaved(admin.user_id)
    setTimeout(() => setSaved(null), 2000)
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Carregando...</div>

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Permissões de Admin</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure o que cada admin pode acessar na plataforma. Apenas superadmin pode gerenciar essas configurações.</p>
      </div>

      {admins.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Shield className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Nenhum admin encontrado além do superadmin.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {admins.map(admin => (
            <motion.div key={admin.user_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-bold">
                    {admin.user_name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{admin.user_name}</p>
                    <p className="text-xs text-gray-400">{admin.user_email}</p>
                    {admin.updated_at && <p className="text-xs text-gray-300">Atualizado {formatDate(admin.updated_at)}</p>}
                  </div>
                </div>
                <motion.button onClick={() => savePerms(admin)} disabled={saving === admin.user_id}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-[#FF7A30] to-brand text-white text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-60">
                  {saving === admin.user_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                   saved === admin.user_id ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  {saved === admin.user_id ? 'Salvo!' : 'Salvar'}
                </motion.button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PERM_LABELS.map(({ key, label, desc }) => (
                  <label key={key} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    (admin[key] as boolean) ? 'border-brand/30 bg-orange-50' : 'border-gray-100 hover:border-gray-200'
                  }`}>
                    <input type="checkbox" checked={admin[key] as boolean}
                      onChange={e => togglePerm(admin.user_id, key, e.target.checked)}
                      className="w-4 h-4 accent-brand mt-0.5 cursor-pointer shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
