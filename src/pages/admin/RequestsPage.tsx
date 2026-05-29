import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Filter, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { ServiceRequest, RequestStatus } from '../../lib/types'
import { REQUEST_STATUSES } from '../../lib/constants'
import { formatDate, cn } from '../../lib/utils'

export function RequestsPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [filter, setFilter] = useState<RequestStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      let query = supabase
        .from('service_requests')
        .select('*, neighborhood:neighborhoods(name), customer:customers(user:users(name,phone))')
        .order('created_at', { ascending: false })

      if (filter !== 'all') query = query.eq('status', filter)

      const { data } = await query
      setRequests((data as ServiceRequest[]) || [])
      setLoading(false)
    }
    load()
  }, [filter])

  const filtered = search
    ? requests.filter(
        (r) =>
          r.id.includes(search) ||
          (r.neighborhood as unknown as { name: string })?.name?.toLowerCase().includes(search.toLowerCase()),
      )
    : requests

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{requests.length} pedido{requests.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pedido..."
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand w-52"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as RequestStatus | 'all')}
            className="border border-gray-200 rounded-xl text-sm px-3 py-2 focus:outline-none focus:border-brand bg-white"
          >
            <option value="all">Todos os status</option>
            {Object.entries(REQUEST_STATUSES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Nenhum pedido encontrado</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['ID', 'Bairro', 'Tipo', 'Status', 'Data', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((r) => {
                const statusCfg = REQUEST_STATUSES[r.status]
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-gray-400">{r.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {(r.neighborhood as unknown as { name: string })?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{r.request_type}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusCfg?.color || 'bg-gray-100 text-gray-600')}>
                        {statusCfg?.label || r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(r.created_at)}</td>
                    <td className="px-4 py-3">
                      <Link to={`/admin/requests/${r.id}`} className="text-brand hover:text-brand-dark">
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
