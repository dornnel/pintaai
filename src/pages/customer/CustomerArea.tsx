import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Plus, ArrowRight, Paintbrush } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { REQUEST_STATUSES } from '../../lib/constants'
import type { ServiceRequest } from '../../lib/types'
import { cn, formatDate, formatCurrency } from '../../lib/utils'

export function CustomerArea() {
  const { user, signOut } = useAuth()
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('service_requests')
        .select('*, neighborhood:neighborhoods(name), quotes(*)')
        .order('created_at', { ascending: false })
      setRequests((data as ServiceRequest[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-gray-900">Olá, {user?.name?.split(' ')[0]}!</h1>
          <p className="text-gray-500 text-sm mt-1">Acompanhe seus pedidos e propostas de pintura.</p>
        </motion.div>

        {/* New request CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          whileHover={{ scale: 1.01 }}
        >
          <Link
            to="/chat"
            className="flex items-center justify-between bg-brand rounded-2xl p-5 mb-8 group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-white">Novo pedido de pintura</p>
                <p className="text-white/70 text-xs">Receba até 3 propostas comparáveis</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>

        {/* Requests */}
        <h2 className="font-semibold text-gray-900 mb-4">Meus pedidos</h2>

        {loading ? (
          <div className="space-y-3">
            {[1,2].map(i => <div key={i} className="h-28 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Paintbrush className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Nenhum pedido ainda. Comece pedindo um orçamento!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((r, i) => {
              const statusCfg = REQUEST_STATUSES[r.status]
              const quotesCount = (r.quotes as unknown as unknown[])?.length || 0
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  whileHover={{ y: -2 }}
                >
                  <Link to={`/minha-area/pedido/${r.id}`} className="block bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusCfg?.color)}>
                            {statusCfg?.label}
                          </span>
                          <span className="text-xs text-gray-400">#{r.id.slice(0,8)}</span>
                        </div>
                        <p className="font-medium text-gray-800 capitalize">
                          {r.request_type?.replace('_', ' ')} · {(r.neighborhood as unknown as {name:string})?.name}
                        </p>
                        {r.ai_price_min && r.ai_price_max && (
                          <p className="text-xs text-gray-500 mt-1">
                            Estimativa: {formatCurrency(r.ai_price_min)} – {formatCurrency(r.ai_price_max)}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-gray-400">{formatDate(r.created_at)}</p>
                        {quotesCount > 0 && (
                          <p className="text-xs text-brand font-semibold mt-1">{quotesCount} proposta{quotesCount > 1 ? 's' : ''}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
