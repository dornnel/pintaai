import { motion } from 'motion/react'
import { X, Ruler, Info, TrendingUp, AlertCircle } from 'lucide-react'
import { formatCurrency } from '../lib/utils'

interface Lead {
  calc_price_min: number | null
  calc_price_max: number | null
  calc_confidence: string | null
  calc_explanation?: string | null
  area_m2: number | null
  num_rooms: number | null
  service_interest: string | null
}

interface BudgetBreakdownModalProps {
  lead: Lead
  onClose: () => void
}

const CONFIDENCE_LABELS: Record<string, { label: string; pct: number; color: string }> = {
  alta:  { label: 'Alta', pct: 85, color: 'bg-green-500' },
  media: { label: 'Média', pct: 62, color: 'bg-amber-400' },
  baixa: { label: 'Baixa', pct: 33, color: 'bg-red-400' },
}

export function BudgetBreakdownModal({ lead, onClose }: BudgetBreakdownModalProps) {
  const conf = CONFIDENCE_LABELS[lead.calc_confidence || 'baixa'] ?? CONFIDENCE_LABELS.baixa
  const midPrice = lead.calc_price_min && lead.calc_price_max
    ? Math.round((lead.calc_price_min + lead.calc_price_max) / 2)
    : null

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Como a IA calculou</h2>
            <p className="text-xs text-gray-400 mt-0.5">Estimativa do motor de orçamento</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* Price range */}
          <div className="bg-brand/5 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">Faixa estimada</p>
            <p className="text-2xl font-bold text-gray-900">
              {lead.calc_price_min && lead.calc_price_max
                ? `${formatCurrency(lead.calc_price_min)} – ${formatCurrency(lead.calc_price_max)}`
                : '—'}
            </p>
            {midPrice && (
              <p className="text-xs text-brand font-medium mt-1">Média: {formatCurrency(midPrice)}</p>
            )}

            {/* Confidence bar */}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Confiança</span>
                <span className="font-medium">{conf.label} ({conf.pct}%)</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${conf.color} rounded-full transition-all`} style={{ width: `${conf.pct}%` }} />
              </div>
            </div>
          </div>

          {/* Inputs used */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5" /> Dados do projeto
            </p>
            <div className="space-y-2">
              {lead.service_interest && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Serviço</span>
                  <span className="text-gray-900 font-medium">{lead.service_interest}</span>
                </div>
              )}
              {lead.area_m2 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Área estimada</span>
                  <span className="text-gray-900 font-medium">{lead.area_m2} m²</span>
                </div>
              )}
              {lead.num_rooms && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Cômodos</span>
                  <span className="text-gray-900 font-medium">{lead.num_rooms} cômodos (~{Math.round(lead.num_rooms * 13)}m²)</span>
                </div>
              )}
            </div>
          </div>

          {/* AI explanation */}
          {lead.calc_explanation && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> Explicação da IA
              </p>
              <p className="text-sm text-gray-700 bg-blue-50 rounded-xl px-4 py-3 leading-relaxed">
                {lead.calc_explanation}
              </p>
            </div>
          )}

          {/* Market reference */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Referência de mercado (SINDUSCON-SC)
            </p>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Mão de obra / m²', value: 'R$ 18 – R$ 32' },
                { label: 'Com material / m²', value: 'R$ 45 – R$ 80' },
                { label: 'Por hora (ref. sindical)', value: 'R$ 35 – R$ 55/h' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-500">{label}</span>
                  <span className="text-gray-900 font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex gap-2 bg-amber-50 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              Esta é uma estimativa. O valor final é definido pelo pintor após análise presencial do local.
              Pintores geralmente cotam por cômodo — estimamos ~13m² por cômodo em ambientes internos comuns.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
