import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, MessageSquare, Phone, FileText, Clock, AlertTriangle, Image as ImageIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { ServiceRequest, Message } from '../../lib/types'
import { REQUEST_STATUSES } from '../../lib/constants'
import { cn, formatRelativeTime, formatCurrency } from '../../lib/utils'

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [request, setRequest] = useState<ServiceRequest | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    async function load() {
      const [reqRes, msgRes] = await Promise.all([
        supabase
          .from('service_requests')
          .select('*, neighborhood:neighborhoods(name), customer:customers(user:users(name,phone)), media:service_media(*), quotes(*)')
          .eq('id', id)
          .single(),
        supabase
          .from('messages')
          .select('*')
          .eq('service_request_id', id)
          .order('created_at', { ascending: true }),
      ])
      setRequest(reqRes.data as ServiceRequest)
      setMessages((msgRes.data as Message[]) || [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="p-8 text-sm text-gray-400">Carregando...</div>
  if (!request) return <div className="p-8 text-sm text-gray-500">Pedido não encontrado.</div>

  const statusCfg = REQUEST_STATUSES[request.status]

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin/requests" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-gray-900">Pedido #{request.id.slice(0, 8)}</h1>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusCfg?.color || 'bg-gray-100 text-gray-500')}>
              {statusCfg?.label || request.status}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {(request.neighborhood as unknown as { name: string })?.name} · {request.request_type} · {request.property_type}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Conversation thread */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-brand" />
              Conversa completa
            </h2>

            {messages.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sem mensagens registradas</p>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className={cn('flex gap-2', msg.direction === 'outbound' && 'flex-row-reverse')}>
                    <div className={cn(
                      'max-w-[75%] px-3 py-2 rounded-xl text-sm',
                      msg.direction === 'inbound'
                        ? 'bg-gray-100 text-gray-700 rounded-tl-sm'
                        : 'bg-brand text-white rounded-tr-sm',
                    )}>
                      <p>{msg.body}</p>
                      <div className={cn('flex items-center gap-2 mt-1', msg.direction === 'outbound' && 'justify-end')}>
                        <span className={cn('text-xs', msg.direction === 'inbound' ? 'text-gray-400' : 'text-orange-200')}>
                          {msg.channel} · {formatRelativeTime(msg.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Media */}
          {request.media && request.media.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
                <ImageIcon className="w-4 h-4 text-brand" />
                Fotos e vídeos
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {request.media.map((m) => (
                  <a key={m.id} href={m.public_url} target="_blank" rel="noopener noreferrer">
                    <img src={m.public_url} alt={m.ai_description || ''} className="w-full aspect-square object-cover rounded-xl border border-gray-100 hover:opacity-90 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* AI Briefing */}
          {request.ai_briefing && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-brand" />
                Briefing técnico (IA)
              </h2>
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{request.ai_briefing}</p>
              {request.ai_price_min && request.ai_price_max && (
                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                  Estimativa: <strong className="text-gray-700">
                    {formatCurrency(request.ai_price_min)} – {formatCurrency(request.ai_price_max)}
                  </strong>
                </div>
              )}
              {request.ai_risk_notes && (
                <div className="mt-2 p-2 bg-orange-50 rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-orange-600">{request.ai_risk_notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Customer info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
              <Phone className="w-4 h-4 text-brand" />
              Cliente
            </h2>
            <div className="text-sm text-gray-600 space-y-1">
              <p>{(request.customer as unknown as { user: { name: string } })?.user?.name || 'Anônimo'}</p>
              <p className="text-gray-400 text-xs">
                {(request.customer as unknown as { user: { phone: string } })?.user?.phone || '—'}
              </p>
            </div>
          </div>

          {/* Quotes */}
          {request.quotes && request.quotes.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-brand" />
                Propostas ({request.quotes.length})
              </h2>
              <div className="space-y-2">
                {request.quotes.map((q) => (
                  <div key={q.id} className="border border-gray-100 rounded-xl p-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-800">{formatCurrency(q.total_price)}</span>
                      <span className="text-gray-400">{q.status}</span>
                    </div>
                    <p className="text-gray-500">{q.estimated_duration_days}d · {q.material_included ? 'material incluso' : 'sem material'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
