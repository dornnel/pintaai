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
        <img
          src="/avatar_koke.jpeg"
          alt="Koke"
          className="w-7 h-7 rounded-full object-cover shrink-0"
        />
      )}

      <div className={cn('max-w-[80%] flex flex-col gap-2', !isAgent && 'items-end')}>
        {/* Text bubble */}
        <div
          className={cn(
            'px-3.5 py-2.5 rounded-2xl text-[13px] leading-snug',
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
              <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                <img
                  src={url}
                  alt=""
                  className="w-20 h-20 rounded-lg object-cover border border-gray-200 hover:opacity-90 transition-opacity"
                />
              </a>
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
                className="px-3 py-1.5 text-sm border border-brand text-brand rounded-full hover:bg-brand hover:text-white transition-colors cursor-pointer"
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

// Renders **bold** and \n line breaks
function renderMarkdown(text: string) {
  return text.split('\n').map((line, lineIdx, arr) => (
    <span key={lineIdx}>
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i}>{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
      {lineIdx < arr.length - 1 && <br />}
    </span>
  ))
}
