import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowLeft, Calculator, Paintbrush, ChevronDown, ArrowRight, Info } from 'lucide-react'
import { formatCurrency } from '../lib/utils'

// ── Cobertura em m²/litro por tipo de tinta ─────────────────────────────────
const PAINT_TYPES = [
  { id: 'pva',     label: 'Tinta PVA',            coverage: 10, icon: '🪣' },
  { id: 'acrilico',label: 'Acrílico Premium',      coverage: 12, icon: '✨' },
  { id: 'latex',   label: 'Látex Standard',        coverage: 10, icon: '🖌' },
  { id: 'esmalte', label: 'Esmalte (madeira/metal)',coverage: 13, icon: '🔧' },
  { id: 'textura', label: 'Textura / Grafiato',    coverage: 5,  icon: '🧱' },
]

const SURFACE_TYPES = [
  { id: 'liso',     label: 'Liso (massa corrida)',  factor: 1.0  },
  { id: 'aspero',   label: 'Áspero / reboco',       factor: 1.2  },
  { id: 'novo',     label: 'Novo (sem pintura anterior)', factor: 1.25 },
  { id: 'madeira',  label: 'Madeira',               factor: 1.1  },
]

// ── Marcas e preços por litro (referência jun 2026) ─────────────────────────
const BRANDS = [
  {
    name: 'Coral',       logo: '🔵',
    prices: { pva: 22, acrilico: 44, latex: 28, esmalte: 38, textura: 35 },
    note: 'Custo-benefício',
  },
  {
    name: 'Suvinil',     logo: '🟡',
    prices: { pva: 26, acrilico: 52, latex: 32, esmalte: 44, textura: 38 },
    note: 'Qualidade superior',
  },
  {
    name: 'Sherwin-Williams', logo: '🔴',
    prices: { pva: 34, acrilico: 68, latex: 42, esmalte: 58, textura: 52 },
    note: 'Premium',
  },
  {
    name: 'Hering',      logo: '⚪',
    prices: { pva: 16, acrilico: 34, latex: 22, esmalte: 30, textura: 28 },
    note: 'Econômico',
  },
]

const WASTE = 0.10 // 10% de perda/desperdício

