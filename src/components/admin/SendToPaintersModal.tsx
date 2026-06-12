import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Send, CheckCircle, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { sendLeadToPainters, type LeadForDistribution } from '../../lib/leadDistribution'

interface Painter { id: string; user: { name: string; phone: string } }

export function SendToPaintersModal({ lead, onClose, onSent }: {
  lead: LeadForDistribution & { protocol?: string; service_interest?: string; neighborhood?: string }
  onClose: () => void
  onSent?: () => void
}) {
  const [painters, setPainters] = useState<Painter[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.from('painters').select('id, user:users(name,phone)').eq('availability_status', 'available')
      .then(({ data }) => setPainters((data as unknown as Painter[]) || []))
  }, [])

  function selectAll() {
    setSelected(new Set(painters.map(p => p.id)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  async function send() {
    setSending(true)
    await sendLeadToPainters(lead, Array.from(selected))
    setDone(true)
    setSending(false)
    setTimeout(() => { onClose(); onSent?.() }, 1500)
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
            <p className="text-xs text-gray-400 mt-1">Dados do cliente anonimizados na mensagem.</p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-900">Enviar para pintores</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  <span className="font-mono text-brand">{lead.protocol}</span>
                  {lead.service_interest && ` · ${lead.service_interest}`}
                  {lead.neighborhood && ` · ${lead.neighborhood}`}
                </p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 text-xs text-amber-700">
              🔒 A mensagem será enviada <strong>sem dados pessoais</strong> do cliente — só briefing técnico e estimativa.
            </div>

            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400">{painters.length} pintor{painters.length !== 1 ? 'es' : ''} disponíve{painters.length !== 1 ? 'is' : 'l'}</p>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll} disabled={painters.length === 0}
                  className="text-xs text-brand font-medium hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                  Selecionar todos
                </button>
                <span className="text-gray-200">|</span>
                <button type="button" onClick={clearSelection} disabled={selected.size === 0}
                  className="text-xs text-gray-500 font-medium hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                  Limpar seleção
                </button>
              </div>
            </div>

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
