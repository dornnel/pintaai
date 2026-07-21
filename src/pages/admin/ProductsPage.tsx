import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Plus, Search, Edit2, Trash2, CheckCircle, XCircle, Star, Package,
  X, Loader2, Eye, EyeOff,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import type { Product } from '../../lib/types'

interface Partner { id: string; trade_name: string }

const CATEGORIES = ['paint', 'primer', 'brush', 'roller', 'tape', 'sandpaper', 'accessory', 'other']
const CATEGORY_LABELS: Record<string, string> = {
  paint: '🎨 Tinta', primer: '🪣 Primer', brush: '🖌️ Pincel', roller: '🎢 Rolo',
  tape: '📦 Fita', sandpaper: '🔲 Lixa', accessory: '🔧 Acessório', other: '📦 Outro',
}

type ApprovalStatus = 'pending' | 'approved' | 'rejected'
const APPROVAL_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}
const APPROVAL_LABELS: Record<string, string> = {
  pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado',
}

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterOrigin, setFilterOrigin] = useState('all')
  const [editProduct, setEditProduct] = useState<Partial<Product> | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [productsRes, partnersRes] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('partners').select('id, trade_name').order('trade_name'),
    ])
    setProducts((productsRes.data || []) as Product[])
    setPartners((partnersRes.data || []) as Partner[])
    setLoading(false)
  }

  async function save() {
    if (!editProduct?.name) return
    setSaving(true)
    if (editProduct.id) {
      await supabase.from('products').update({
        name: editProduct.name, description: editProduct.description,
        category: editProduct.category, price: editProduct.price,
        commission_rate: editProduct.commission_rate, active: editProduct.active,
        featured: editProduct.featured, approval_status: editProduct.approval_status,
        stock_quantity: editProduct.stock_quantity,
      }).eq('id', editProduct.id)
    } else {
      await supabase.from('products').insert({
        partner_id: editProduct.partner_id || null,
        name: editProduct.name, description: editProduct.description || '',
        category: editProduct.category || 'other',
        price: editProduct.price || 0,
        commission_rate: editProduct.commission_rate || 0,
        active: editProduct.active ?? true,
        featured: editProduct.featured ?? false,
        approval_status: 'approved',
        origin: editProduct.partner_id ? 'partner' : 'pintai',
        stock_quantity: editProduct.stock_quantity || 0,
      })
    }
    setSaving(false)
    setEditProduct(null)
    load()
  }

  async function updateApproval(id: string, status: ApprovalStatus) {
    await supabase.from('products').update({ approval_status: status }).eq('id', id)
    setProducts(prev => prev.map(p => p.id === id ? { ...p, approval_status: status } : p))
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from('products').update({ active: !active }).eq('id', id)
    setProducts(prev => prev.map(p => p.id === id ? { ...p, active: !active } : p))
  }

  async function remove(id: string) {
    if (!confirm('Remover este produto?')) return
    await supabase.from('products').delete().eq('id', id)
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCategory === 'all' || p.category === filterCategory
    const matchStatus = filterStatus === 'all' || p.approval_status === filterStatus
    const matchOrigin = filterOrigin === 'all' || p.origin === filterOrigin
    return matchSearch && matchCat && matchStatus && matchOrigin
  })

  const pendingCount = products.filter(p => p.approval_status === 'pending').length

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Produtos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {products.length} produto{products.length !== 1 ? 's' : ''}
            {pendingCount > 0 && <span className="ml-2 text-yellow-600 font-medium">· {pendingCount} aguardando aprovação</span>}
          </p>
        </div>
        <button
          onClick={() => setEditProduct({ active: true, approval_status: 'approved', origin: 'pintai', category: 'paint' })}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl cursor-pointer hover:bg-brand-dark transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo produto
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-44">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand" />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="border border-gray-200 rounded-xl text-sm px-3 py-2.5 bg-white focus:outline-none focus:border-brand">
          <option value="all">Todas categorias</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-xl text-sm px-3 py-2.5 bg-white focus:outline-none focus:border-brand">
          <option value="all">Todos status</option>
          <option value="pending">Pendente</option>
          <option value="approved">Aprovado</option>
          <option value="rejected">Rejeitado</option>
        </select>
        <select value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)}
          className="border border-gray-200 rounded-xl text-sm px-3 py-2.5 bg-white focus:outline-none focus:border-brand">
          <option value="all">Todas origens</option>
          <option value="pintai">Pinte Rápido próprio</option>
          <option value="partner">Parceiro</option>
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-white rounded-2xl animate-pulse border border-gray-100" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Nenhum produto encontrado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Produto</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden sm:table-cell">Categoria</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden md:table-cell">Preço</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden lg:table-cell">Origem</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(product => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{product.name}</p>
                        {product.featured && <span className="text-[10px] text-amber-600 flex items-center gap-0.5"><Star className="w-2.5 h-2.5" /> Destaque</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs text-gray-600">{CATEGORY_LABELS[product.category] || product.category}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm font-medium text-gray-900">{product.price ? formatCurrency(product.price) : '—'}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${product.origin === 'pintai' ? 'bg-brand/10 text-brand' : 'bg-gray-100 text-gray-600'}`}>
                      {product.origin === 'pintai' ? 'Pintai' : 'Parceiro'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${APPROVAL_COLORS[product.approval_status || 'approved']}`}>
                      {APPROVAL_LABELS[product.approval_status || 'approved']}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {product.approval_status === 'pending' && (
                        <>
                          <button onClick={() => updateApproval(product.id, 'approved')}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 cursor-pointer transition-colors">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => updateApproval(product.id, 'rejected')}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 cursor-pointer transition-colors">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <button onClick={() => toggleActive(product.id, product.active)}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${product.active ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-orange-50 text-brand hover:bg-orange-100'}`}>
                        {product.active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setEditProduct(product)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => remove(product.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 cursor-pointer transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal editar/criar */}
      <AnimatePresence>
        {editProduct !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setEditProduct(null)}>
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', damping: 24, stiffness: 280 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-gray-900">{editProduct.id ? 'Editar produto' : 'Novo produto'}</h3>
                <button onClick={() => setEditProduct(null)} className="text-gray-400 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Nome *</label>
                  <input value={editProduct.name || ''} onChange={e => setEditProduct({...editProduct, name: e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" placeholder="Nome do produto" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Descrição</label>
                  <textarea value={editProduct.description || ''} onChange={e => setEditProduct({...editProduct, description: e.target.value})}
                    rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Categoria</label>
                    <select value={editProduct.category || 'other'} onChange={e => setEditProduct({...editProduct, category: e.target.value as Product['category']})}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-brand">
                      {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Preço (R$)</label>
                    <input type="number" value={editProduct.price || ''} onChange={e => setEditProduct({...editProduct, price: Number(e.target.value)})}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" step="0.01" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Comissão (%)</label>
                    <input type="number" value={editProduct.commission_rate ? editProduct.commission_rate * 100 : ''} onChange={e => setEditProduct({...editProduct, commission_rate: Number(e.target.value) / 100})}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" step="0.1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Estoque</label>
                    <input type="number" value={editProduct.stock_quantity || ''} onChange={e => setEditProduct({...editProduct, stock_quantity: Number(e.target.value)})}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Parceiro (opcional)</label>
                  <select value={editProduct.partner_id || ''} onChange={e => setEditProduct({...editProduct, partner_id: e.target.value || undefined, origin: e.target.value ? 'partner' : 'pintai'})}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-brand">
                    <option value="">Produto próprio da Pinte Rápido</option>
                    {partners.map(p => <option key={p.id} value={p.id}>{p.trade_name}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editProduct.active ?? true} onChange={e => setEditProduct({...editProduct, active: e.target.checked})} className="w-4 h-4 accent-brand" />
                    <span className="text-sm text-gray-700">Ativo</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editProduct.featured ?? false} onChange={e => setEditProduct({...editProduct, featured: e.target.checked})} className="w-4 h-4 accent-brand" />
                    <span className="text-sm text-gray-700">Destaque</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setEditProduct(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 cursor-pointer">Cancelar</button>
                <button onClick={save} disabled={saving || !editProduct.name}
                  className="flex-1 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editProduct.id ? 'Salvar' : 'Criar produto'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
