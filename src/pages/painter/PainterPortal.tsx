import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Briefcase, CheckCircle, MapPin, Send, Loader2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { ServiceRequest, Quote } from '../../lib/types'
import { REQUEST_STATUSES } from '../../lib/constants'
import { cn, formatCurrency } from '../../lib/utils'

interface ProposalForm {
  total_price: string
  estimated_duration_days: string
  material_included: boolean
  payment_terms: string
  notes: string
}

function ProposalModal({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const { user } = useAuth()
  const [form, setForm] = useState<ProposalForm>({
    total_price: '', estimated_duration_days: '3', material_included: false,
    payment_terms: '50% adiantado, 50% na conclusão', notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    const { data: painter } = await supabase.from('painters').select('id').eq('user_id', user.id).single()
    if (!painter) { setLoading(false); return }

    await supabase.from('quotes').insert({
      service_request_id: requestId,
      provider_type: 'painter',
      provider_id: painter.id,
      total_price: parseFloat(form.total_price),
      estimated_duration_days: parseInt(form.estimated_duration_days),
      material_included: form.material_included,
      payment_terms: form.payment_terms,
      notes: form.notes,
      status: 'submitted',
    })
    setDone(true)
    setLoading(false)
    setTimeout(onClose, 1500)
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
        className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {done ? (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-gray-900">Proposta enviada!</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-900">Enviar proposta</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Preço total (R$)</label>
                  <input type="number" required value={form.total_price} onChange={e => setForm({...form, total_price: e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" placeholder="1500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Duração (dias)</label>
                  <input type="number" required value={form.estimated_duration_days} onChange={e => setForm({...form, estimated_duration_days: e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" placeholder="3" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.material_included} onChange={e => setForm({...form, material_included: e.target.checked})} className="w-4 h-4 accent-brand" />
                <span className="text-sm text-gray-700">Material incluso no preço</span>
              </label>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Condições de pagamento</label>
                <input type="text" value={form.payment_terms} onChange={e => setForm({...form, payment_terms: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Observações</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand resize-none" placeholder="Descreva o que está incluso..." />
              </div>
              <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="w-full py-3 bg-brand text-white font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar proposta
              </motion.button>
            </form>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

export function PainterPortal() {
  const { user, signOut } = useAuth()
  const [availableJobs, setAvailableJobs] = useState<ServiceRequest[]>([])
  const [myQuotes, setMyQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [proposalTarget, setProposalTarget] = useState<string | null>(null)
  const [tab, setTab] = useState<'jobs' | 'proposals'>('jobs')

  useEffect(() => {
    async function load() {
      const [jobsRes, quotesRes] = await Promise.all([
        supabase.from('service_requests')
          .select('*, neighborhood:neighborhoods(name)')
          .in('status', ['briefing_ready', 'sent_to_pros', 'quoting'])
          .order('created_at', { ascending: false }),
        supabase.from('quotes')
          .select('*, service_request:service_requests(request_type, neighborhood:neighborhoods(name))')
          .order('created_at', { ascending: false }),
      ])
      setAvailableJobs((jobsRes.data as ServiceRequest[]) || [])
      setMyQuotes((quotesRes.data as Quote[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  const TABS = [
    { id: 'jobs', label: 'Oportunidades', count: availableJobs.length },
    { id: 'proposals', label: 'Minhas propostas', count: myQuotes.length },
  ] as const

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-brand">Pintaê</Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">{user?.name}</span>
            <button onClick={signOut} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">Sair</button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Portal do Pintor</h1>
          <p className="text-gray-500 text-sm mt-1">Oportunidades de trabalho próximas a você.</p>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: Briefcase, label: 'Jobs disponíveis', value: availableJobs.length, color: 'text-blue-500' },
            { icon: Send, label: 'Propostas enviadas', value: myQuotes.length, color: 'text-brand' },
            { icon: CheckCircle, label: 'Selecionadas', value: myQuotes.filter(q => q.status === 'selected').length, color: 'text-green-500' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <Icon className={`w-5 h-5 ${color} mx-auto mb-1`} />
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400">{label}</p>
            </div>
          ))}
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
              className={cn('flex-1 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer',
                tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {t.label} {t.count > 0 && <span className="ml-1 text-xs text-brand font-semibold">({t.count})</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-32 bg-white rounded-2xl animate-pulse border border-gray-100" />)}</div>
        ) : tab === 'jobs' ? (
          availableJobs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <Briefcase className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Nenhuma oportunidade no momento.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableJobs.map((job, i) => (
                <motion.div key={job.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-semibold text-gray-900 capitalize">{job.request_type?.replace('_',' ')} · {job.property_type}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-500">{(job.neighborhood as unknown as {name:string})?.name}</span>
                      </div>
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', REQUEST_STATUSES[job.status]?.color)}>
                      {REQUEST_STATUSES[job.status]?.label}
                    </span>
                  </div>
                  {job.ai_briefing && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3 mb-3 line-clamp-2">{job.ai_briefing}</p>
                  )}
                  {job.ai_price_min && job.ai_price_max && (
                    <p className="text-xs text-gray-400 mb-3">Estimativa: {formatCurrency(job.ai_price_min)} – {formatCurrency(job.ai_price_max)}</p>
                  )}
                  <motion.button onClick={() => setProposalTarget(job.id)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="w-full py-2.5 bg-brand text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer">
                    <Send className="w-3.5 h-3.5" /> Enviar proposta
                  </motion.button>
                </motion.div>
              ))}
            </div>
          )
        ) : (
          myQuotes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <Send className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Nenhuma proposta enviada ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myQuotes.map((q, i) => {
                const sr = (q as unknown as { service_request: { request_type: string; neighborhood: { name: string } } }).service_request
                return (
                  <motion.div key={q.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-gray-900 capitalize">{sr?.request_type?.replace('_',' ')} · {sr?.neighborhood?.name}</p>
                      <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium',
                        q.status === 'selected' ? 'bg-green-100 text-green-700' :
                        q.status === 'rejected' ? 'bg-red-100 text-red-600' :
                        'bg-yellow-100 text-yellow-700'
                      )}>{q.status === 'selected' ? 'Selecionada' : q.status === 'rejected' ? 'Recusada' : 'Aguardando'}</span>
                    </div>
                    <div className="flex gap-4 text-sm text-gray-600">
                      <span className="font-semibold text-gray-900">{formatCurrency(q.total_price)}</span>
                      <span className="text-gray-400">{q.estimated_duration_days} dias</span>
                      <span className="text-gray-400">{q.material_included ? 'c/ material' : 's/ material'}</span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )
        )}
      </div>

      <AnimatePresence>
        {proposalTarget && (
          <ProposalModal requestId={proposalTarget} onClose={() => setProposalTarget(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
