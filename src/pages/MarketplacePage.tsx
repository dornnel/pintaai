import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ShoppingBag, Search, Package, ChevronRight, Tag } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Product, Partner } from '../lib/types'
import { formatCurrency } from '../lib/utils'

const CATEGORY_LABELS: Record<string, string> = {
  paint: 'Tintas', primer: 'Primers', brush: 'Pincéis', roller: 'Rolos',
  tape: 'Fitas', sandpaper: 'Lixas', accessory: 'Acessórios', other: 'Outros',
}

const PRODUCT_IMAGES: Record<string, string> = {
  paint: 'https://images.unsplash.com/photo-1562259929-b4e1fd3aef09?w=300&q=70',
  primer: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=300&q=70',
  brush: 'https://images.unsplash.com/photo-1543857778-c4a1a3e0b2eb?w=300&q=70',
  roller: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&q=70',
  tape: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300&q=70',
  other: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=300&q=70',
}

// Demo products for when DB is empty
const DEMO_PRODUCTS = [
  { id: '1', name: 'Tinta Suvinil Fosco Premium 18L', category: 'paint', price: 289.90, brand: 'Suvinil', active: true, partner_id: '1', sku: null, commission_rate: 5, created_at: new Date().toISOString() },
  { id: '2', name: 'Tinta Coral Acrilico 18L Branco', category: 'paint', price: 249.90, brand: 'Coral', active: true, partner_id: '1', sku: null, commission_rate: 5, created_at: new Date().toISOString() },
  { id: '3', name: 'Massa Corrida PVA 25kg', category: 'primer', price: 89.90, brand: 'Eucatex', active: true, partner_id: '2', sku: null, commission_rate: 4, created_at: new Date().toISOString() },
  { id: '4', name: 'Rolo Lã 23cm Kit 3 peças', category: 'roller', price: 42.50, brand: 'Atlas', active: true, partner_id: '2', sku: null, commission_rate: 6, created_at: new Date().toISOString() },
  { id: '5', name: 'Pincel Cerdas Sintéticas 3"', category: 'brush', price: 18.90, brand: 'Tigre', active: true, partner_id: '1', sku: null, commission_rate: 6, created_at: new Date().toISOString() },
  { id: '6', name: 'Fita Crepe 48mm x 50m', category: 'tape', price: 12.90, brand: '3M', active: true, partner_id: '2', sku: null, commission_rate: 3, created_at: new Date().toISOString() },
]

const DEMO_PARTNERS = [
  { id: '1', trade_name: 'Tintas Campeche', contact_phone: '', status: 'active', partner_type: 'paint_store', legal_name: null, neighborhood_id: null, commission_rate: 5, coupon_code: 'PINTAE10', created_at: new Date().toISOString() },
  { id: '2', trade_name: 'Casa das Tintas Floripa', contact_phone: '', status: 'active', partner_type: 'material_store', legal_name: null, neighborhood_id: null, commission_rate: 4, coupon_code: null, created_at: new Date().toISOString() },
]

export function MarketplacePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [prodRes, partRes] = await Promise.all([
        supabase.from('products').select('*').eq('active', true),
        supabase.from('partners').select('*').eq('status', 'active'),
      ])
      const prods = (prodRes.data as Product[]) || []
      setProducts(prods.length > 0 ? prods : DEMO_PRODUCTS as unknown as Product[])
      const parts = (partRes.data as Partner[]) || []
      setPartners(parts.length > 0 ? parts : DEMO_PARTNERS as unknown as Partner[])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = products.filter(p =>
    (category === 'all' || p.category === category) &&
    (search === '' || p.name.toLowerCase().includes(search.toLowerCase()) || p.brand?.toLowerCase().includes(search.toLowerCase()))
  )

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-brand">Pintaê</Link>
          <div className="flex items-center gap-3">
            <Link to="/chat" className="text-sm text-brand font-medium hidden sm:block">Pedir orçamento</Link>
            <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700">Entrar</Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-brand uppercase tracking-widest">Marketplace</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Tintas e materiais</h1>
          <p className="text-gray-500">Produtos de lojas parceiras em Florianópolis. Entrega local.</p>
        </motion.div>

        {/* Partners strip */}
        {partners.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="flex gap-3 overflow-x-auto pb-2 mb-8 scrollbar-hide">
            {partners.map(p => (
              <div key={p.id} className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-2 shrink-0">
                <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                  <ShoppingBag className="w-3.5 h-3.5 text-brand" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800 whitespace-nowrap">{p.trade_name}</p>
                  {(p as unknown as {coupon_code: string|null}).coupon_code && (
                    <p className="text-xs text-brand">Cupom: {(p as unknown as {coupon_code: string}).coupon_code}</p>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar produto ou marca..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand bg-white" />
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {categories.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap border transition-colors cursor-pointer ${
                  category === cat ? 'bg-brand text-white border-brand' : 'bg-white border-gray-200 text-gray-600 hover:border-brand hover:text-brand'
                }`}>
                {cat === 'all' ? 'Todos' : CATEGORY_LABELS[cat] || cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-64 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
          </div>
        ) : (
          <motion.div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.08)' }}
                className="bg-white border border-gray-100 rounded-2xl overflow-hidden cursor-pointer"
              >
                <div className="h-40 overflow-hidden bg-gray-50">
                  <img
                    src={PRODUCT_IMAGES[product.category] || PRODUCT_IMAGES.other}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-1 mb-1">
                    <Tag className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-400">{CATEGORY_LABELS[product.category] || product.category}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 leading-snug mb-1 line-clamp-2">{product.name}</p>
                  {product.brand && <p className="text-xs text-gray-400 mb-3">{product.brand}</p>}
                  <div className="flex items-center justify-between">
                    {product.price ? (
                      <span className="font-bold text-gray-900">{formatCurrency(product.price)}</span>
                    ) : (
                      <span className="text-sm text-gray-400">Consultar</span>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                      className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4 text-white" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {filtered.length === 0 && !loading && (
          <div className="text-center py-16">
            <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">Nenhum produto encontrado.</p>
          </div>
        )}
      </div>
    </div>
  )
}
