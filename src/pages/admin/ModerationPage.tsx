import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, XCircle, Eye } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { ModerationFlag, ModerationSeverity, ModerationStatus } from '../../lib/types'
import { cn, formatRelativeTime } from '../../lib/utils'

const severityConfig: Record<ModerationSeverity, { color: string; label: string }> = {
  low: { color: 'bg-yellow-100 text-yellow-700', label: 'Baixo' },
  medium: { color: 'bg-orange-100 text-orange-700', label: 'Médio' },
  high: { color: 'bg-red-100 text-red-700', label: 'Alto' },
}

const flagTypeLabel: Record<string, string> = {
  offensive: 'Linguagem ofensiva',
  bypass_attempt: 'Tentativa de bypass',
  ethics_violation: 'Violação de ética',
  spam: 'Spam',
}

export function ModerationPage() {
  const [flags, setFlags] = useState<ModerationFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ModerationStatus | 'all'>('pending')

  useEffect(() => {
    async function load() {
      setLoading(true)
      let query = supabase
        .from('moderation_flags')
        .select('*, message:messages(body,channel,created_at,sender_user_id)')
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') query = query.eq('status', statusFilter)

      const { data } = await query
      setFlags((data as ModerationFlag[]) || [])
      setLoading(false)
    }
    load()
  }, [statusFilter])

  async function updateFlag(id: string, status: ModerationStatus) {
    await supabase.from('moderation_flags').update({ status }).eq('id', id)
    setFlags((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)))
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Moderação</h1>
          <p className="text-sm text-gray-500 mt-0.5">Flags gerados pela IA de conduta</p>
        </div>
        <div className="flex gap-2">
          {(['pending', 'reviewed', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
                statusFilter === s ? 'bg-brand text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand hover:text-brand',
              )}
            >
              {s === 'pending' ? 'Pendentes' : s === 'reviewed' ? 'Revisados' : 'Todos'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-gray-400">Carregando...</div>
      ) : flags.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Nenhum flag pendente. Plataforma limpa! 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flags.map((flag) => {
            const sev = severityConfig[flag.severity]
            const msg = flag.message as unknown as { body: string; channel: string; created_at: string }
            return (
              <div key={flag.id} className={cn('bg-white rounded-2xl border p-4', flag.severity === 'high' && 'border-red-200')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <AlertTriangle className={cn('w-4 h-4 mt-0.5 shrink-0', flag.severity === 'high' ? 'text-red-500' : 'text-orange-400')} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="text-sm font-semibold text-gray-800">{flagTypeLabel[flag.flag_type] || flag.flag_type}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', sev.color)}>{sev.label}</span>
                        <span className="text-xs text-gray-400">{msg?.channel} · {msg ? formatRelativeTime(msg.created_at) : ''}</span>
                      </div>

                      {msg?.body && (
                        <div className="bg-gray-50 rounded-xl p-3 mb-2 border border-gray-100">
                          <p className="text-xs text-gray-600 italic">"{msg.body}"</p>
                        </div>
                      )}

                      <p className="text-xs text-gray-500 leading-relaxed">{flag.ai_explanation}</p>
                    </div>
                  </div>

                  {flag.status === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => updateFlag(flag.id, 'dismissed')}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                        title="Ignorar"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateFlag(flag.id, 'actioned')}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                        title="Tomar ação"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
