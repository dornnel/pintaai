import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Calculator, Palette, ExternalLink, ChevronRight } from 'lucide-react'

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
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Ferramentas</h1>
        <p className="text-gray-500 text-sm mt-0.5">Recursos para você trabalhar melhor e fechar mais contratos.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {TOOLS.map(({ icon: Icon, label, desc, to, color, bg, border }, i) => (
          <motion.div key={label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
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

      <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5">
        <p className="font-semibold text-gray-900 text-sm mb-2">Em breve</p>
        <div className="space-y-2 text-sm text-gray-400">
          <p>· Gerador de PDF de orçamento com logo (Plano Pro)</p>
          <p>· Cronograma de execução de obra</p>
          <p>· Calculadora de mão de obra + material por tipo de tinta</p>
        </div>
      </div>
    </div>
  )
}
