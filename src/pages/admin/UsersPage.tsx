import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Search, Plus, UserX, UserCheck, Loader2, X, Mail,
  Phone, User, Shield, CheckCircle, Clock, AlertCircle,
  Edit2, Eye, Send, Trash2, Save,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { cn, formatDate, formatRelativeTime } from '../../lib/utils'
import { Link } from 'react-router-dom'
import { logAudit } from '../../lib/audit'

interface UserRecord {
  id: string
  name: string
  email: string
  phone?: string
  role: string
  roles?: string[]
  status: string
  registration_source?: string
  banned_at?: string
  ban_reason?: string
  cpf?: string
  terms_accepted_at?: string
  cookie_consent?: string
  created_at: string
  auth_user_id?: string
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  customer: 'bg-blue-100 text-blue-700',
  painter: 'bg-orange-100 text-orange-700',
  partner: 'bg-green-100 text-green-700',
  artist: 'bg-pink-100 text-pink-700',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  customer: 'Cliente',
  painter: 'Pintor',
  partner: 'Parceiro',
  artist: 'Artista',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  invited: 'bg-blue-100 text-blue-600',
  blocked: 'bg-red-100 text-red-600',
  archived: 'bg-gray-100 text-gray-500',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  pending: 'Pendente',
  invited: 'Convidado',
  blocked: 'Bloqueado',
  archived: 'Arquivado',
}

const SOURCE_LABELS: Record<string, string> = {
  web: '🌐 Web',
  chat: '💬 Chat',
  whatsapp: '📱 WhatsApp',
  admin: '🔧 Admin',
}

// ─── Invite User Modal ────────────────────────────────────────────────────────

function InviteUserModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('customer')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      // Check if email already exists
      const { data: existing } = await supabase
        .from('users').select('id, status').eq('email', email).maybeSingle()

      if (existing) {
        setError('Este e-mail já está cadastrado.')
        setLoading(false)
        return
      }

      // Create profile record with status 'invited'
      const { error: insertErr } = await supabase.from('users').insert({
        name,
        email,
        phone: phone || null,
        role,
        status: 'invited',
        registration_source: 'admin',
        auth_user_id: `pending_${email}`,
      })

      if (insertErr) throw insertErr

      // Send invite email
      await supabase.functions.invoke('send-notification-email', {
        body: {
          to: email,
          name,
          protocol: 'CONVITE',
          neighborhood: '',
          service_type: '',
          summary: `Você foi convidado para a plataforma Pintai!\n\nAcesse o link abaixo para criar sua conta:\n${window.location.origin}/login?tab=register\n\nSeu papel: ${role}`,
        },
      })

      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao convidar usuário')
    }
    setLoading(false)
  }

  if (done) return (
    <div className="text-center py-4">
      <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
      <p className="font-semibold text-gray-900">Convite enviado para {email}!</p>
      <p className="text-xs text-gray-400 mt-1">O usuário receberá um e-mail com o link de cadastro.</p>
      <button onClick={() => { onClose(); onDone() }}
        className="mt-4 px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold cursor-pointer">
        Fechar
      </button>
    </div>
  )

  return (
    <form onSubmit={handleInvite} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Nome completo *</label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={name} onChange={e => setName(e.target.value)} required
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand"
            placeholder="Nome do usuário" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">E-mail *</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand"
            placeholder="email@exemplo.com" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Celular</label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand"
            placeholder="(48) 9 9999-9999" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Papel</label>
        <select value={role} onChange={e => setRole(e.target.value)}
          className="w-full border border-gray-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:border-brand bg-white">
          <option value="customer">Cliente</option>
          <option value="painter">Pintor</option>
          <option value="partner">Parceiro / Loja</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 cursor-pointer">
          Cancelar
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Enviar convite
        </button>
      </div>
    </form>
  )
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────

