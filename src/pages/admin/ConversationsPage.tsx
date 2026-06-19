import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { MessageSquare, X, Globe, Smartphone, Filter, ExternalLink, User, Brush, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatRelativeTime } from '../../lib/utils'
import type { ConversationSession } from '../../lib/types'
import { cn } from '../../lib/utils'

interface Message { id: string; direction: string; body: string; channel: string; created_at: string; metadata?: Record<string, unknown> }

const FIELD_LABELS: Record<string, string> = {
  name: 'Nome', email: 'Email', whatsapp: 'WhatsApp', role: 'Tipo',
  service_type: 'Serviço', property_type: 'Imóvel', neighborhood: 'Bairro',
  num_rooms: 'Cômodos', area_m2: 'Área (m²)', wall_condition: 'Paredes',
  deadline: 'Prazo', material: 'Material', preferred_professional: 'Profissional preferido',
  estimated_budget: 'Orçamento estimado', current_color: 'Cor atual',
  final_notes: 'Observações', protocol: 'Protocolo', confirmed: 'Confirmado',
}
const HIDDEN_FIELDS = new Set(['_metadata', '_partialProtocol', 'tracking_data', 'custom_fields', 'media_urls'])

function tryFormatJSON(body: string): React.ReactNode | null {
  if (!body.startsWith('{')) return null
  try {
    const obj = JSON.parse(body)
    const entries = Object.entries(obj).filter(([k]) => !HIDDEN_FIELDS.has(k) && obj[k] != null && obj[k] !== '')
    if (entries.length === 0) return null
    return (
      <div className="space-y-1">
        {entries.map(([key, val]) => (
          <div key={key} className="flex gap-2 text-[11px]">
            <span className="text-gray-400 font-medium shrink-0">{FIELD_LABELS[key] || key}:</span>
            <span className="text-gray-700 break-words">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
          </div>
        ))}
      </div>
    )
  } catch { return null }
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  web: <Globe className="w-3.5 h-3.5 text-blue-500" />,
  whatsapp: <Smartphone className="w-3.5 h-3.5 text-green-500" />,
}
const CHANNEL_LABELS: Record<string, string> = { web: 'Web', whatsapp: 'WhatsApp', instagram: 'Instagram', system: 'Sistema' }
const CHANNEL_BADGE: Record<string, string> = {
  web: 'bg-blue-50 text-blue-600',
  whatsapp: 'bg-green-50 text-green-600',
  instagram: 'bg-pink-50 text-pink-600',
}

