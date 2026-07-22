import { useEffect, useState, useCallback } from 'react'
import { Users, CreditCard, TrendingUp, XCircle, Search, Crown, Zap, Gift, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatDate, formatCurrency, cn } from '../../lib/utils'

// Unified subscription row (paid via Asaas OR admin-granted)
interface SubRow {
  id: string
  userId: string
  userName: string
  userEmail: string
  plan: 'clube' | 'pro'
  planName: string
  price: number
  status: 'active' | 'canceled' | 'overdue' | 'admin_granted'
  method: 'asaas' | 'admin'
  nextBillingDate?: string
  createdAt: string
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  canceled: 'Cancelado',
  overdue: 'Em atraso',
  admin_granted: 'Concedido',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  canceled: 'bg-red-100 text-red-600',
  overdue: 'bg-orange-100 text-orange-700',
  admin_granted: 'bg-purple-100 text-purple-700',
}

const PLAN_ICON: Record<string, React.ReactNode> = {
  clube: <Crown className="w-3.5 h-3.5 text-purple-500" />,
  pro:   <Zap className="w-3.5 h-3.5 text-orange-500" />,
}

export function SubscriptionsPage() {
  const [rows, setRows] = useState<SubRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState<'all' | 'clube' | 'pro'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'canceled' | 'overdue' | 'admin_granted'>('all')
  const [revoking, setRevoking] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)

    // ── 1. Paid subscriptions from user_subscriptions ──
    const { data: paidSubs } = await supabase
      .from('user_subscriptions')
      .select('id, status, next_billing_date, created_at, user_id, users(name, email), subscription_plans(name, slug, price_monthly)')
      .order('created_at', { ascending: false })

    const paidRows: SubRow[] = (paidSubs || []).map((s: any) => {
      const isClub = s.subscription_plans?.slug === 'customer-club'
      return {
        id: s.id,
        userId: s.user_id,
        userName: s.users?.name || '—',
        userEmail: s.users?.email || '—',
        plan: isClub ? 'clube' : 'pro',
        planName: s.subscription_plans?.name || s.subscription_plans?.slug || '—',
        price: Number(s.subscription_plans?.price_monthly) || 0,
        status: s.status as SubRow['status'],
        method: 'asaas',
        nextBillingDate: s.next_billing_date,
        createdAt: s.created_at,
      }
    })

    // IDs that already have a paid sub record (avoid duplicating)
    const paidUserIds = new Set(paidRows.map(r => r.userId))

    // ── 2. Admin-granted clube members (no paid sub) ──
    const { data: clubMembers } = await supabase
      .from('users')
      .select('id, name, email, created_at')
      .eq('is_club_member', true)

    const grantedClub: SubRow[] = (clubMembers || [])
      .filter((u: any) => !paidUserIds.has(u.id))
      .map((u: any) => ({
        id: `granted-club-${u.id}`,
        userId: u.id,
        userName: u.name || '—',
        userEmail: u.email || '—',
        plan: 'clube',
        planName: 'Clube Pinte Rápido',
        price: 49,
        status: 'admin_granted',
        method: 'admin',
        createdAt: u.created_at,
      }))

    // ── 3. Admin-granted Pro painters (no paid sub) ──
    const { data: proPainters } = await supabase
      .from('painters')
      .select('user_id, created_at, users(id, name, email, created_at)')
      .eq('pro_plan_status', 'active')

    const grantedPro: SubRow[] = (proPainters || [])
      .filter((p: any) => !paidUserIds.has(p.users?.id))
      .map((p: any) => ({
        id: `granted-pro-${p.user_id}`,
        userId: p.users?.id || p.user_id,
        userName: p.users?.name || '—',
        userEmail: p.users?.email || '—',
        plan: 'pro',
        planName: 'Pintor Pro',
        price: 97,
        status: 'admin_granted',
        method: 'admin',
        createdAt: p.users?.created_at || p.created_at,
      }))

    setRows([...paidRows, ...grantedClub, ...grantedPro])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function revokeGrant(row: SubRow) {
    if (!confirm(`Revogar acesso de ${row.userEmail}?`)) return
    setRevoking(row.id)
    if (row.plan === 'clube') {
      await supabase.from('users').update({ is_club_member: false }).eq('id', row.userId)
    } else {
      await supabase.from('painters').update({ pro_plan_status: 'none' }).eq('user_id', row.userId)
    }
    setRevoking(null)
    load()
  }

  async function cancelPaid(row: SubRow) {
    if (!confirm(`Cancelar assinatura de ${row.userEmail}?`)) return
    await supabase.from('user_subscriptions').update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    }).eq('id', row.id)
    load()
  }

  const filtered = rows.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = !q || r.userName.toLowerCase().includes(q) || r.userEmail.toLowerCase().includes(q)
    const matchPlan = filterPlan === 'all' || r.plan === filterPlan
    const matchStatus = filterStatus === 'all' || r.status === filterStatus
    return matchSearch && matchPlan && matchStatus
  })

  const activeTotal = rows.filter(r => r.status === 'active' || r.status === 'admin_granted').length
  const paidActive  = rows.filter(r => r.status === 'active')
  const mrr         = paidActive.reduce((sum, r) => sum + r.price, 0)
  const granted     = rows.filter(r => r.status === 'admin_granted').length
  const canceled    = rows.filter(r => r.status === 'canceled').length

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Assinaturas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Clube + Pro — pagos e concedidos</p>
        </div>
        <button onClick={load} disabled={loading}
          className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-40">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center"><Users className="w-4 h-4 text-green-600" /></div>
          <div><p className="text-xl font-bold text-gray-900">{activeTotal}</p><p className="text-xs text-gray-500">Acessos ativos</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-brand/10 rounded-xl flex items-center justify-center"><CreditCard className="w-4 h-4 text-brand" /></div>
          <div><p className="text-xl font-bold text-gray-900">{formatCurrency(mrr)}</p><p className="text-xs text-gray-500">MRR (pagos)</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center"><Gift className="w-4 h-4 text-purple-500" /></div>
          <div><p className="text-xl font-bold text-gray-900">{granted}</p><p className="text-xs text-gray-500">Concedidos</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center"><TrendingUp className="w-4 h-4 text-red-500" /></div>
          <div><p className="text-xl font-bold text-gray-900">{canceled}</p><p className="text-xs text-gray-500">Cancelamentos</p></div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-3 mb-4 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand/40"
          />
        </div>

        {/* Plan filter */}
        <div className="flex gap-1">
          {(['all', 'clube', 'pro'] as const).map(p => (
            <button key={p} onClick={() => setFilterPlan(p)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors',
                filterPlan === p ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}>
              {p === 'all' ? 'Todos planos' : p === 'clube' ? '👑 Clube' : '⚡ Pro'}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1">
          {(['all', 'active', 'admin_granted', 'overdue', 'canceled'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors',
                filterStatus === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}>
              {s === 'all' ? 'Todos status' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="h-14 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <CreditCard className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Nenhuma assinatura encontrada.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="text-xs font-semibold text-gray-500 px-4 py-3">Usuário</th>
                <th className="text-xs font-semibold text-gray-500 px-4 py-3">Plano</th>
                <th className="text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
                <th className="text-xs font-semibold text-gray-500 px-4 py-3">Origem</th>
                <th className="text-xs font-semibold text-gray-500 px-4 py-3 hidden md:table-cell">Próx. cobrança</th>
                <th className="text-xs font-semibold text-gray-500 px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(row => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{row.userName}</p>
                    <p className="text-xs text-gray-400">{row.userEmail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {PLAN_ICON[row.plan]}
                      <div>
                        <p className="text-xs font-medium text-gray-800">{row.planName}</p>
                        <p className="text-xs text-gray-400">{formatCurrency(row.price)}/mês</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[row.status] || 'bg-gray-100 text-gray-600')}>
                      {STATUS_LABELS[row.status] || row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      row.method === 'asaas' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                    )}>
                      {row.method === 'asaas' ? 'Asaas' : 'Admin'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500">
                    {row.nextBillingDate ? formatDate(row.nextBillingDate) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      {(row.status === 'active' || row.status === 'overdue') && row.method === 'asaas' && (
                        <button onClick={() => cancelPaid(row)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 cursor-pointer transition-colors"
                          title="Cancelar assinatura">
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {row.status === 'admin_granted' && (
                        <button onClick={() => revokeGrant(row)} disabled={revoking === row.id}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 cursor-pointer transition-colors disabled:opacity-50"
                          title="Revogar acesso">
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2.5 border-t border-gray-50 text-xs text-gray-400">
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}{rows.length !== filtered.length ? ` de ${rows.length}` : ''}
          </div>
        </div>
      )}
    </div>
  )
}
