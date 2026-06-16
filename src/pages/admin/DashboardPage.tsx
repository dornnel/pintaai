import { useEffect, useState, useMemo } from 'react'
import {
  FileText, Users, Clock, TrendingUp, AlertTriangle, DollarSign,
  CheckCircle, AlertCircle, ChevronRight, ArrowRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatRelativeTime, formatCurrency } from '../../lib/utils'

interface Lead {
  id: string
  name: string
  email?: string
  phone?: string
  protocol?: string
  stage: string
  service_interest?: string
  neighborhood?: string
  created_at: string
  estimated_value?: number
  ai_price_min?: number
  ai_price_max?: number
}

interface Activity {
  id: string
  type: string
  title: string
  created_at: string
  lead_id?: string
}

const STAGE_ORDER = ['new', 'contacted', 'qualified', 'proposal_sent', 'won']
const STAGE_LABELS: Record<string, string> = {
  new: 'Novos', contacted: 'Contatado', qualified: 'Qualificado',
  proposal_sent: 'Proposta', won: 'Confirmado', lost: 'Perdido',
}
const STAGE_COLORS: Record<string, string> = {
  new: 'bg-gray-400', contacted: 'bg-blue-500', qualified: 'bg-violet-500',
  proposal_sent: 'bg-yellow-500', won: 'bg-green-500',
}