export function ConversationsPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<ConversationSession[]>([])
  const [loading, setLoading] = useState(true)
  const [filterChannel, setFilterChannel] = useState('all')
  const [filterHasLead, setFilterHasLead] = useState('all')
  const [selected, setSelected] = useState<ConversationSession | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [partialCount, setPartialCount] = useState(0)

  useEffect(() => {
    load()
    loadPartialCount()

    const channel = supabase.channel('conversations-realtime')
      .on('postgres_changes', { event: '*', schema: 'pintae', table: 'conversation_sessions' },
        () => { load() })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function load() {
    const { data } = await supabase
      .from('conversation_sessions')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(100)
    setSessions((data || []) as ConversationSession[])
    setLoading(false)
  }

  async function loadPartialCount() {
    const { count } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('is_partial', true)
    setPartialCount(count || 0)
  }

  async function openSession(session: ConversationSession) {
    setSelected(session)
    setLoadingMessages(true)
    const { data } = await supabase
      .from('messages')
      .select('id, direction, body, channel, created_at')
      .eq('session_id', session.session_id)
      .order('created_at', { ascending: true })
      .limit(50)
    setMessages((data || []) as Message[])
    setLoadingMessages(false)
  }

  const filtered = sessions.filter(s => {
    const matchChannel = filterChannel === 'all' || s.channel === filterChannel
    const matchLead = filterHasLead === 'all'
      || (filterHasLead === 'yes' && s.service_request_id)
      || (filterHasLead === 'no' && !s.service_request_id)
    return matchChannel && matchLead
  })

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Conversas</h1>
          <p className="text-sm text-gray-500 mt-0.5">{sessions.length} sessão{sessions.length !== 1 ? 'ões' : ''} registrada{sessions.length !== 1 ? 's' : ''}</p>
        </div>
        {partialCount > 0 && (
          <button onClick={() => navigate('/admin/leads', { state: { showPartial: true } })}
            className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 font-medium hover:bg-amber-100 transition-colors cursor-pointer">
            <AlertCircle className="w-4 h-4" />
            Conversas incompletas ({partialCount})
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)}
            className="border border-gray-200 rounded-xl text-sm px-3 py-2.5 bg-white focus:outline-none focus:border-brand">
            <option value="all">Todos os canais</option>
            <option value="web">Web</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>
        <select value={filterHasLead} onChange={e => setFilterHasLead(e.target.value)}
          className="border border-gray-200 rounded-xl text-sm px-3 py-2.5 bg-white focus:outline-none focus:border-brand">
          <option value="all">Com e sem pedido</option>
          <option value="yes">Com pedido gerado</option>
          <option value="no">Sem pedido</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-white rounded-2xl animate-pulse border border-gray-100" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Nenhuma conversa encontrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(session => {
            const collected = (session.collected_data || {}) as Record<string, string>
            const userName = collected.name || session.user_identifier?.slice(0, 20) || 'Anônimo'
            const isPainter = collected.role === 'painter'
            const initial = userName[0]?.toUpperCase() || '?'
            return (
              <motion.div key={session.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => openSession(session)}>
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
                    isPainter ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-brand')}>
                    {initial}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Row 1: name + badges */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-gray-900">{userName}</p>
                      <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5', CHANNEL_BADGE[session.channel] || 'bg-gray-100 text-gray-500')}>
                        {CHANNEL_ICONS[session.channel]}
                        {CHANNEL_LABELS[session.channel] || session.channel}
                      </span>
                      {isPainter ? (
                        <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                          <Brush className="w-2.5 h-2.5" /> Pintor
                        </span>
                      ) : collected.role === 'client' && (
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                          <User className="w-2.5 h-2.5" /> Cliente
                        </span>
                      )}
                      {session.service_request_id && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Lead gerado ✓</span>
                      )}
                    </div>

                    {/* Row 2: dados coletados */}
                    <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                      {collected.service_type && <span>🎨 {collected.service_type}</span>}
                      {collected.neighborhood && <span>📍 {collected.neighborhood}</span>}
                      {collected.email && <span>📧 {collected.email}</span>}
                      {collected.whatsapp && <span>📱 {collected.whatsapp}</span>}
                    </div>

                    {/* Row 3: estado + tempo */}
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                      <span className="bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded font-mono">
                        {session.current_state}
                      </span>
                      <span>{new Date(session.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} ({formatRelativeTime(session.updated_at)})</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    {session.service_request_id && (
                      <Link to="/admin/leads" className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Drawer de mensagens */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-end"
            onClick={() => setSelected(null)}>
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="bg-white h-full w-full sm:max-w-md flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 shrink-0">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Histórico da conversa</p>
                  <p className="text-xs text-gray-400">{(selected.collected_data as Record<string,string>)?.name || 'Anônimo'} · {CHANNEL_LABELS[selected.channel]}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-400 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">Nenhuma mensagem registrada</p>
                ) : (
                  messages.map(msg => {
                    const formatted = tryFormatJSON(msg.body)
                    return (
                      <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                          msg.direction === 'outbound' ? 'bg-brand text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                        }`}>
                          {formatted ? (
                            <div className="bg-white/90 rounded-lg p-2.5 border border-gray-200/50">
                              <p className="text-[10px] font-semibold text-brand mb-1.5 uppercase tracking-wide">Dados coletados</p>
                              {formatted}
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                          )}
                          <p className={`text-[10px] mt-1 ${msg.direction === 'outbound' ? 'text-white/60' : 'text-gray-400'}`}>
                            {new Date(msg.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
