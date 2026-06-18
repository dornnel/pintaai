import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Briefcase, MapPin, CheckCircle2, Clock, ChevronRight, Loader2, CalendarDays } from 'lucide-react'
import { usePainterContext } from './PainterLayout'
import type { LeadInteraction } from './PainterLayout'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate, cn } from '../../lib/utils'

type JobMeta = {
  quote?: {
    total_price: number
    includes_material: boolean
    duration_days: number
    payment_terms?: string
    notes?: string
  }
  job_completed_at?: string
}

function JobCard({
  interaction,
  i,
  completing,
  onComplete,
}: {
  interaction: LeadInteraction
  i: number
  completing: boolean
  onComplete?: () => void
}) {
  const lead = interaction.lead
  const meta = interaction.metadata as JobMeta
  const quote = meta.quote
  const completedAt = meta.job_completed_at
  const isCompleted = !!completedAt

  const startDate = interaction.proposal_sent_at
    ? new Date(interaction.proposal_sent_at)
    : new Date(lead.created_at)
  const estimatedEnd = quote?.duration_days
    ? new Date(startDate.getTime() + quote.duration_days * 86_400_000)
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      className={cn(
        'bg-white rounded-2xl border p-5 transition-colors',
        isCompleted ? 'border-gray-100' : 'border-gray-200 hover:border-brand/20',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 text-sm truncate">
            {lead.service_interest ?? 'Pintura'}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="text-xs text-gray-400">{lead.neighborhood}</span>
            <span className="text-xs text-gray-300">· {lead.protocol}</span>
          </div>
        </div>
        <span className={cn(
          'text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 flex items-center gap-1',
          isCompleted ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700',
        )}>
          {isCompleted
            ? <><CheckCircle2 className="w-3 h-3" /> Concluído</>
            : <><Clock className="w-3 h-3" /> Em andamento</>
          }
        </span>
      </div>

      {/* Job details */}
      {quote && (
        <div className="grid grid-cols-2 gap-3 text-xs mb-4">
          <div className="bg-gray-50 rounded-xl px-3 py-2.5">
            <p className="text-gray-400 mb-0.5">Valor acordado</p>
            <p className="font-bold text-gray-900 text-sm">{formatCurrency(quote.total_price)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl px-3 py-2.5">
            <p className="text-gray-400 mb-0.5">Prazo de execução</p>
            <p className="font-bold text-gray-900">{quote.duration_days} dia{quote.duration_days !== 1 ? 's' : ''}</p>
          </div>
          {quote.includes_material !== undefined && (
            <div className="bg-gray-50 rounded-xl px-3 py-2.5">
              <p className="text-gray-400 mb-0.5">Material</p>
              <p className="font-medium text-gray-700">{quote.includes_material ? 'Incluso' : 'Por conta do cliente'}</p>
            </div>
          )}
          {quote.payment_terms && (
            <div className="bg-gray-50 rounded-xl px-3 py-2.5">
              <p className="text-gray-400 mb-0.5">Pagamento</p>
              <p className="font-medium text-gray-700 truncate">{quote.payment_terms}</p>
            </div>
          )}
        </div>
      )}

      {/* Dates */}
      <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
        <div className="flex items-center gap-1">
          <CalendarDays className="w-3 h-3" />
          <span>Aceito em {formatDate(interaction.proposal_sent_at ?? lead.created_at)}</span>
        </div>
        {estimatedEnd && !isCompleted && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Previsto até {estimatedEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
          </div>
        )}
        {completedAt && (
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle2 className="w-3 h-3" />
            <span>Concluído em {formatDate(completedAt)}</span>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-3">
        <Link
          to={`/portal/pintor/solicitacao/${interaction.id}`}
          className="flex items-center gap-1.5 text-xs text-brand font-medium hover:underline"
        >
          Ver detalhes <ChevronRight className="w-3.5 h-3.5" />
        </Link>

        {!isCompleted && onComplete && (
          <button
            onClick={onComplete}
            disabled={completing}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-semibold rounded-lg hover:bg-green-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            {completing
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <CheckCircle2 className="w-3 h-3" />
            }
            Marcar como concluído
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PainterPedidos() {
  const { leadInteractions, loading, reload } = usePainterContext()
  const [completing, setCompleting] = useState<string | null>(null)

  const acceptedJobs = leadInteractions.filter(i => i.status === 'accepted')
  const activeJobs = acceptedJobs.filter(i => !(i.metadata as JobMeta).job_completed_at)
  const completedJobs = acceptedJobs.filter(i => !!(i.metadata as JobMeta).job_completed_at)

  async function markComplete(interaction: LeadInteraction) {
    setCompleting(interaction.id)
    await supabase.from('lead_painter_interactions').update({
      metadata: { ...interaction.metadata, job_completed_at: new Date().toISOString() },
    }).eq('id', interaction.id)
    await reload()
    setCompleting(null)
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="h-44 bg-white rounded-2xl border border-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Pedidos</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Serviços confirmados — acompanhe até a conclusão.
        </p>
      </div>

      {acceptedJobs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Briefcase className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium">Nenhum pedido confirmado ainda.</p>
          <p className="text-gray-300 text-xs mt-1">
            Quando um cliente aceitar sua proposta, o serviço aparece aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {activeJobs.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse inline-block" />
                Em andamento · {activeJobs.length}
              </p>
              <div className="space-y-3">
                {activeJobs.map((interaction, i) => (
                  <JobCard
                    key={interaction.id}
                    interaction={interaction}
                    i={i}
                    completing={completing === interaction.id}
                    onComplete={() => markComplete(interaction)}
                  />
                ))}
              </div>
            </div>
          )}

          {completedJobs.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                Concluídos · {completedJobs.length}
              </p>
              <div className="space-y-3 opacity-60">
                {completedJobs.map((interaction, i) => (
                  <JobCard
                    key={interaction.id}
                    interaction={interaction}
                    i={i}
                    completing={false}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
