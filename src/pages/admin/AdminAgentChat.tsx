import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Send, Loader2, Bot, Sparkles, RotateCcw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'

interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: Date
}

const EXAMPLE_QUESTIONS = [
  'Quantos leads novos esta semana?',
  'Quais bairros têm mais pedidos?',
  'Quais serviços são mais solicitados?',
  'Mostre os últimos 5 leads',
  'Qual a taxa de conversão?',
  'Liste as conversas abertas hoje',
]

function renderMarkdown(text: string) {
  // Render **bold**, bullet lists, and line breaks
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g)
    const rendered = parts.map((p, j) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={j}>{p.slice(2, -2)}</strong>
        : <span key={j}>{p}</span>
    )

    const isBullet = line.trimStart().startsWith('- ') || line.trimStart().startsWith('• ')
    if (isBullet) {
      return <li key={i} className="ml-3 list-disc">{rendered}</li>
    }
    return <p key={i} className={line === '' ? 'h-2' : ''}>{rendered}</p>
  })
}

export function AdminAgentChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const historyRef = useRef<{ role: string; content: string }[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function addMessage(role: Message['role'], content: string) {
    const msg: Message = {
      id: `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      role,
      content,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, msg])
    return msg
  }

  async function send(text?: string) {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')

    addMessage('user', msg)
    historyRef.current.push({ role: 'user', content: msg })

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-agent', {
        body: { message: msg, history: historyRef.current.slice(-10) },
      })

      if (error) throw error

      const response = data?.message || 'Não consegui processar.'
      addMessage('agent', response)
      historyRef.current.push({ role: 'assistant', content: response })
    } catch (err) {
      addMessage('agent', `Erro ao consultar o agente: ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function reset() {
    setMessages([])
    historyRef.current = []
    setInput('')
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full max-h-screen bg-gray-50">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-brand flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900">Assistente Operacional</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              <p className="text-xs text-green-500">Online · acesso ao banco de dados</p>
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={reset} className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors" title="Nova conversa">
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
        {/* Empty state */}
        {isEmpty && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="py-8">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-brand" />
              </div>
              <h2 className="font-bold text-gray-900 mb-1">Assistente de Operações</h2>
              <p className="text-sm text-gray-400">Consulte dados em tempo real sobre leads, conversas e métricas.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EXAMPLE_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-left text-sm px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-brand hover:bg-orange-50 transition-colors cursor-pointer text-gray-700"
                >
                  {q}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Message list */}
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('flex items-end gap-2', msg.role === 'user' && 'flex-row-reverse')}
            >
              {msg.role === 'agent' && (
                <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center shrink-0 text-white text-xs font-bold">
                  IA
                </div>
              )}
              <div
                className={cn(
                  'max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
                  msg.role === 'agent'
                    ? 'bg-white border border-gray-100 shadow-sm rounded-bl-sm text-gray-800'
                    : 'bg-brand text-white rounded-br-sm',
                )}
              >
                {msg.role === 'agent' ? (
                  <div className="space-y-0.5">{renderMarkdown(msg.content)}</div>
                ) : (
                  msg.content
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <div className="flex items-end gap-2">
            <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center shrink-0 text-white text-xs font-bold">IA</div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex items-center gap-1.5 text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs">Consultando dados...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-6 pb-6 pt-3 bg-white border-t border-gray-100">
        <div className="flex items-end gap-2 border border-gray-200 rounded-2xl bg-white focus-within:border-brand transition-colors">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
            placeholder="Pergunte sobre leads, conversas, métricas..."
            rows={1}
            className="flex-1 resize-none outline-none text-sm text-gray-800 placeholder:text-gray-400 bg-transparent py-3 px-4 max-h-32 leading-relaxed"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-brand text-white hover:bg-brand-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 mr-1 mb-1 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-300 mt-1.5 text-center">Apenas superadmins têm acesso · dados em tempo real</p>
      </div>
    </div>
  )
}