export function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [activePainters, setActivePainters] = useState(0)
  const [pendingFlags, setPendingFlags] = useState(0)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const [leadsRes, paintersRes, flagsRes, activitiesRes] = await Promise.all([
      supabase.from('leads')
        .select('id,name,email,phone,protocol,stage,service_interest,neighborhood,created_at,estimated_value')
        .order('created_at', { ascending: false }),
      supabase.from('painters').select('id').eq('availability_status', 'available'),
      supabase.from('moderation_flags').select('id').eq('status', 'pending'),
      supabase.from('crm_activities').select('id,type,title,created_at,lead_id').order('created_at', { ascending: false }).limit(10),
    ])
    setLeads((leadsRes.data || []) as Lead[])
    setActivePainters(paintersRes.data?.length || 0)
    setPendingFlags(flagsRes.data?.length || 0)
    setActivities((activitiesRes.data || []) as Activity[])
    setLoading(false)
  }

  const wonLeads = leads.filter(l => l.stage === 'won')
  const weekAgo = new Date(Date.now() - 7 * 86400000)
  const newThisWeek = leads.filter(l => new Date(l.created_at) > weekAgo).length
  const totalRevenue = wonLeads.reduce((s, l) => s + (l.estimated_value || 0), 0)

  const funnel = useMemo(() => STAGE_ORDER.map(stage => ({
    stage, label: STAGE_LABELS[stage],
    count: leads.filter(l => l.stage === stage).length,
    color: STAGE_COLORS[stage],
  })), [leads])
  const maxFunnel = Math.max(...funnel.map(f => f.count), 1)

  const inconsistencies = useMemo(() => {
    const result: { key: string; type: 'phone' | 'email'; value: string; leads: Lead[] }[] = []
    const byPhone: Record<string, Lead[]> = {}
    const byEmail: Record<string, Lead[]> = {}
    leads.forEach(l => {
      if (l.phone) (byPhone[l.phone] = byPhone[l.phone] || []).push(l)
      if (l.email) (byEmail[l.email] = byEmail[l.email] || []).push(l)
    })
    Object.entries(byPhone).forEach(([phone, ls]) => {
      if (ls.length > 1 && new Set(ls.map(l => l.name.toLowerCase())).size > 1)
        result.push({ key: `phone-${phone}`, type: 'phone', value: phone, leads: ls })
    })
    Object.entries(byEmail).forEach(([email, ls]) => {
      if (ls.length > 1 && new Set(ls.map(l => l.name.toLowerCase())).size > 1)
        result.push({ key: `email-${email}`, type: 'email', value: email, leads: ls })
    })
    return result
  }, [leads])

  const cards = [
    { icon: FileText,     label: 'Total de leads',      value: leads.length,      trend: `+${newThisWeek} esta semana`, color: 'text-blue-600',    bg: 'bg-blue-50' },
    { icon: CheckCircle,  label: 'Pedidos confirmados',  value: wonLeads.length,   trend: undefined,                    color: 'text-green-600',   bg: 'bg-green-50' },
    { icon: Clock,        label: 'Em andamento',         value: leads.filter(l => ['qualified','proposal_sent'].includes(l.stage)).length, trend: undefined, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { icon: DollarSign,   label: 'Receita estimada',     value: formatCurrency(totalRevenue), trend: undefined,         color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { icon: Users,        label: 'Pintores ativos',      value: activePainters,    trend: undefined,                    color: 'text-purple-600',  bg: 'bg-purple-50', href: '/admin/painters' },
    { icon: AlertTriangle,label: 'Flags pendentes',      value: pendingFlags,      trend: undefined,                    color: 'text-red-600',     bg: 'bg-red-50', href: '/admin/moderation' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {cards.map(({ icon: Icon, label, value, trend, color, bg, href }) => (
          <div key={label}
            className={`bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 flex items-start gap-3 sm:gap-4 min-h-[80px] ${href ? 'cursor-pointer hover:border-gray-200 transition-colors' : ''}`}
            onClick={href ? () => { window.location.href = href } : undefined}>
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-none">{value}</p>
              <p className="text-xs text-gray-500 mt-1 leading-tight">{label}</p>
              {trend && <p className="text-[10px] text-green-600 mt-0.5 font-medium">{trend}</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Funil */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Funil de conversão</h2>
          <div className="space-y-2.5">
            {funnel.map(({ stage, label, count, color }) => (
              <div key={stage} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20 shrink-0 text-right">{label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${color}`}
                    style={{ width: `${Math.max((count / maxFunnel) * 100, count > 0 ? 4 : 0)}%` }} />
                </div>
                <span className="text-xs font-bold text-gray-700 w-5 text-right shrink-0">{count}</span>
              </div>
            ))}
          </div>
          {leads.length > 0 && (
            <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-50">
              Taxa de conversão: <strong className="text-gray-600">{((wonLeads.length / leads.length) * 100).toFixed(1)}%</strong>
            </p>
          )}
        </div>

        {/* Atividade recente */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Atividade recente</h2>
            <Link to="/admin/leads" className="text-xs text-brand hover:underline flex items-center gap-0.5">
              Leads <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {activities.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">Nenhuma atividade ainda.</p>
          ) : (
            <div className="space-y-2">
              {activities.slice(0, 7).map(a => (
                <div key={a.id} className="flex items-center gap-2.5 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                  <p className="text-xs text-gray-700 flex-1 truncate">{a.title}</p>
                  <span className="text-[10px] text-gray-400 shrink-0">{formatRelativeTime(a.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Validação de inconsistências */}
      {inconsistencies.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <h2 className="text-sm font-semibold text-gray-700">
              ⚠️ Inconsistências detectadas ({inconsistencies.length})
            </h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">Leads com mesmo WhatsApp/email mas nomes diferentes — verifique possível duplicata ou fraude.</p>
          <div className="space-y-3">
            {inconsistencies.map(inc => (
              <div key={inc.key} className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${inc.type === 'phone' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {inc.type === 'phone' ? '📱 WhatsApp' : '📧 Email'}
                  </span>
                  <span className="text-xs font-mono text-gray-600">{inc.value}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {inc.leads.map(l => (
                    <div key={l.id} className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs">
                      <span className="font-medium text-gray-800">{l.name}</span>
                      {l.protocol && <span className="ml-1 font-mono text-brand/70 text-[10px]">({l.protocol})</span>}
                      <span className={`ml-1 text-[10px] px-1 rounded ${l.stage === 'won' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {STAGE_LABELS[l.stage] || l.stage}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Métricas do Motor de Orçamento IA */}
      {(() => {
        const withAI = leads.filter(l => l.ai_price_min && l.ai_price_max)
        const withValidation = leads.filter(l => l.estimated_value && l.ai_price_min && l.ai_price_max)
        if (withAI.length === 0) return null

        const avgError = withValidation.length > 0
          ? Math.round(withValidation.reduce((sum, l) => {
              const aiMid = ((l.ai_price_min ?? 0) + (l.ai_price_max ?? 0)) / 2
              return sum + (aiMid > 0 ? Math.abs(((l.estimated_value ?? 0) - aiMid) / aiMid * 100) : 0)
            }, 0) / withValidation.length)
          : null

        return (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-700">Inteligência de Orçamento IA</h2>
              <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Interno</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                <p className="text-xl font-bold text-gray-900">{withAI.length}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Estimativas IA geradas</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center border border-green-100">
                <p className="text-xl font-bold text-gray-900">{withValidation.length}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Validadas pelo pintor</p>
              </div>
              <div className={`rounded-xl p-3 text-center border ${avgError !== null && avgError > 25 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                <p className="text-xl font-bold text-gray-900">
                  {avgError !== null ? `${avgError}%` : '—'}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">Erro médio da IA</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                <p className="text-xl font-bold text-gray-900">
                  {withAI.length > 0 ? Math.round((withValidation.length / withAI.length) * 100) : 0}%
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">Taxa de validação</p>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Leads recentes */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Solicitações recentes</h2>
          <Link to="/admin/leads" className="text-xs text-brand hover:underline flex items-center gap-0.5">
            Ver todas <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {leads.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            <TrendingUp className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            Nenhuma solicitação ainda. Os leads do chat aparecerão aqui.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {leads.slice(0, 8).map(lead => (
              <Link key={lead.id} to={`/admin/leads/${lead.id}`} className="px-4 sm:px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900 truncate">{lead.name}</p>
                    {lead.protocol && (
                      <span className="text-[10px] font-mono text-brand bg-orange-50 px-1.5 py-0.5 rounded shrink-0">
                        {lead.protocol}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {[lead.service_interest, lead.neighborhood].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    lead.stage === 'won' ? 'bg-green-100 text-green-700' :
                    lead.stage === 'proposal_sent' ? 'bg-yellow-100 text-yellow-700' :
                    lead.stage === 'qualified' ? 'bg-violet-100 text-violet-700' :
                    lead.stage === 'contacted' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {STAGE_LABELS[lead.stage] || lead.stage}
                  </span>
                  <span className="text-[10px] text-gray-400 hidden sm:block">{formatRelativeTime(lead.created_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
