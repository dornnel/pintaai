import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, ExternalLink } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatRelativeTime } from '../lib/utils'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read: boolean
  created_at: string
}

const TYPE_ICONS: Record<string, string> = {
  proposal_sent: '📨',
  proposal_received: '💰',
  lead_new: '🎯',
  system: '⚙️',
}

export function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const unread = notifications.filter(n => !n.read).length

  useEffect(() => {
    if (!user?.id) return
    load()

    const channel = supabase.channel('notifications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'pintae', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev])
        })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function load() {
    if (!user?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications((data || []) as Notification[])
    setLoading(false)
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function markAllRead() {
    if (!user?.id) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  function handleClick(n: Notification) {
    if (!n.read) markRead(n.id)
    if (n.link) navigate(n.link)
    setOpen(false)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={() => setOpen(!open)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
        <Bell className="w-4.5 h-4.5 text-gray-500" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 w-80 sm:w-96 bg-white rounded-2xl border border-gray-200 shadow-2xl shadow-black/10 overflow-hidden z-50">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">Notificações</p>
              {unread > 0 && (
                <button onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] text-brand font-medium hover:underline cursor-pointer">
                  <Check className="w-3 h-3" /> Marcar todas como lidas
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">Nenhuma notificação</p>
                </div>
              ) : (
                notifications.map(n => (
                  <button key={n.id} onClick={() => handleClick(n)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50 last:border-0 ${!n.read ? 'bg-orange-50/40' : ''}`}>
                    <span className="text-base shrink-0 mt-0.5">{TYPE_ICONS[n.type] || '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-snug ${!n.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{n.title}</p>
                      {n.body && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{n.body}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">{formatRelativeTime(n.created_at)}</p>
                    </div>
                    {n.link && <ExternalLink className="w-3 h-3 text-gray-300 shrink-0 mt-1" />}
                    {!n.read && <span className="w-2 h-2 bg-brand rounded-full shrink-0 mt-1.5" />}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
