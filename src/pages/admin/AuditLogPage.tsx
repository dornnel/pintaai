import { useEffect, useState } from 'react'
import { Search, Shield, Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatDate, formatRelativeTime } from '../../lib/utils'

interface AuditLog {
  id: string
  actor_user_id?: string
  entity_type: string
  entity_id: string
  action: string
  old_values?: Record<string, unknown>
  new_values?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  created_at: string
  actor?: { name: string; email: string }
}

const ACTION_COLORS: Record<string, string> = {
  lead_stage_changed: 'bg-blue-100 text-blue-700',
  lead_confirmed: 'bg-green-100 text-green-700',
  payment_milestone_released: 'bg-emerald-100 text-emerald-700',
  user_banned: 'bg-red-100 text-red-700',
  user_unbanned: 'bg-gray-100 text-gray-600',
  product_approved: 'bg-green-100 text-green-700',
  product_rejected: 'bg-red-100 text-red-600',
  ad_approved: 'bg-green-100 text-green-700',
  ad_rejected: 'bg-red-100 text-red-600',
  painter_status_changed: 'bg-violet-100 text-violet-700',
  budget_divergence_registered: 'bg-amber-100 text-amber-700',
  subscription_canceled: 'bg-orange-100 text-orange-700',
  admin_permission_changed: 'bg-purple-100 text-purple-700',
}

const ENTITY_LABELS: Record<string, string> = {
  lead: '📋 Lead', user: '👤 Usuário', painter: '🖌️ Pintor',
  payment_milestone: '💰 Pagamento', product: '📦 Produto',
  partner_ad: '📢 Anúncio', subscription: '💳 Assinatura',
  budget_adjustment: '📊 Orçamento',
}

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterEntity, setFilterEntity] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('audit_logs')
      .select('*, actor:users!actor_user_id(name, email)')
      .order('created_at', { ascending: false })
      .limit(200)
    setLogs((data || []) as unknown as AuditLog[])
    setLoading(false)
  }

  function exportCSV() {
    const header = 'Data,Ator,Entidade,ID,Ação,IP\n'
    const rows = filtered.map(l =>
      `"${formatDate(l.created_at)}","${l.actor?.name || 'Sistema'}","${l.entity_type}","${l.entity_id.slice(0,8)}","${l.action}","${l.ip_address || ''}"`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  const filtered = logs.filter(l => {
    const matchSearch = !search ||
      l.action.includes(search.toLowerCase()) ||
      l.entity_type.includes(search.toLowerCase()) ||
      l.actor?.name?.toLowerCase().includes(search.toLowerCase())
    const matchEntity = filterEntity === 'all' || l.entity_type === filterEntity
    return matchSearch && matchEntity
  })

  const entityTypes = [...new Set(logs.map(l => l.entity_type))]

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand" /> Trilha de Auditoria
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{logs.length} evento{logs.length !== 1 ? 's' : ''} registrado{logs.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
          <Download className="w-3.5 h-3.5" /> Exportar CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-44">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ação, entidade, ator..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand" />
        </div>
        <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)}
          className="border border-gray-200 rounded-xl text-sm px-3 py-2.5 bg-white focus:outline-none focus:border-brand">
          <option value="all">Todas entidades</option>
          {entityTypes.map(e => <option key={e} value={e}>{ENTITY_LABELS[e] || e}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-white rounded-xl animate-pulse border border-gray-100" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Shield className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Nenhum evento de auditoria registrado ainda.</p>
          <p className="text-xs text-gray-300 mt-1">Os eventos aparecem conforme ações são realizadas no admin.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Quando</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden sm:table-cell">Ator</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Ação</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden md:table-cell">Entidade</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden lg:table-cell">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(log => (
                <>
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-600">{formatRelativeTime(log.created_at)}</p>
                      <p className="text-[10px] text-gray-400 hidden sm:block">{formatDate(log.created_at)}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <p className="text-xs font-medium text-gray-800">{log.actor?.name || 'Sistema'}</p>
                      {log.actor?.email && <p className="text-[10px] text-gray-400">{log.actor.email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-xs text-gray-600">{ENTITY_LABELS[log.entity_type] || log.entity_type}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{log.entity_id.slice(0, 8)}…</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <p className="text-xs text-gray-400 font-mono">{log.ip_address || '—'}</p>
                    </td>
                  </tr>
                  {expanded === log.id && (log.old_values || log.new_values) && (
                    <tr>
                      <td colSpan={5} className="px-4 pb-3 bg-gray-50">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          {log.old_values && (
                            <div className="bg-red-50 rounded-lg p-2 border border-red-100">
                              <p className="font-semibold text-red-700 mb-1">Antes</p>
                              <pre className="text-[10px] text-red-600 overflow-auto">{JSON.stringify(log.old_values, null, 2)}</pre>
                            </div>
                          )}
                          {log.new_values && (
                            <div className="bg-green-50 rounded-lg p-2 border border-green-100">
                              <p className="font-semibold text-green-700 mb-1">Depois</p>
                              <pre className="text-[10px] text-green-600 overflow-auto">{JSON.stringify(log.new_values, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
