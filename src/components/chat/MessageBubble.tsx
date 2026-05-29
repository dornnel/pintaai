import { cn, formatRelativeTime } from '../../lib/utils'
import type { ChatMessage } from '../../lib/types'
import { BriefingSummary } from './BriefingSummary'
import { QuoteComparison } from './QuoteComparison'

interface Props {
  message: ChatMessage
  onQuickReply?: (reply: string) => void
  onQuoteSelect?: (quoteId: string) => void
}

export function MessageBubble({ message, onQuickReply, onQuoteSelect }: Props) {
  const isAgent = message.role === 'agent'

  return (
    <div className={cn('flex items-end gap-2 animate-slide-up', !isAgent && 'flex-row-reverse')}>
      {isAgent && (
        <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center shrink-0 text-white text-xs font-bold">
          P
        </div>
      )}

      <div className={cn('max-w-[80%] flex flex-col gap-2', !isAgent && 'items-end')}>
        {/* Text bubble */}
        <div
          className={cn(
            'px-4 py-3 rounded-2xl text-sm leading-relaxed',
            isAgent
              ? 'bg-white border border-gray-100 shadow-sm rounded-bl-sm text-gray-800'
              : 'bg-brand text-white rounded-br-sm',
          )}
        >
          {renderMarkdown(message.content)}
        </div>

        {/* Uploaded media thumbnails */}
        {message.mediaUrls && message.mediaUrls.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {message.mediaUrls.map((url) => (
              <img key={url} src={url} alt="" className="w-20 h-20 rounded-lg object-cover border border-gray-200" />
            ))}
          </div>
        )}

        {/* Briefing card */}
        {message.briefing && <BriefingSummary briefing={message.briefing} />}

        {/* Quote comparison */}
        {message.quotes && message.quotes.length > 0 && (
          <QuoteComparison quotes={message.quotes} onSelect={onQuoteSelect} />
        )}

        {/* Quick replies */}
        {isAgent && message.quickReplies && message.quickReplies.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {message.quickReplies.map((reply) => (
              <button
                key={reply}
                onClick={() => onQuickReply?.(reply)}
                className="px-3 py-1.5 text-sm border border-brand text-brand rounded-full hover:bg-brand hover:text-white transition-colors"
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        <span className="text-xs text-gray-400 px-1">{formatRelativeTime(message.timestamp)}</span>
      </div>
    </div>
  )
}

function renderMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}
