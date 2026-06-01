import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, Tag, X, Loader2, ToggleLeft, ToggleRight, Copy, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn, formatDate } from '../../lib/utils'
import type { Promotion } from '../../lib/types'

interface Partner { id: string; trade_name: string }

const PROMO_TYPES = [
  { value: 'percent_off', label: '% Desconto percentual' },
  { value: 'fixed_off', label: 'R$ Valor fixo de desconto' },
  { value: 'free_shipping', label: '🚚 Frete grátis' },
  { value: 'coupon', label: '🎟️ Cupom de código' },
]

export function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [editPromo, setEditPromo] = useState<Partial<Promotion> | null>(null)
  const [saving, setSaving] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')

  useEffect(() => { load() }, [])

  async function load() {
    const [promosRes, partnersRes] = await Promise.all([
      supabase.from('promotions').select('*').order('created_at', { ascending: false }),
      supabase.from('partners').select('id, trade_name').order('trade_name'),
    ])
    setPromotions((promosRes.data || []) as Promotion[])
    setPartners((partnersRes.data || []) as Partner[])
    setLoading(false)
  }

  async function save() {
    if (!editPromo?.name || !editPromo?.promo_type) return
    setSaving(true)
    if (editPromo.id) {
      await supabase.from('promotions').update({
        name: editPromo.name, description: editPromo.description,
        promo_type: editPromo.promo_type, discount_value: editPromo.discount_value,
        coupon_code: editPromo.coupon_code, min_order_value: editPromo.min_order_value,
        max_uses: editPromo.max_uses, active: editPromo.active,
        valid_from: editPromo.valid_from, valid_until: editPromo.valid_until,
      }).eq('id', editPromo.id)
    } else {
      await supabase.from('promotions').insert({
        partner_id: editPromo.partner_id || null,
        name: editPromo.name, description: editPromo.description || '',
        promo_type: editPromo.promo_type, discount_value: editPromo.discount_value || 0,
        coupon_code: editPromo.coupon_code, min_order_value: editPromo.min_order_value,
        max_uses: editPromo.max_uses, active: editPromo.active ?? true,
        valid_from: editPromo.valid_from || new Date().toISOString(),
        valid_until: editPromo.valid_until,
      })
    }
    setSaving(false)
    setEditPromo(null)
    load()
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('promotions').update({ active: !current }).eq('id', id)
    setPromotions(prev => prev.map(p => p.id === id ? { ...p, active: !current } : p))
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  function isExpired(promo: Promotion) {
    return promo.valid_until && new Date(promo.valid_until) < new Date()
  }

  const filtered = promotions.filter(p => {
    if (filterActive === 'active') return p.active && !isExpired(p)
    if (filterActive === 'inactive') return !p.active || isExpired(p)
    return true
  })

  const activeCount = promotions.filter(p => p.active && !isExpired(p)).length

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Promoções e Cupons</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {promotions.length} promoção{promotions.length !== 1 ? 'ões' : ''} · {activeCount} ativa{activeCount !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setEditPromo({ active: true, promo_type: 'percent_off', valid_from: new Date().toISOString() })}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl cursor-pointer hover:bg-brand-dark transition-colors"
        >
          <Plus className="w-4 h-4" /> Nova promoção
        </button>
      </div>

      <div className="flex gap-2 mb-5">
        {(['all', 'active', 'inactive'] as const).map(f => (
          <button key={f} onClick={() => setFilterActive(f)}
            className={cn('px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors', filterActive === f ? 'bg-brand text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300')}>
            {f === 'all' ? 'Todas' : f === 'active' ? 'Ativas' : 'Inativas'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-gray-100" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Tag className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Nenhuma promoção encontrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(promo => {
            const expired = isExpired(promo)
            return (
              <div key={promo.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-gray-900 text-sm">{promo.name}</p>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', promo.active && !expired ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                        {expired ? 'Expirada' : promo.active ? 'Ativa' : 'Inativa'}
                      </span>
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        {PROMO_TYPES.find(t => t.value === promo.promo_type)?.label.split(' ').slice(1).join(' ')}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                      {promo.discount_value && <span>Desconto: {promo.promo_type === 'percent_off' ? `${promo.discount_value}%` : `R$ ${promo.discount_value}`}</span>}
                      {promo.coupon_code && (
                        <button onClick={() => copyCode(promo.coupon_code!)} className="flex items-center gap-1 font-mono bg-gray-100 px-2 py-0.5 rounded cursor-pointer hover:bg-gray-200 transition-colors">
                          {copiedCode === promo.coupon_code ? <Check className="w-2.5 h-2.5 text-green-600" /> : <Copy className="w-2.5 h-2.5" />}
                          {promo.coupon_code}
                        </button>
                      )}
                      <span>{promo.uses_count || 0}{promo.max_uses ? `/${promo.max_uses}` : ''} usos</span>
                      {promo.valid_until && <span>Até {formatDate(promo.valid_until)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggleActive(promo.id, promo.active)}
                      className="text-gray-400 hover:text-brand cursor-pointer transition-colors">
                      {promo.active ? <ToggleRight className="w-5 h-5 text-brand" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button onClick={() => setEditPromo(promo)}
                      className="text-xs text-gray-500 hover:text-brand cursor-pointer px-2 py-1 rounded-lg hover:bg-orange-50 transition-colors">
                      Editar
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {editPromo !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setEditPromo(null)}>
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-gray-900">{editPromo.id ? 'Editar promoção' : 'Nova promoção'}</h3>
                <button onClick={() => setEditPromo(null)} className="text-gray-400 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Nome *</label>
                  <input value={editPromo.name || ''} onChange={e => setEditPromo({...editPromo, name: e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" placeholder="Ex: Desconto boas-vindas" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Tipo de promoção</label>
                  <select value={editPromo.promo_type || 'percent_off'} onChange={e => setEditPromo({...editPromo, promo_type: e.target.value as Promotion['promo_type']})}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-brand">
                    {PROMO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                      {editPromo.promo_type === 'percent_off' ? 'Desconto (%)' : 'Desconto (R$)'}
                    </label>
                    <input type="number" value={editPromo.discount_value || ''} onChange={e => setEditPromo({...editPromo, discount_value: Number(e.target.value)})}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" step="0.01" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Pedido mínimo (R$)</label>
                    <input type="number" value={editPromo.min_order_value || ''} onChange={e => setEditPromo({...editPromo, min_order_value: Number(e.target.value)})}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Código do cupom</label>
                    <input value={editPromo.coupon_code || ''} onChange={e => setEditPromo({...editPromo, coupon_code: e.target.value.toUpperCase()})}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand font-mono" placeholder="PINTAI10" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Máx. de usos</label>
                    <input type="number" value={editPromo.max_uses || ''} onChange={e => setEditPromo({...editPromo, max_uses: Number(e.target.value)})}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" placeholder="Ilimitado" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Válido de</label>
                    <input type="date" value={editPromo.valid_from?.slice(0, 10) || ''} onChange={e => setEditPromo({...editPromo, valid_from: e.target.value})}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Válido até</label>
                    <input type="date" value={editPromo.valid_until?.slice(0, 10) || ''} onChange={e => setEditPromo({...editPromo, valid_until: e.target.value || undefined})}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Parceiro (opcional)</label>
                  <select value={editPromo.partner_id || ''} onChange={e => setEditPromo({...editPromo, partner_id: e.target.value || undefined})}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-brand">
                    <option value="">Pintai própria</option>
                    {partners.map(p => <option key={p.id} value={p.id}>{p.trade_name}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editPromo.active ?? true} onChange={e => setEditPromo({...editPromo, active: e.target.checked})} className="w-4 h-4 accent-brand" />
                  <span className="text-sm text-gray-700">Ativa</span>
                </label>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setEditPromo(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 cursor-pointer">Cancelar</button>
                <button onClick={save} disabled={saving || !editPromo.name}
                  className="flex-1 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editPromo.id ? 'Salvar' : 'Criar promoção'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
