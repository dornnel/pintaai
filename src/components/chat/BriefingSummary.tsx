import { AlertTriangle, CheckCircle, MapPin, Ruler, DollarSign } from 'lucide-react'
import type { BriefingData } from '../../lib/types'
import { formatCurrency } from '../../lib/utils'

interface Props {
  briefing: BriefingData
}

const confidenceLabel = { baixa: 'Estimativa baixa', media: 'Estimativa média', alta: 'Estimativa confiável' }
const confidenceColor = { baixa: 'text-orange-500', media: 'text-yellow-600', alta: 'text-green-600' }

export function BriefingSummary({ briefing }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 text-sm shadow-sm w-full max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
        <span className="font-semibold text-gray-800">Briefing técnico gerado</span>
      </div>

      <p className="text-gray-700 mb-3 leading-relaxed">{briefing.resumo_cliente}</p>

      <div className="space-y-2">
        {briefing.metragem_estimada_m2 && (
          <div className="flex items-center gap-2 text-gray-600">
            <Ruler className="w-3.5 h-3.5 text-brand shrink-0" />
            <span>
              ~{briefing.metragem_estimada_m2} m²{' '}
              <span className={`text-xs ${confidenceColor[briefing.confianca_metragem]}`}>
                ({confidenceLabel[briefing.confianca_metragem]})
              </span>
            </span>
          </div>
        )}

        {briefing.preco_min_estimado && briefing.preco_max_estimado && (
          <div className="flex items-center gap-2 text-gray-600">
            <DollarSign className="w-3.5 h-3.5 text-brand shrink-0" />
            <span>
              {formatCurrency(briefing.preco_min_estimado)} – {formatCurrency(briefing.preco_max_estimado)}{' '}
              <span className={`text-xs ${confidenceColor[briefing.confianca_preco]}`}>
                ({confidenceLabel[briefing.confianca_preco]})
              </span>
            </span>
          </div>
        )}

        {briefing.superficies.length > 0 && (
          <div className="flex items-start gap-2 text-gray-600">
            <MapPin className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
            <span>{briefing.superficies.join(', ')}</span>
          </div>
        )}
      </div>

      {briefing.riscos.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <span className="text-xs font-medium text-orange-600">Pontos de atenção</span>
          </div>
          <ul className="text-xs text-gray-500 space-y-1">
            {briefing.riscos.map((risk) => (
              <li key={risk} className="flex items-start gap-1">
                <span className="text-orange-300">•</span>
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3 italic">
        * Estimativas orientativas. Os pintores enviarão propostas com valor final.
      </p>
    </div>
  )
}
