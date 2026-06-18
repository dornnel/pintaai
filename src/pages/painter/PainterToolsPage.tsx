import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Calculator, Palette, ExternalLink, ChevronRight, TrendingUp, Zap, BarChart2 } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'

const BENCHMARK: Record<string, { m2Labor: [number,number]; m2Full: [number,number]; hourly: [number,number] }> = {
  'Pintura interna':   { m2Labor: [18,32],  m2Full: [45,80],   hourly: [35,55] },
  'Pintura externa':   { m2Labor: [22,40],  m2Full: [50,95],   hourly: [40,65] },
  'Fachada':           { m2Labor: [25,50],  m2Full: [60,110],  hourly: [45,80] },
  'Textura':           { m2Labor: [30,60],  m2Full: [65,120],  hourly: [50,90] },
  'Pós-obra':          { m2Labor: [25,45],  m2Full: [55,100],  hourly: [40,70] },
  'Arte / mural':      { m2Labor: [60,150], m2Full: [80,180],  hourly: [60,120] },
  'Impermeabilização': { m2Labor: [30,65],  m2Full: [70,130],  hourly: [50,85] },
}

const COMPLEXITY: Record<string, number> = {
  'Parede boa / repintura simples': 1.0,
  'Pequenas manchas': 1.1,
  'Furos leves': 1.2,
  'Mofo ou umidade': 1.35,
  'Infiltração / reboco': 1.5,
}

const TOOLS = [
  {
    icon: Calculator,
    label: 'Calculadora de Tinta',
    desc: 'Calcule a quantidade de tinta e estimativa de custo por m². Ideal para fazer orçamentos precisos antes de visitar o cliente.',
    to: '/calculadora',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
  },
  {
    icon: Palette,
    label: 'Visualizador de Cores',
    desc: 'Mostre ao cliente como ficará o ambiente pintado com a cor escolhida. Aumenta a confiança e fechamento de contratos.',
    to: '/visualizar-cor',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-100',
  },
]

export function PainterToolsPage() {
  const [serviceType, setServiceType] = useState<string>('Pintura interna')
  const [area, setArea] = useState<string>('')
  const [withMaterial, setWithMaterial] = useState(false)
  const [complexity, setComplexity] = useState<string>('Parede boa / repintura simples')

  const ref = BENCHMARK[serviceType]
  const mult = COMPLEXITY[complexity] ?? 1
  const areaNum = parseFloat(area) || 0
  const priceBase = withMaterial ? ref.m2Full : ref.m2Labor
  const calcMin = areaNum > 0 ? Math.round(areaNum * priceBase[0] * mult) : null
  const calcMax = areaNum > 0 ? Math.round(areaNum * priceBase[1] * mult) : null

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Ferramentas</h1>
        <p className="text-gray-500 text-sm mt-0.5">Recursos para trabalhar melhor e fechar mais contratos.</p>
      </div>

      {/* ── Pricing Calculator / AI Motor ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-brand" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">Motor de Orçamento IA</h2>
            <p className="text-[11px] text-gray-400">Mesmo motor usado pela plataforma — estimativa interna</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Tipo de serviço</label>
            <select value={serviceType} onChange={e => setServiceType(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand bg-white">
              {Object.keys(BENCHMARK).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Área (m²)</label>
              <input type="number" value={area} onChange={e => setArea(e.target.value)} placeholder="ex: 80"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Condição das paredes</label>
              <select value={complexity} onChange={e => setComplexity(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand bg-white">
                {Object.keys(COMPLEXITY).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={withMaterial} onChange={e => setWithMaterial(e.target.checked)}
              className="w-4 h-4 accent-brand" />
            <span className="text-sm text-gray-700">Incluir material no orçamento</span>
          </label>

          {calcMin && calcMax ? (
            <motion.div key={`${calcMin}-${calcMax}`}
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
              <p className="text-xs text-orange-700 font-medium mb-1">Estimativa calculada</p>
              <p className="text-2xl font-bold text-brand">{formatCurrency(calcMin)} – {formatCurrency(calcMax)}</p>
              <div className="flex flex-wrap gap-x-3 mt-2 text-[11px] text-gray-500">
                <span>{areaNum} m²</span>
                <span>·</span>
                <span>R${priceBase[0]}–{priceBase[1]}/m²</span>
                {mult > 1 && <><span>·</span><span>×{mult} complexidade</span></>}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">Estimativa interna — o valor final é definido por você.</p>
            </motion.div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <BarChart2 className="w-6 h-6 text-gray-300 mx-auto mb-1" />
              <p className="text-xs text-gray-400">Informe a área (m²) para calcular</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Market Reference Table ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
        className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">Referência de Mercado</h2>
            <p className="text-[11px] text-gray-400">Florianópolis — SINDUSCON-SC + fóruns profissionais</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase tracking-wide text-[10px]">
                <th className="text-left pb-2 pr-3 font-medium">Serviço</th>
                <th className="text-right pb-2 pr-3 font-medium whitespace-nowrap">M.O./m²</th>
                <th className="text-right pb-2 pr-3 font-medium whitespace-nowrap">C/ mat./m²</th>
                <th className="text-right pb-2 font-medium whitespace-nowrap">Por hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Object.entries(BENCHMARK).map(([svc, r]) => (
                <tr key={svc} className="hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 pr-3 font-medium text-gray-800">{svc}</td>
                  <td className="py-2.5 pr-3 text-right text-gray-600 whitespace-nowrap">R${r.m2Labor[0]}–{r.m2Labor[1]}</td>
                  <td className="py-2.5 pr-3 text-right text-gray-600 whitespace-nowrap">R${r.m2Full[0]}–{r.m2Full[1]}</td>
                  <td className="py-2.5 text-right text-brand font-medium whitespace-nowrap">R${r.hourly[0]}–{r.hourly[1]}/h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-gray-400 mt-3">Fonte: SINDUSCON-SC + fóruns de pintores profissionais. O pintor define o preço final.</p>
      </motion.div>

      {/* ── External tools ── */}
      <div>
        <h2 className="font-semibold text-gray-900 text-sm mb-3">Ferramentas Externas</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {TOOLS.map(({ icon: Icon, label, desc, to, color, bg, border }, i) => (
            <motion.div key={label}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
              <Link to={to} target="_blank" rel="noopener noreferrer"
                className={`flex flex-col gap-4 bg-white border ${border} rounded-2xl p-5 hover:shadow-md transition-all group`}>
                <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <p className="font-semibold text-gray-900">{label}</p>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                </div>
                <div className={`flex items-center gap-1 text-xs font-semibold ${color}`}>
                  Abrir ferramenta <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
