import { Star, Clock, Award, TrendingDown } from 'lucide-react'
import type { Quote } from '../../lib/types'
import { formatCurrency } from '../../lib/utils'
import { cn } from '../../lib/utils'

interface Props {
  quotes: Quote[]
  onSelect?: (quoteId: string) => void
}

const labelConfig = {
  best_value: { icon: Award, label: 'Melhor custo-benefício', color: 'border-brand bg-orange-50' },
  fastest: { icon: Clock, label: 'Mais rápido', color: 'border-blue-400 bg-blue-50' },
  best_rated: { icon: Star, label: 'Melhor avaliado', color: 'border-yellow-400 bg-yellow-50' },
  cheapest: { icon: TrendingDown, label: 'Mais barato', color: 'border-green-400 bg-green-50' },
  premium: { icon: Award, label: 'Premium', color: 'border-purple-400 bg-purple-50' },
  manual: { icon: Award, label: 'Selecionado', color: 'border-gray-300 bg-gray-50' },
}

export function QuoteComparison({ quotes, onSelect }: Props) {
  return (
    <div className="space-y-3 w-full max-w-sm">
      <p className="text-sm font-semibold text-gray-700">Suas 3 propostas:</p>
      {quotes.map((quote) => {
        const cfg = quote.ai_comparison_label ? labelConfig[quote.ai_comparison_label] : labelConfig.manual
        const Icon = cfg.icon
        return (
          <div key={quote.id} className={cn('border-2 rounded-2xl p-4 bg-white', cfg.color)}>
            <div className="flex items-center gap-1.5 mb-2">
              <Icon className="w-3.5 h-3.5 text-brand" />
              <span className="text-xs font-semibold text-brand uppercase tracking-wide">{cfg.label}</span>
            </div>

            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-xl font-bold text-gray-900">{formatCurrency(quote.total_price)}</span>
              <span className="text-xs text-gray-500">
                {quote.material_included ? 'material incluso' : 'sem material'}
              </span>
            </div>

            <div className="text-xs text-gray-600 space-y-0.5">
              <p>⏱ {quote.estimated_duration_days} dia{quote.estimated_duration_days > 1 ? 's' : ''} de execução</p>
              {quote.warranty_days && <p>🛡 {quote.warranty_days} dias de garantia</p>}
              {quote.payment_terms && <p>💳 {quote.payment_terms}</p>}
              {quote.notes && <p className="text-gray-500 italic mt-1">{quote.notes}</p>}
            </div>

            {onSelect && (
              <button
                onClick={() => onSelect(quote.id)}
                className="mt-3 w-full py-2 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand-dark transition-colors"
              >
                Escolher esta proposta
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