function EditUserModal({ user, onClose, onSaved }: {
  user: UserRecord; onClose: () => void; onSaved: (u: UserRecord) => void
}) {
  const [name, setName] = useState(user.name)
  const [phone, setPhone] = useState(user.phone || '')
  const [role, setRole] = useState(user.role)
  const [status, setStatus] = useState(user.status)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error: err } = await supabase.from('users')
      .update({ name, phone: phone || null, role, status, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (err) { setError(err.message); setLoading(false); return }
    onSaved({ ...user, name, phone, role, status })
    onClose()
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Nome completo</label>
        <input value={name} onChange={e => setName(e.target.value)} required
          className="w-full border border-gray-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:border-brand" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">E-mail</label>
        <input value={user.email} disabled
          className="w-full border border-gray-100 rounded-xl text-sm px-3 py-2.5 bg-gray-50 text-gray-400" />
        <p className="text-[10px] text-gray-400 mt-1">O e-mail não pode ser alterado aqui.</p>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Celular</label>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
          className="w-full border border-gray-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:border-brand"
          placeholder="(48) 9 9999-9999" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Papel</label>
          <select value={role} onChange={e => setRole(e.target.value)}
            className="w-full border border-gray-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:border-brand bg-white">
            <option value="customer">Cliente</option>
            <option value="painter">Pintor</option>
            <option value="partner">Parceiro</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="w-full border border-gray-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:border-brand bg-white">
            <option value="active">Ativo</option>
            <option value="pending">Pendente</option>
            <option value="blocked">Bloqueado</option>
            <option value="archived">Arquivado</option>
          </select>
        </div>
      </div>
      {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 cursor-pointer">
          Cancelar
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Salvar alterações
        </button>
      </div>
    </form>
  )
}

// ─── User Detail Drawer ───────────────────────────────────────────────────────

function UserDetailDrawer({ user, onClose, onUpdated, onDeleted, isSuperAdmin, actorUserId }: {
  user: UserRecord; onClose: () => void; onUpdated: (u: UserRecord) => void
  onDeleted: (id: string) => void; isSuperAdmin: boolean; actorUserId?: string
}) {
  const [showEdit, setShowEdit] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function handleDelete() {
    setDeleting(true); setDeleteError('')
    const { error } = await supabase.functions.invoke('admin-delete-user', {
      body: { authUserId: user.auth_user_id, appUserId: user.id },
    })
    if (error) {
      setDeleteError('Erro ao excluir. Tente novamente.')
      setDeleting(false)
      return
    }
    await logAudit({
      actor_user_id: actorUserId,
      entity_type: 'user',
      entity_id: user.id,
      action: 'user_deleted',
      old_values: { name: user.name, email: user.email, role: user.role, status: user.status },
    })
    onDeleted(user.id)
    onClose()
  }

  async function setStatus(status: string) {
    setSavingStatus(true)
    const oldStatus = user.status
    await supabase.from('users').update({ status }).eq('id', user.id)
    await logAudit({
      actor_user_id: actorUserId,
      entity_type: 'user',
      entity_id: user.id,
      action: status === 'blocked' ? 'user_banned' : 'user_unbanned',
      old_values: { status: oldStatus },
      new_values: { status },
    })
    onUpdated({ ...user, status })
    setSavingStatus(false)
  }

  const lgpdAccepted = !!user.terms_accepted_at
  const cookieConsent = user.cookie_consent || 'pending'

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-end"
      onClick={onClose}>
      <motion.aside initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="h-full w-full max-w-sm bg-white shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <h3 className="font-bold text-gray-900">Perfil do usuário</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {showEdit ? (
          <div className="p-5">
            <button onClick={() => setShowEdit(false)} className="text-xs text-brand mb-4 cursor-pointer hover:underline">← Voltar</button>
            <EditUserModal user={user} onClose={() => setShowEdit(false)}
              onSaved={u => { onUpdated(u); setShowEdit(false) }} />
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Avatar + dados principais */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white text-xl font-bold shrink-0">
                {user.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-900 text-base">{user.name}</p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
                {user.phone && <p className="text-xs text-gray-500 mt-0.5">{user.phone}</p>}
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-600')}>
                    {user.role}
                  </span>
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', STATUS_COLORS[user.status] || 'bg-gray-100 text-gray-600')}>
                    {STATUS_LABELS[user.status] || user.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Cadastro</span>
                <span className="font-medium text-gray-800">{formatDate(user.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Origem</span>
                <span className="font-medium text-gray-800">{SOURCE_LABELS[user.registration_source || 'web'] || '—'}</span>
              </div>
              {user.cpf && (
                <div className="flex justify-between">
                  <span className="text-gray-500">CPF</span>
                  <span className="font-medium font-mono text-gray-800">
                    {user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                  </span>
                </div>
              )}
            </div>

            {/* LGPD / Compliance */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> LGPD e Conformidade
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Termos de Uso</span>
                  {lgpdAccepted ? (
                    <span className="flex items-center gap-1 text-green-700 font-medium">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Aceito {formatRelativeTime(user.terms_accepted_at!)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-yellow-600 font-medium">
                      <Clock className="w-3.5 h-3.5" /> Pendente
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Consentimento de cookies</span>
                  <span className={cn('font-medium', {
                    'text-green-700': cookieConsent === 'all',
                    'text-blue-600': cookieConsent === 'essential',
                    'text-yellow-600': cookieConsent === 'pending',
                    'text-red-600': cookieConsent === 'rejected',
                  })}>
                    {cookieConsent === 'all' ? '✓ Todos' :
                     cookieConsent === 'essential' ? '⚡ Essenciais' :
                     cookieConsent === 'rejected' ? '✗ Rejeitado' : '⏳ Pendente'}
                  </span>
                </div>
                {user.banned_at && (
                  <div className="p-2.5 bg-red-50 rounded-lg border border-red-100">
                    <p className="font-semibold text-red-700 mb-0.5 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Banido em {formatDate(user.banned_at)}
                    </p>
                    {user.ban_reason && <p className="text-red-600">Motivo: {user.ban_reason}</p>}
                  </div>
                )}
              </div>
            </div>

            {/* Ações de status */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Ações</p>
              <div className="grid grid-cols-2 gap-2">
                {user.status !== 'active' && (
                  <button onClick={() => setStatus('active')} disabled={savingStatus}
                    className="flex items-center justify-center gap-1.5 py-2 bg-green-50 text-green-700 border border-green-200 rounded-xl text-xs font-semibold cursor-pointer hover:bg-green-100 transition-colors disabled:opacity-50">
                    <UserCheck className="w-3.5 h-3.5" /> Ativar
                  </button>
                )}
                {user.status === 'active' && (
                  <button onClick={() => setStatus('pending')} disabled={savingStatus}
                    className="flex items-center justify-center gap-1.5 py-2 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-xl text-xs font-semibold cursor-pointer hover:bg-yellow-100 transition-colors disabled:opacity-50">
                    <Clock className="w-3.5 h-3.5" /> Suspender
                  </button>
                )}
                {user.status !== 'blocked' && (
                  <button onClick={() => setStatus('blocked')} disabled={savingStatus}
                    className="flex items-center justify-center gap-1.5 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-semibold cursor-pointer hover:bg-red-100 transition-colors disabled:opacity-50">
                    <UserX className="w-3.5 h-3.5" /> Bloquear
                  </button>
                )}
                {user.status === 'blocked' && (
                  <button onClick={() => setStatus('active')} disabled={savingStatus}
                    className="flex items-center justify-center gap-1.5 py-2 bg-green-50 text-green-700 border border-green-200 rounded-xl text-xs font-semibold cursor-pointer hover:bg-green-100 transition-colors disabled:opacity-50">
                    <UserCheck className="w-3.5 h-3.5" /> Desbloquear
                  </button>
                )}
                <button onClick={() => setShowEdit(true)}
                  className="flex items-center justify-center gap-1.5 py-2 bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-semibold cursor-pointer hover:bg-gray-100 transition-colors col-span-2">
                  <Edit2 className="w-3.5 h-3.5" /> Editar dados
                </button>
              </div>

              {isSuperAdmin && (
                <div className="mt-4 pt-4 border-t border-red-100">
                  {!confirmDelete ? (
                    <button onClick={() => setConfirmDelete(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-semibold cursor-pointer hover:bg-red-100 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Excluir usuário permanentemente
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-red-700 font-semibold">
                        Excluir <span className="font-mono">{user.email}</span>?
                      </p>
                      <p className="text-xs text-gray-500">Esta ação remove o usuário do banco de dados e do Supabase Auth. Irreversível.</p>
                      {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}
                      <div className="flex gap-2">
                        <button onClick={() => setConfirmDelete(false)}
                          className="flex-1 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 cursor-pointer hover:bg-gray-50">
                          Cancelar
                        </button>
                        <button onClick={handleDelete} disabled={deleting}
                          className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1">
                          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          {deleting ? 'Excluindo...' : 'Confirmar exclusão'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Links rápidos */}
            <div className="pt-2 border-t border-gray-100 text-xs">
              <p className="text-gray-400 mb-1">Links legais (enviar ao usuário):</p>
              <div className="flex gap-2">
                <Link to="/termos" target="_blank" className="text-brand hover:underline">Termos de Uso</Link>
                <span className="text-gray-300">·</span>
                <Link to="/privacidade" target="_blank" className="text-brand hover:underline">Política de Privacidade</Link>
              </div>
            </div>
          </div>
        )}
      </motion.aside>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showInvite, setShowInvite] = useState(false)
  const [detailUser, setDetailUser] = useState<UserRecord | null>(null)
  const [pendingChanges, setPendingChanges] = useState<Record<string, { role: string; roles: string[] }>>({})
  const [saving, setSaving] = useState(false)

  function effectiveState(u: UserRecord) {
    const pending = pendingChanges[u.id]
    if (pending) return pending
    const roles = u.roles?.length ? u.roles : [u.role]
    return { role: u.role, roles }
  }

  function updatePending(userId: string, change: { role: string; roles: string[] }) {
    const u = users.find(x => x.id === userId)!
    const origRoles = u.roles?.length ? u.roles : [u.role]
    const unchanged = change.role === u.role &&
      JSON.stringify([...change.roles].sort()) === JSON.stringify([...origRoles].sort())
    if (unchanged) {
      setPendingChanges(prev => { const n = { ...prev }; delete n[userId]; return n })
    } else {
      setPendingChanges(prev => ({ ...prev, [userId]: change }))
    }
  }

  function changePrimaryRole(userId: string, newRole: string) {
    const current = effectiveState(users.find(u => u.id === userId)!)
    const newRoles = current.roles.includes(newRole) ? current.roles : [newRole, ...current.roles]
    updatePending(userId, { role: newRole, roles: newRoles })
  }

  function toggleSecondaryRole(userId: string, roleToToggle: string) {
    const current = effectiveState(users.find(u => u.id === userId)!)
    if (roleToToggle === current.role) return
    const newRoles = current.roles.includes(roleToToggle)
      ? current.roles.filter(r => r !== roleToToggle)
      : [...current.roles, roleToToggle]
    if (!newRoles.includes(current.role)) newRoles.unshift(current.role)
    updatePending(userId, { role: current.role, roles: newRoles })
  }

  const loadUsers = useCallback(async () => {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
    setUsers((data as UserRecord[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.phone?.includes(search)
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    const matchStatus = statusFilter === 'all' || u.status === statusFilter
    return matchSearch && matchRole && matchStatus
  })

  function updateLocal(updated: UserRecord) {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
    if (detailUser?.id === updated.id) setDetailUser(updated)
  }

  function removeLocal(id: string) {
    setUsers(prev => prev.filter(u => u.id !== id))
    if (detailUser?.id === id) setDetailUser(null)
  }

  async function saveAllPending() {
    setSaving(true)
    for (const [userId, change] of Object.entries(pendingChanges)) {
      const u = users.find(x => x.id === userId)
      if (!u) continue
      const oldRole = u.role
      const oldRoles = u.roles?.length ? u.roles : [u.role]
      await supabase.from('users')
        .update({ role: change.role, roles: change.roles, updated_at: new Date().toISOString() })
        .eq('id', userId)
      if (change.roles.includes('painter')) {
        const { data: existing } = await supabase.from('painters').select('id').eq('user_id', userId).maybeSingle()
        if (!existing) {
          await supabase.from('painters').insert({
            user_id: userId, bio: '', years_experience: 0, specialties: [],
            availability_status: 'available', verification_status: 'unverified',
            kyc_status: 'not_started', service_radius_km: 10,
          })
        }
      }
      await logAudit({
        actor_user_id: currentUser?.id,
        entity_type: 'user',
        entity_id: userId,
        action: 'user_role_changed',
        old_values: { role: oldRole, roles: oldRoles },
        new_values: { role: change.role, roles: change.roles },
      })
      updateLocal({ ...u, role: change.role, roles: change.roles })
    }
    setPendingChanges({})
    setSaving(false)
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Usuários</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#FF7A30] to-brand text-white text-sm font-semibold rounded-xl cursor-pointer shadow-md shadow-brand/20 hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> Convidar usuário
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, email ou telefone..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="border border-gray-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:border-brand bg-white">
          <option value="all">Todos os papéis</option>
          <option value="admin">Admin</option>
          <option value="customer">Cliente</option>
          <option value="painter">Pintor</option>
          <option value="partner">Parceiro</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:border-brand bg-white">
          <option value="all">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="pending">Pendente</option>
          <option value="invited">Convidado</option>
          <option value="blocked">Bloqueado</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Nenhum usuário encontrado.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Usuário', 'Papel', 'Status', 'LGPD', 'Origem', 'Cadastro', 'Ações'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {user.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate max-w-36">{user.name}</p>
                        <p className="text-xs text-gray-400 truncate max-w-36">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const eff = effectiveState(user)
                      const hasPending = !!pendingChanges[user.id]
                      return (
                        <div className="flex flex-col gap-1.5">
                          <select
                            value={eff.role}
                            onChange={e => changePrimaryRole(user.id, e.target.value)}
                            className={cn(
                              'text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer w-fit',
                              hasPending ? 'ring-2 ring-brand/40 ' : '',
                              ROLE_COLORS[eff.role] || 'bg-gray-100 text-gray-600',
                            )}>
                            <option value="customer">Cliente</option>
                            <option value="painter">Pintor</option>
                            <option value="partner">Parceiro</option>
                            <option value="admin">Admin</option>
                          </select>
                          <div className="flex flex-wrap gap-1">
                            {(['admin', 'customer', 'painter', 'partner'] as const)
                              .filter(r => r !== eff.role)
                              .map(r => {
                                const isActive = eff.roles.includes(r)
                                return (
                                  <button
                                    key={r}
                                    onClick={() => toggleSecondaryRole(user.id, r)}
                                    title={isActive ? `Remover ${ROLE_LABELS[r]}` : `Adicionar ${ROLE_LABELS[r]}`}
                                    className={cn(
                                      'text-[10px] font-medium px-1.5 py-0.5 rounded-full transition-colors cursor-pointer',
                                      isActive
                                        ? cn(ROLE_COLORS[r], 'opacity-85')
                                        : 'bg-gray-100 text-gray-300 hover:bg-gray-200 hover:text-gray-500',
                                    )}>
                                    {isActive ? `✓ ${ROLE_LABELS[r]}` : `+ ${ROLE_LABELS[r]}`}
                                  </button>
                                )
                              })}
                          </div>
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', STATUS_COLORS[user.status] || 'bg-gray-100 text-gray-600')}>
                      {STATUS_LABELS[user.status] || user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className={cn('text-[10px] font-medium', user.terms_accepted_at ? 'text-green-600' : 'text-yellow-600')}>
                        {user.terms_accepted_at ? '✓ Termos' : '⏳ Pendente'}
                      </span>
                      <span className={cn('text-[10px]', {
                        'text-green-600': user.cookie_consent === 'all',
                        'text-blue-500': user.cookie_consent === 'essential',
                        'text-gray-400': !user.cookie_consent || user.cookie_consent === 'pending',
                      })}>
                        {user.cookie_consent === 'all' ? '✓ Cookies' :
                         user.cookie_consent === 'essential' ? '⚡ Essenciais' : '○ Cookies'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{SOURCE_LABELS[user.registration_source || 'web'] || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => setDetailUser(user)} title="Ver detalhes"
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 hover:bg-gray-100 cursor-pointer transition-colors">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {user.status === 'pending' || user.status === 'invited' ? (
                        <button onClick={async () => {
                          await supabase.from('users').update({ status: 'active' }).eq('id', user.id)
                          updateLocal({ ...user, status: 'active' })
                        }} title="Ativar conta"
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-50 text-green-500 hover:bg-green-100 cursor-pointer transition-colors">
                          <UserCheck className="w-3.5 h-3.5" />
                        </button>
                      ) : user.status !== 'blocked' ? (
                        <button onClick={() => setDetailUser(user)} title="Bloquear / gerenciar"
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-100 cursor-pointer transition-colors">
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button onClick={async () => {
                          await supabase.from('users').update({ status: 'active', banned_at: null, ban_reason: null }).eq('id', user.id)
                          updateLocal({ ...user, status: 'active', banned_at: undefined })
                        }} title="Desbloquear"
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-50 text-green-500 hover:bg-green-100 cursor-pointer transition-colors">
                          <UserCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Floating save button */}
      <AnimatePresence>
        {Object.keys(pendingChanges).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-20 lg:bottom-6 right-6 z-40">
            <button onClick={saveAllPending} disabled={saving}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-[#FF7A30] to-brand text-white rounded-2xl shadow-xl shadow-brand/30 text-sm font-semibold cursor-pointer disabled:opacity-60 transition-opacity">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar {Object.keys(pendingChanges).length} alteração{Object.keys(pendingChanges).length !== 1 ? 'ões' : ''}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showInvite && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowInvite(false)}>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">Convidar usuário</h3>
                  <p className="text-xs text-gray-400 mt-0.5">O usuário receberá um e-mail com o link de cadastro.</p>
                </div>
                <button onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <InviteUserModal onClose={() => setShowInvite(false)} onDone={loadUsers} />
            </motion.div>
          </motion.div>
        )}

        {detailUser && (
          <UserDetailDrawer
            user={detailUser}
            onClose={() => setDetailUser(null)}
            onUpdated={updateLocal}
            onDeleted={removeLocal}
            isSuperAdmin={!!currentUser?.isSuperAdmin}
            actorUserId={currentUser?.id}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
