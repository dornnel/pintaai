import { useEffect, useState } from 'react'
import { FileText, Users, Clock, TrendingUp, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { REQUEST_STATUSES } from '../../lib/constants'
import type { RequestStatus } from '../../lib/types'

interface Stats {
  total_requests: number
  briefing_ready: number
  in_progress: number
  completed: number
  active_painters: number
  pending_moderation: number
}

export function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    total_requests: 0, briefing_ready: 0, in_progress: 0,
    completed: 0, active_painters: 0, pending_moderation: 0,
  })

  useEffect(() => {
    async function load() {
      const [requests, painters, flags] = await Promise.all([
        supabase.from('service_requests').select('status'),
        supabase.from('painters').select('availability_status').eq('availability_status', 'available'),
        supabase.from('moderation_flags').select('id').eq('status', 'pending'),
      ])

      const reqs = (requests.data || []) as { status: RequestStatus }[]
      setStats({
        total_requests: reqs.length,
        briefing_ready: reqs.filter((r) => r.status === 'briefing_ready').length,
        in_progress: reqs.filter((r) => r.status === 'in_progress' || r.status === 'connected').length,
        completed: reqs.filter((r) => r.status === 'completed').length,
        active_painters: painters.data?.length || 0,
        pending_moderation: flags.data?.length || 0,
      })
    }
    load()
  }, [])

  const cards = [
    { icon: FileText, label: 'Total de pedidos', value: stats.total_requests, color: 'text-blue-500' },
    { icon: Clock, label: 'Aguardando ação', value: stats.briefing_ready, color: 'text-yellow-500' },
    { icon: TrendingUp, label: 'Em execução', value: stats.in_progress, color: 'text-green-500' },
    { icon: Users, label: 'Pintores ativos', value: stats.active_painters, color: 'text-purple-500' },
    { icon: FileText, label: 'Concluídos', value: stats.completed, color: 'text-emerald-500' },
    { icon: AlertTriangle, label: 'Flags pendentes', value: stats.pending_moderation, color: 'text-red-500' },
  ]

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Visão operacional da plataforma</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        {cards.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center ${color}`}>
              <Icon className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Pedidos por status</h2>
        <div className="space-y-2">
          {Object.entries(REQUEST_STATUSES).map(([status, cfg]) => (
            <div key={status} className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
