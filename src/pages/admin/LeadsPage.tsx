import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Search, Send, CheckCircle, Clock, Eye, MessageCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn, formatDate, formatRelativeTime } from '../../lib/utils'

interface Lead {
  id: string
  protocol: string
  name: string
  phone?: string
  email?: string
  source: string
  service_interest?: string
  neighborhood?: string
  stage: string
  stage_updated_at: string
  notes?: string
  tags: string[]
  created_at: string
}

interface Painter { id: string; user: { name: string; phone: string } }

const STAGES: Record<string, { label: string; color: string }> = {
  new: { label: 'Novo', color: 'bg-gray-100 text-gray-700' },
  contacted: { label: 'Contatado', color: 'bg-blue-100 text-blue-700' },
  qualified: { label: 'Qualificado', color: 'bg-violet-100 text-violet-700' },
  proposal_sent: { label: 'Proposta Enviada', color: 'bg-yellow-100 text-yellow-700' },
  won: { label: 'Ganho', color: 'bg-green-100 text-green-700' },
  lost: { label: 'Perdido', color: 'bg-red-100 text-red-600' },
}

const SOURCE_LABELS: Record<string, string> = {
  chat: '💬 Chat', whatsapp: '📱 WhatsApp', web: '🌐 Web',
  instagram: '📸 Instagram', admin: '🔧 Admin',
}

function SendToPaintersModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [painters, setPainters] = useState<Painter[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.from('painters').select('id, user:users(name,phone)').eq('availability_status', 'available').then(({ data }) => {
      setPainters((data as unknown as Painter[]) || [])
    })
  }, [])

  async function send() {
    setSending(true)
    // Create messages for each selected painter
    await Promise.all(Array.from(selected).map(painterId =>
      supabase.from('messages').insert({
        channel: 'admin',
        direction: 'outbound',
        body: `Nova solicitação ${lead.protocol}: ${lead.service_interest} em ${lead.neighborhood}. Cliente: ${lead.name} (${lead.phone}). Briefing: ${lead.notes || 'Ver admin.'}`,
        metadata: { lead_id: lead.id, painter_id: painterId, action: 'lead_sent_to_painter' },
      })
    ))
    await supabase.from('leads').update({ stage: 'proposal_sent', stage_updated_at: new Date().toISOString() }).eq('id', lead.id)
    setDone(true)
    setSending(false)
    setTimeout(onClose, 1500)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        {done ? (
          <div className="text-center py-4">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <p className="font-semibold text-gray-900">Enviado para {selected.size} pintor{selected.size !== 1 ? 'es' : ''}!</p>
          </div>
        ) : (
          <>
            <h3 className="font-bold text-gray-900 mb-1">Enviar para pintores</h3>
            <p className="text-xs text-gray-400 mb-4">Lead: <strong>{lead.protocol}</strong> · {lead.service_interest} · {lead.neighborhood}</p>
            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
              {painters.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Nenhum pintor disponível</p>}
              {painters.map(p => (
                <label key={p.id} className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${selected.has(p.id) ? 'border-brand bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="checkbox" checked={selected.has(p.id)}
                    onChange={e => setSelected(prev => { const s = new Set(prev); e.target.checked ? s.add(p.id) : s.delete(p.id); return s })}
                    className="accent-brand w-4 h-4" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.user?.name}</p>
                    <p className="text-xs text-gray-400">{p.user?.phone}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded text-sm text-gray-600 cursor-pointer">Cancelar</button>
              <button onClick={send} disabled={sending || selected.size === 0}
                className="flex-1 py-2.5 bg-brand text-white rounded text-sm font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                {sending ? 'Enviando...' : <><Send className="w-3.5 h-3.5" /> Enviar ({selected.size})</>}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

export function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [sending, setSending] = useState<Lead | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { loadLeads() }, [])

  async function loadLeads() {
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    setLeads((data as Lead[]) || [])
    setLoading(false)
  }

  async function updateStage(id: string, stage: string) {
    await supabase.from('leads').update({ stage, stage_updated_at: new Date().toISOString() }).eq('id', id)
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage } : l))
  }

  const filtered = leads.filter(l => {
    const matchSearch = !search || l.protocol?.includes(search.toUpperCase()) ||
      l.name?.toLowerCase().includes(search.toLowerCase()) ||
      l.phone?.includes(search) || l.neighborhood?.toLowerCase().includes(search.toLowerCase())
    const matchStage = stageFilter === 'all' || l.stage === stageFilter
    return matchSearch && matchStage
  })

  const counts = Object.fromEntries(Object.keys(STAGES).map(s => [s, leads.filter(l => l.stage === s).length]))

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Solicitações (Leads)</h1>
          <p className="text-sm text-gray-500 mt-0.5">{leads.length} lead{leads.length !== 1 ? 's' : ''} · {counts['new'] || 0} novo{(counts['new'] || 0) !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Stage summary */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
        {Object.entries(STAGES).map(([key, { label, color }]) => (
          <button key={key} onClick={() => setStageFilter(stageFilter === key ? 'all' : key)}
            className={cn('text-center p-2.5 rounded border transition-colors cursor-pointer', stageFilter === key ? `${color} border-transparent ring-2 ring-brand` : 'bg-white border-gray-100 hover:border-gray-200')}>
            <p className="text-lg font-bold text-gray-900">{counts[key] || 0}</p>
            <p className="text-[10px] text-gray-500">{label}</p>
          </button>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por protocolo, nome, bairro..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-brand" />
        </div>
        <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
          className="border border-gray-200 rounded text-sm px-3 py-2.5 focus:outline-none focus:border-brand bg-white">
          <option value="all">Todos os estágios</option>
          {Object.entries(STAGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Leads list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-white rounded animate-pulse border border-gray-100" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded border border-gray-100 p-12 text-center">
          <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Nenhuma solicitação encontrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(lead => (
            <div key={lead.id} className="bg-white rounded border border-gray-100">
              <div className="p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-xs font-mono font-bold text-brand bg-orange-50 px-2 py-0.5 rounded">{lead.protocol || 'PT-???'}</span>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded', STAGES[lead.stage]?.color || 'bg-gray-100 text-gray-600')}>
                      {STAGES[lead.stage]?.label || lead.stage}
                    </span>
                    <span className="text-xs text-gray-400">{SOURCE_LABELS[lead.source] || lead.source}</span>
                    <span className="text-xs text-gray-300">{formatRelativeTime(lead.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{lead.name}</p>
                    {lead.neighborhood && <span className="text-xs text-gray-500">📍 {lead.neighborhood}</span>}
                    {lead.service_interest && <span className="text-xs text-gray-500">🎨 {lead.service_interest}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {lead.phone && (
                    <a href={`https://wa.me/55${lead.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 flex items-center justify-center rounded bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button onClick={() => setSending(lead)}
                    className="w-7 h-7 flex items-center justify-center rounded bg-brand/10 text-brand hover:bg-brand/20 cursor-pointer transition-colors" title="Enviar para pintores">
                    <Send className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setExpanded(expanded === lead.id ? null : lead.id)}
                    className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer transition-colors">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {expanded === lead.id && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  className="px-4 pb-4 border-t border-gray-100 pt-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3 text-xs">
                    {lead.phone && <div><p className="text-gray-400">WhatsApp</p><p className="font-medium">{lead.phone}</p></div>}
                    {lead.email && <div><p className="text-gray-400">E-mail</p><p className="font-medium">{lead.email}</p></div>}
                    <div><p className="text-gray-400">Cadastrado</p><p className="font-medium">{formatDate(lead.created_at)}</p></div>
                  </div>
                  {lead.notes && (
                    <div className="bg-gray-50 rounded p-3 text-xs text-gray-600 mb-3">
                      <p className="font-semibold text-gray-700 mb-1">Dados do briefing</p>
                      {(() => {
                        try { return Object.entries(JSON.parse(lead.notes)).map(([k, v]) => (
                          <div key={k} className="flex gap-2"><span className="text-gray-400 capitalize">{k.replace(/_/g,' ')}:</span><span>{String(v)}</span></div>
                        )) } catch { return <p>{lead.notes}</p> }
                      })()}
                    </div>
                  )}
                  {/* Stage changer */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Alterar estágio:</span>
                    <select value={lead.stage} onChange={e => updateStage(lead.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand bg-white cursor-pointer">
                      {Object.entries(STAGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {sending && <SendToPaintersModal lead={sending} onClose={() => { setSending(null); loadLeads() }} />}
      </AnimatePresence>
    </div>
  )
}
