import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Search, Plus, UserX, UserCheck, Loader2 } from "lucide-react"
import { supabase } from '../../lib/supabase'
import { cn, formatDate } from '../../lib/utils'

interface UserRecord {
  id: string
  name: string
  email: string
  phone?: string
  role: string
  status: string
  registration_source?: string
  banned_at?: string
  created_at: string
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  customer: 'bg-blue-100 text-blue-700',
  painter: 'bg-orange-100 text-orange-700',
  partner: 'bg-green-100 text-green-700',
  artist: 'bg-pink-100 text-pink-700',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  blocked: 'bg-red-100 text-red-600',
  archived: 'bg-gray-100 text-gray-500',
}

const SOURCE_LABELS: Record<string, string> = {
  web: '🌐 Web',
  chat: '💬 Chat',
  whatsapp: '📱 WhatsApp',
  admin: '🔧 Admin',
}

export function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  // selectedUser state reserved for future detail view
  // showCreate state for future create modal
  const [banModal, setBanModal] = useState<{ user: UserRecord; action: 'ban' | 'unban' } | null>(null)
  const [banReason, setBanReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
    setUsers((data as UserRecord[]) || [])
    setLoading(false)
  }

  async function updateRole(userId: string, role: string) {
    await supabase.from('users').update({ role }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
  }


  async function executeBan() {
    if (!banModal) return
    setSaving(true)
    const { user, action } = banModal
    if (action === 'ban') {
      await supabase.from('users').update({ status: 'blocked', banned_at: new Date().toISOString(), ban_reason: banReason }).eq('id', user.id)
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: 'blocked', banned_at: new Date().toISOString() } : u))
    } else {
      await supabase.from('users').update({ status: 'active', banned_at: null, ban_reason: null }).eq('id', user.id)
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: 'active', banned_at: undefined } : u))
    }
    setBanModal(null); setBanReason(''); setSaving(false)
  }

  const filtered = users.filter(u => {
    const matchSearch = !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    const matchStatus = statusFilter === 'all' || u.status === statusFilter
    return matchSearch && matchRole && matchStatus
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Usuários</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => alert('Criar usuário: em breve')}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#FF7A30] to-brand text-white text-sm font-semibold rounded-xl cursor-pointer shadow-md shadow-brand/20">
          <Plus className="w-4 h-4" /> Criar usuário
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou email..."
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
          <option value="blocked">Bloqueado</option>
          <option value="archived">Arquivado</option>
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
              <tr>{['Usuário', 'Papel', 'Status', 'Origem', 'Cadastro', 'Ações'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
              ))}</tr>
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
                        <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select value={user.role} onChange={e => updateRole(user.id, e.target.value)}
                      className={cn('text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer', ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-600')}>
                      <option value="customer">Cliente</option>
                      <option value="painter">Pintor</option>
                      <option value="partner">Parceiro</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', STATUS_COLORS[user.status] || 'bg-gray-100 text-gray-600')}>
                      {user.status === 'active' ? 'Ativo' : user.status === 'pending' ? 'Pendente' : user.status === 'blocked' ? 'Bloqueado' : 'Arquivado'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{SOURCE_LABELS[user.registration_source || 'web'] || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      {user.status !== 'blocked' ? (
                        <button onClick={() => setBanModal({ user, action: 'ban' })}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-100 cursor-pointer transition-colors" title="Banir">
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button onClick={() => setBanModal({ user, action: 'unban' })}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-50 text-green-500 hover:bg-green-100 cursor-pointer transition-colors" title="Desbanir">
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

      {/* Ban/Unban modal */}
      <AnimatePresence>
        {banModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setBanModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-gray-900 mb-1">
                {banModal.action === 'ban' ? `Banir ${banModal.user.name}?` : `Desbanir ${banModal.user.name}?`}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {banModal.action === 'ban' ? 'O usuário perderá acesso à plataforma imediatamente.' : 'O usuário voltará a ter acesso normal.'}
              </p>
              {banModal.action === 'ban' && (
                <div className="mb-4">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Motivo do banimento</label>
                  <textarea value={banReason} onChange={e => setBanReason(e.target.value)} rows={2}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand resize-none" />
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setBanModal(null)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm cursor-pointer">Cancelar</button>
                <button onClick={executeBan} disabled={saving}
                  className={cn('flex-1 py-2.5 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer',
                    banModal.action === 'ban' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600')}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {banModal.action === 'ban' ? 'Banir' : 'Desbanir'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