export function PaintCalculatorPage() {
  const [area, setArea] = useState('')
  const [coats, setCoats] = useState(2)
  const [paintType, setPaintType] = useState('acrilico')
  const [surface, setSurface] = useState('liso')
  const [showResult, setShowResult] = useState(false)
  const [primer, setPrimer] = useState(false)

  const paint = PAINT_TYPES.find(p => p.id === paintType)!
  const surf = SURFACE_TYPES.find(s => s.id === surface)!
  const areaNum = parseFloat(area) || 0

  // Cálculo: litros = área × fator_superfície × demãos / (cobertura × (1 - desperdício))
  const litersRaw = areaNum > 0
    ? (areaNum * surf.factor * coats) / (paint.coverage * (1 - WASTE))
    : 0
  // Arredondar para cima para lata comercial
  const litersNeeded = Math.ceil(litersRaw * 2) / 2 // arredonda para 0.5L mais próximo
  const primerLiters = primer ? Math.ceil((areaNum / 8) * 1.1 * 2) / 2 : 0

  function calculate(e: React.FormEvent) {
    e.preventDefault()
    if (areaNum > 0) setShowResult(true)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-2xl bg-brand/10 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Calculadora de Tinta</h1>
              <p className="text-sm text-gray-500">Descubra quanto tinta você precisa comprar</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={calculate} className="space-y-5">

          {/* Área */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <label className="text-sm font-semibold text-gray-700 mb-3 block">
              Área total das paredes (m²)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number" min="1" max="5000" value={area}
                onChange={e => { setArea(e.target.value); setShowResult(false) }}
                placeholder="Ex: 80"
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold text-gray-900 focus:outline-none focus:border-brand bg-gray-50"
                required
              />
              <span className="text-gray-400 font-semibold">m²</span>
            </div>
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <Info className="w-3 h-3 shrink-0" />
              Dica: largura × altura de cada parede. Desconte janelas e portas.
            </p>
          </div>

          {/* Tipo de tinta */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <label className="text-sm font-semibold text-gray-700 mb-3 block">Tipo de tinta</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PAINT_TYPES.map(p => (
                <button key={p.id} type="button"
                  onClick={() => { setPaintType(p.id); setShowResult(false) }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-sm font-medium transition-all cursor-pointer ${
                    paintType === p.id
                      ? 'border-brand bg-orange-50 text-brand'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}>
                  <span>{p.icon}</span>
                  <span className="text-xs leading-tight">{p.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Cobertura: ~{paint.coverage}m²/litro por demão</p>
          </div>

          {/* Superfície + demãos */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <label className="text-sm font-semibold text-gray-700 mb-3 block">Superfície</label>
              <select value={surface} onChange={e => { setSurface(e.target.value); setShowResult(false) }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand bg-white cursor-pointer">
                {SURFACE_TYPES.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <label className="text-sm font-semibold text-gray-700 mb-3 block">Demãos</label>
              <div className="flex gap-2">
                {[1, 2, 3].map(n => (
                  <button key={n} type="button"
                    onClick={() => { setCoats(n); setShowResult(false) }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
                      coats === n ? 'bg-brand text-white border-brand' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}>
                    {n}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Primer */}
          <label className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm cursor-pointer">
            <input type="checkbox" checked={primer} onChange={e => { setPrimer(e.target.checked); setShowResult(false) }}
              className="accent-brand w-5 h-5 rounded" />
            <div>
              <p className="text-sm font-semibold text-gray-800">Incluir primer / selador</p>
              <p className="text-xs text-gray-400">Recomendado para paredes novas ou muito porosas</p>
            </div>
          </label>

          <motion.button type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="w-full py-4 bg-brand text-white font-bold rounded-2xl text-base cursor-pointer hover:bg-brand-dark transition-colors shadow-md shadow-brand/20 flex items-center justify-center gap-2">
            <Calculator className="w-5 h-5" /> Calcular quantidade
          </motion.button>
        </form>

        {/* Resultado */}
        <AnimatePresence>
          {showResult && areaNum > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 space-y-4">

              {/* Resumo */}
              <div className="bg-brand rounded-2xl p-5 text-white">
                <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Resultado</p>
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-black">{litersNeeded.toFixed(1)}</span>
                  <span className="text-xl font-bold mb-1">litros</span>
                </div>
                <p className="text-white/80 text-sm mt-1">
                  de {paint.label.toLowerCase()} para {areaNum}m² · {coats} demão{coats > 1 ? 's' : ''} · superfície {surf.label.toLowerCase()}
                </p>
                {primer && (
                  <p className="text-white/70 text-xs mt-2 border-t border-white/20 pt-2">
                    + {primerLiters.toFixed(1)}L de primer/selador
                  </p>
                )}
              </div>

              {/* Comparativo de marcas */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Paintbrush className="w-4 h-4 text-brand" /> Comparativo de marcas
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">Preços de referência · jun 2026</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {BRANDS.map(brand => {
                    const pricePerLiter = brand.prices[paintType as keyof typeof brand.prices] || brand.prices.pva
                    const totalPaint = litersNeeded * pricePerLiter
                    const totalWithPrimer = primer ? totalPaint + (primerLiters * 12) : totalPaint
                    return (
                      <div key={brand.name} className="px-5 py-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{brand.logo}</span>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{brand.name}</p>
                            <p className="text-xs text-gray-400">{brand.note} · R${pricePerLiter}/L</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-black text-gray-900">{formatCurrency(totalWithPrimer)}</p>
                          <p className="text-xs text-gray-400">{litersNeeded.toFixed(1)}L</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Aviso e CTA */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-700">
                <p className="font-semibold mb-1">📌 Atenção</p>
                <p>Valores de referência. O pintor pode indicar marcas específicas conforme o projeto. Inclui 10% de margem para perdas.</p>
              </div>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                <Link to={`/chat?q=${encodeURIComponent(`Preciso de um pintor para ${areaNum}m²`)}`}
                  className="flex items-center justify-center gap-2 w-full py-4 bg-gray-900 text-white font-bold rounded-2xl text-sm hover:bg-gray-800 transition-colors">
                  Pedir orçamento com pintor verificado <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info footer */}
        <div className="mt-8 text-center text-xs text-gray-400">
          <ChevronDown className="w-4 h-4 mx-auto mb-1 opacity-40" />
          Cálculo baseado nas recomendações técnicas dos fabricantes e ABNT NBR 15079
        </div>
      </div>
    </div>
  )
}
