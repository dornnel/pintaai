import { useEffect, useRef, useState, type KeyboardEvent, type ChangeEvent } from 'react'
import { RotateCcw, Send, Paperclip, X, Video, AlertCircle } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'
import { useChat } from '../../hooks/useChat'

// File size limits
const FILE_LIMITS = {
  image: 10 * 1024 * 1024,    // 10 MB
  video: 50 * 1024 * 1024,    // 50 MB
  document: 5 * 1024 * 1024,  // 5 MB
}

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
  const [sizeError, setSizeError] = useState('')
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
    const valid: File[] = []
    const rejected: string[] = []

    for (const f of picked) {
      const limit = f.type.startsWith('video/')
        ? FILE_LIMITS.video
        : f.type.startsWith('image/')
        ? FILE_LIMITS.image
        : FILE_LIMITS.document

      if (f.size > limit) {
        rejected.push(f.name)
      } else {
        valid.push(f)
      }
    }

    if (rejected.length > 0) {
      const limitLabel = rejected.length === 1 ? 'Arquivo muito grande' : 'Arquivos muito grandes'
      setSizeError(`${limitLabel}: ${rejected.join(', ')} (imagens ≤10MB, vídeos ≤50MB, docs ≤5MB)`)
      setTimeout(() => setSizeError(''), 5000)
    }

    setFiles((prev) => [...prev, ...valid].slice(0, 5))
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
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-transparent">
      {/* Header — Koke identity */}
      <header
        className="shrink-0 border-b border-white/40"
        style={{
          zIndex: 20,
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <div className="flex items-center gap-3 px-4" style={{ height: 52 }}>
          <img src="/avatar_koke.jpeg" alt="Koke"
            className="w-9 h-9 rounded-full object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-none">Koke</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0" />
              <span className="text-xs text-emerald-600">Online agora · orçamento grátis</span>
            </div>
          </div>
          <button
            onClick={reset}
            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer p-1 shrink-0"
            title="Nova conversa"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Messages — justify-end faz mensagens ficarem no fundo (padrão WhatsApp) */}
      <div
        className="flex-1 overflow-y-auto scrollbar-hide"
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="flex flex-col justify-end min-h-full px-4 py-4 gap-4">
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
      <div className="px-4 pb-3 pt-2 border-t border-white/40 shrink-0"
        style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        {/* Suggestion chips */}
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

        {/* Size error */}
        <AnimatePresence>
          {sizeError && (
            <motion.div
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-2"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{sizeError}</span>
            </motion.div>
          )}
        </AnimatePresence>

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
            title="Enviar fotos, vídeo ou arquivo"
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
          🛡️ Grátis · dados protegidos pela LGPD
        </p>
      </div>
    </div>
  )
}
