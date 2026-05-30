import { useEffect, useRef, useState, type KeyboardEvent, type ChangeEvent } from 'react'
import { RotateCcw, Send, Paperclip, X, Video } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'
import { MobileHeader } from '../mobile/MobileHeader'
import { useChat } from '../../hooks/useChat'

const SUGGESTIONS = [
  'Quero um orçamento',
  'Quanto custa pintar?',
  'Quero ser pintor cadastrado',
  'Como funciona o serviço?',
]

export function ChatInterface() {
  const { messages, loading, sendMessage, reset, currentInputType } = useChat()
  const bottomRef = useRef<HTMLDivElement>(null)
  const initFired = useRef(false)
  const [searchParams] = useSearchParams()
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
  const showSuggestions = visibleMessages.length <= 1 && !loading

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header — usa MobileHeader padronizado */}
      <MobileHeader
        showLogo
        title="Pintaê Floripa"
        subtitle="Orçamentos de pintura com IA"
        rightAction={
          <button
            onClick={reset}
            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer p-1"
            title="Nova conversa"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        }
      />

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
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 bg-brand/10 border-4 border-dashed border-brand flex items-center justify-center pointer-events-none"
          >
            <p className="text-brand font-semibold text-lg">Solte os arquivos aqui</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="px-4 pb-3 pt-2 bg-white border-t border-gray-100 shrink-0">
        {/* Suggestion chips — aparecem no estado inicial */}
        <AnimatePresence>
          {showSuggestions && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="flex flex-wrap gap-2 mb-3"
            >
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="px-3.5 py-2 text-sm border border-brand/40 text-brand rounded-full bg-orange-50 hover:bg-brand hover:text-white transition-colors cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Media hint */}
        {isMediaStep && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-xs text-brand bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 mb-2"
          >
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
                <button
                  onClick={() => removeFile(i)}
                  className="absolute top-0.5 right-0.5 w-4 h-4 bg-gray-700/80 text-white rounded-full items-center justify-center hidden group-hover:flex cursor-pointer"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input box */}
        <div className={`flex items-end gap-2 border rounded-2xl bg-white transition-colors ${dragging ? 'border-brand bg-orange-50' : 'border-gray-200'}`}>
          <button
            onClick={() => fileRef.current?.click()}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-brand hover:bg-orange-50 transition-colors shrink-0 cursor-pointer"
            title="Enviar foto, vídeo ou arquivo"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*,application/pdf,.doc,.docx,.txt"
            multiple
            className="hidden"
            onChange={handleFiles}
          />

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
          Seus dados são protegidos pela LGPD · Pintaê Floripa
        </p>
      </div>
    </div>
  )
}
