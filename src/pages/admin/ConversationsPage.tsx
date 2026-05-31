import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { MessageSquare, X, Globe, Smartphone, Filter, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatRelativeTime } from '../../lib/utils'
import type { ConversationSession } from '../../lib/types'

interface Message { id: string; direction: string; body: string; channel: string; created_at: string }

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  web: <Globe className="w-3 h-3 text-blue-500" />,
  whatsapp: <Smartphone className="w-3 h-3 text-green-500" />,
}
const CHANNEL_LABELS: Record<string, string> = { web: 'Web', whatsapp: 'WhatsApp', instagram: 'Instagram', system: 'Sistema' }

export function ConversationsPage() {
  const [sessions, setSessions] = useState<ConversationSession[]>([])
  const [loading, setLoading] = useState(true)
  const [filterChannel, setFilterChannel] = useState('all')
  const [filterHasLead, setFilterHasLead] = useState('all')
  const [selected, setSelected] = useState<ConversationSession | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('conversation_sessions')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(100)
    setSessions((data || []) as ConversationSession[])
    setLoading(false)
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
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Conversas</h1>
        <p className="text-sm text-gray-500 mt-0.5">{sessions.length} sessão{sessions.length !== 1 ? 'ões' : ''} registrada{sessions.length !== 1 ? 's' : ''}</p>
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
            const userName = collected.name || session.user_identifier?.slice(0, 12) || 'Anônimo'
            return (
              <div key={session.id} className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-gray-200 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <div className="flex items-center gap-1">
                        {CHANNEL_ICONS[session.channel] || <Globe className="w-3 h-3 text-gray-400" />}
                        <span className="text-xs text-gray-500">{CHANNEL_LABELS[session.channel] || session.channel}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">{userName}</p>
                      {session.service_request_id && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Pedido gerado</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                      <span>Estado: <strong className="text-gray-600">{session.current_state}</strong></span>
                      {collected.email && <span>📧 {collected.email}</span>}
                      {collected.whatsapp && <span>📱 {collected.whatsapp}</span>}
                      <span>{formatRelativeTime(session.updated_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {session.service_request_id && (
                      <a href={`/admin/leads`} className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors cursor-pointer">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button onClick={() => openSession(session)}
                      className="text-xs text-brand font-medium px-2.5 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 cursor-pointer transition-colors">
                      Ver mensagens
                    </button>
                  </div>
                </div>
              </div>
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
                  messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                        msg.direction === 'outbound' ? 'bg-brand text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      }`}>
                        {msg.body.length > 200 ? `${msg.body.slice(0, 200)}...` : msg.body}
                        <p className={`text-[10px] mt-1 ${msg.direction === 'outbound' ? 'text-white/60' : 'text-gray-400'}`}>
                          {formatRelativeTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
