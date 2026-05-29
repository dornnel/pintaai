import { useEffect, useRef } from 'react'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'
import { ChatInput } from './ChatInput'
import { useChat } from '../../hooks/useChat'
import { AGENT_INTRO } from '../../lib/constants'

export function ChatInterface() {
  const { messages, loading, sendMessage, reset } = useChat()
  const bottomRef = useRef<HTMLDivElement>(null)
  const initFired = useRef(false)
  const [searchParams] = useSearchParams()

  // Inject greeting or pre-filled query on first load
  useEffect(() => {
    if (initFired.current) return
    initFired.current = true
    const q = searchParams.get('q')
    setTimeout(() => sendMessage(q ? q : '__init__'), 400)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
        <Link to="/" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-sm font-bold">
          P
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Pintaê Floripa</p>
          <p className="text-xs text-green-500">Online agora</p>
        </div>
        <button
          onClick={reset}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Nova conversa"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide">
        {messages.length === 0 && !loading && (
          <div className="flex items-end gap-2 animate-slide-up">
            <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center shrink-0 text-white text-xs font-bold">P</div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm max-w-[80%] text-sm text-gray-800 leading-relaxed">
              {AGENT_INTRO.split('**').map((p, i) =>
                i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>
              )}
            </div>
          </div>
        )}

        {messages.filter((m) => m.content !== '__init__').map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onQuickReply={(reply) => sendMessage(reply)}
            onQuoteSelect={(quoteId) => sendMessage(`Quero a proposta ${quoteId}`)}
          />
        ))}

        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 bg-white border-t border-gray-100 shrink-0">
        <ChatInput
          onSend={sendMessage}
          disabled={loading}
          placeholder="Escreva aqui ou envie fotos..."
        />
        <p className="text-center text-xs text-gray-400 mt-2">
          Seus dados são protegidos pela LGPD · Pintaê Floripa
        </p>
      </div>
    </div>
  )
}
