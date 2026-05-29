import { useEffect, useRef, useState, type KeyboardEvent, type ChangeEvent } from 'react'
import { ArrowLeft, RotateCcw, Send, Paperclip, X, Video } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'
import { useChat } from '../../hooks/useChat'

export function ChatInterface() {
  const { messages, loading, sendMessage, reset, currentInputType } = useChat()
  const bottomRef = useRef<HTMLDivElement>(null)
  const initFired = useRef(false)
  const [searchParams] = useSearchParams()
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Inject greeting on first load
  useEffect(() => {
    if (initFired.current) return
    initFired.current = true
    const q = searchParams.get('q')
    setTimeout(() => sendMessage(q ? q : '__init__'), 300)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function handleSend() {
    if (!text.trim() && files.length === 0) return
    sendMessage(text.trim(), files.length > 0 ? files : undefined)
    setText('')
    setFiles([])
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || [])
    setFiles((prev) => [...prev, ...picked].slice(0, 5))
    e.target.value = ''
  }

  function removeFile(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i))
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const dropped = Array.from(e.dataTransfer.files)
    setFiles((prev) => [...prev, ...dropped].slice(0, 5))
  }

  const isMediaStep = currentInputType === 'media'
  const visibleMessages = messages.filter((m) => m.content !== '__init__')

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm">
        <Link to="/" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-sm font-bold shrink-0">
          P
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Pintai Floripa</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <p className="text-xs text-green-500">Online agora</p>
          </div>
        </div>
        <button onClick={reset} className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer" title="Nova conversa">
          <RotateCcw className="w-4 h-4" />
        </button>
      </header>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide"
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {visibleMessages.map((msg) => (
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

      {/* Drag overlay */}
      <AnimatePresence>
        {dragging && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 bg-brand/10 border-4 border-dashed border-brand flex items-center justify-center pointer-events-none">
            <p className="text-brand font-semibold text-lg">Solte os arquivos aqui</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="px-4 pb-4 pt-2 bg-white border-t border-gray-100 shrink-0">
        {/* Media hint when in media step */}
        {isMediaStep && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-xs text-brand bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 mb-2">
            <Video className="w-3.5 h-3.5 shrink-0" />
            <span>Envie fotos ou vídeo de até 1 minuto. Arraste ou use o clipe.</span>
          </motion.div>
        )}

        {/* File previews */}
        {files.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {files.map((f, i) => (
              <div key={i} className="relative group w-14 h-14 rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                {f.type.startsWith('image/') ? (
                  <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <button onClick={() => removeFile(i)}
                  className="absolute top-0.5 right-0.5 w-4 h-4 bg-gray-700/80 text-white rounded-full items-center justify-center hidden group-hover:flex cursor-pointer">
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input box */}
        <div className={`flex items-end gap-2 border rounded-2xl bg-white transition-colors ${dragging ? 'border-brand bg-orange-50' : 'border-gray-200'}`}>
          <button onClick={() => fileRef.current?.click()}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-brand hover:bg-orange-50 transition-colors shrink-0 cursor-pointer"
            title="Enviar foto ou vídeo">
            <Paperclip className="w-4 h-4" />
          </button>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFiles} />

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
            placeholder={isMediaStep ? 'Envie arquivos ou escreva aqui...' : 'Escreva aqui...'}
            rows={1}
            className="flex-1 resize-none outline-none text-sm text-gray-800 placeholder:text-gray-400 bg-transparent py-2.5 max-h-32 leading-relaxed"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />

          <button
            onClick={handleSend}
            disabled={loading || (!text.trim() && files.length === 0)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-brand text-white hover:bg-brand-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-1.5">
          Seus dados são protegidos pela LGPD · Pintai Floripa
        </p>
      </div>
    </div>
  )
}
