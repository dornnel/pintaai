import { useEffect, useRef, useState, type KeyboardEvent, type ChangeEvent } from 'react'
import { RotateCcw, Send, Paperclip, X, Video, AlertCircle, ArrowRight, LogIn, Mic, MicOff, Plus, Mail, Loader2, CheckCircle } from 'lucide-react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'
import { useChat } from '../../hooks/useChat'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

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

// Declaração de tipo para Web Speech API
type SpeechRecognitionInstance = EventTarget & {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  onresult: ((e: { results: { transcript: string }[][] }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

const SpeechRecognitionAPI =
  (typeof window !== 'undefined' &&
    ((window as unknown as Record<string, unknown>).SpeechRecognition ||
     (window as unknown as Record<string, unknown>).webkitSpeechRecognition)) as (new () => SpeechRecognitionInstance) | undefined

export function ChatInterface() {
  const { messages, loading, sendMessage, reset, currentInputType, currentState, collectedData } = useChat()
  const { user } = useAuth()
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [magicLinkLoading, setMagicLinkLoading] = useState(false)
  const [magicLinkError, setMagicLinkError] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [password, setPassword] = useState('')
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupError, setSignupError] = useState('')
  const [signupDone, setSignupDone] = useState(false)

  async function sendMagicLink() {
    const email = collectedData.email
    if (!email) return
    setMagicLinkLoading(true)
    setMagicLinkError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?onboarding=true`,
        data: { name: collectedData.name || '', role: 'customer' },
      },
    })
    if (error) {
      setMagicLinkError('Erro ao enviar link. Tente novamente.')
      console.error('[MagicLink]', error)
    } else {
      setMagicLinkSent(true)
    }
    setMagicLinkLoading(false)
  }

  async function handleGoogleSignup() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?onboarding=true`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) console.error('[Google]', error)
  }

  async function handlePasswordSignup(e: React.FormEvent) {
    e.preventDefault()
    const email = collectedData.email
    if (!email || password.length < 6) return
    setSignupLoading(true)
    setSignupError('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?onboarding=true`,
        data: { name: collectedData.name || '', role: 'customer' },
      },
    })
    if (error) {
      setSignupError(error.message.includes('already registered')
        ? 'Este email já tem conta. Faça login.'
        : 'Erro ao criar conta. Tente novamente.')
    } else {
      setSignupDone(true)
    }
    setSignupLoading(false)
  }
  const bottomRef = useRef<HTMLDivElement>(null)
  const initFired = useRef(false)
  const [searchParams] = useSearchParams()
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [sizeError, setSizeError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const hasSpeechAPI = Boolean(SpeechRecognitionAPI)

  useEffect(() => {
    if (initFired.current) return
    initFired.current = true
    const q = searchParams.get('q')
    setTimeout(() => sendMessage(q ? q : '__init__'), 300)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Só rola para baixo quando há mensagens reais visíveis (não no __init__ vazio)
  useEffect(() => {
    const hasVisible = messages.some(m => m.content !== '__init__')
    if (hasVisible || loading) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
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

  function toggleVoice() {
    if (!SpeechRecognitionAPI) return
    if (isRecording) {
      recognitionRef.current?.stop()
      setIsRecording(false)
      return
    }
    const sr = new SpeechRecognitionAPI()
    sr.lang = 'pt-BR'
    sr.interimResults = true
    sr.continuous = false
    sr.onresult = (e) => {
      const transcript = e.results[e.results.length - 1][0].transcript
      setText(transcript)
    }
    sr.onend = () => setIsRecording(false)
    sr.onerror = () => setIsRecording(false)
    recognitionRef.current = sr
    sr.start()
    setIsRecording(true)
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
        <div className="flex items-center gap-2.5 px-3.5" style={{ height: 44 }}>
          <img src="/avatar_koke.jpeg" alt="Koke"
            className="w-8 h-8 rounded-full object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-900 leading-none">Koke</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0" />
              <span className="text-[10px] text-emerald-600">Online agora · orçamento grátis</span>
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

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto scrollbar-hide"
        style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {/* Empty state — coerente com a home, como se o card tivesse expandido */}
        {visibleMessages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full px-5 gap-5">
            <div className="w-full rounded-3xl p-4 max-w-md"
              style={{
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.07)',
                border: '1px solid rgba(255,255,255,0.7)',
              }}>
              {/* Mini header Koke */}
              <div className="flex items-center gap-2.5 mb-3">
                <img src="/avatar_koke.jpeg" alt="Koke" className="w-9 h-9 rounded-full object-cover shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-900">Koke</p>
                  <p className="text-xs text-gray-500">Para continuarmos, me diz o seu nome por favor! 😊</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] text-emerald-600 font-medium">Online</span>
                </div>
              </div>
              <div className="h-px bg-gray-100 mb-3" />
              {/* Chips de contexto */}
              <p className="text-xs text-gray-400 mb-2">Começar por:</p>
              <div className="flex flex-wrap gap-1.5">
                {['Quero um orçamento', 'Quanto custa pintar?', 'Sou pintor', 'Como funciona?'].map(s => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-gray-900 text-white font-medium cursor-pointer hover:bg-brand transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

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

          {/* Post-briefing login CTA */}
          <AnimatePresence>
            {currentState === 'briefing_ready' && (
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ delay: 0.5, type: 'spring', damping: 24, stiffness: 260 }}
                className="rounded-2xl overflow-hidden shadow-lg"
                style={{
                  background: 'rgba(255,255,255,0.95)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(227,90,26,0.18)',
                }}
              >
                <div className="px-4 py-3.5">
                  <p className="font-semibold text-gray-900 text-sm mb-0.5">Acompanhe as propostas dos pintores</p>
                  <p className="text-xs text-gray-500 leading-snug">
                    Crie sua conta grátis para ver quem respondeu, comparar orçamentos e escolher o melhor pintor.
                  </p>
                </div>
                {user?.role === 'customer' ? (
                  <div className="grid grid-cols-2 border-t border-orange-100">
                    <Link to="/minha-area"
                      className="flex items-center justify-center gap-1.5 py-3 bg-brand text-white text-xs font-semibold hover:bg-brand-dark transition-colors">
                      Ver minha área <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <button onClick={reset}
                      className="flex items-center justify-center gap-1.5 py-3 text-brand text-xs font-semibold hover:bg-orange-50 transition-colors border-l border-orange-100 cursor-pointer">
                      <Plus className="w-3.5 h-3.5" /> Nova solicitação
                    </button>
                  </div>
                ) : (
                  <div className="border-t border-orange-100">
                    {signupDone || magicLinkSent ? (
                      <div className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-green-700 text-xs font-semibold mb-1">
                          <CheckCircle className="w-3.5 h-3.5" /> {signupDone ? 'Conta criada!' : 'Link enviado!'}
                        </div>
                        <p className="text-[11px] text-gray-500">
                          {signupDone
                            ? 'Verifique seu email para confirmar a conta e acessar sua área.'
                            : <>Verifique seu email <strong>{collectedData.email}</strong> e clique no link para acessar.</>}
                        </p>
                      </div>
                    ) : showPasswordForm && collectedData.email ? (
                      <div className="px-4 py-3">
                        <form onSubmit={handlePasswordSignup} className="space-y-2">
                          <div>
                            <p className="text-[11px] text-gray-500 mb-1.5">
                              Criando conta para <strong>{collectedData.email}</strong>
                            </p>
                            <input type="password" value={password}
                              onChange={e => setPassword(e.target.value)}
                              placeholder="Crie uma senha (mín. 6 caracteres)"
                              minLength={6} required autoFocus
                              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
                          </div>
                          {signupError && <p className="text-[10px] text-red-600">{signupError}</p>}
                          <button type="submit" disabled={signupLoading || password.length < 6}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-brand text-white text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50 hover:bg-brand-dark transition-colors">
                            {signupLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogIn className="w-3 h-3" />}
                            Criar conta
                          </button>
                        </form>
                        <button onClick={() => setShowPasswordForm(false)}
                          className="w-full text-[11px] text-gray-400 mt-2 hover:text-gray-600 cursor-pointer">
                          ← Voltar
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-0">
                        {/* Google OAuth — primary */}
                        <button onClick={handleGoogleSignup}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors cursor-pointer">
                          <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                          Continuar com Google
                        </button>

                        {collectedData.email && (
                          <>
                            <div className="flex items-center gap-2 px-4">
                              <div className="flex-1 h-px bg-gray-200" />
                              <span className="text-[10px] text-gray-400">ou</span>
                              <div className="flex-1 h-px bg-gray-200" />
                            </div>

                            {/* Password — secondary */}
                            <button onClick={() => setShowPasswordForm(true)}
                              className="w-full flex items-center justify-center gap-1.5 py-2.5 text-brand text-xs font-semibold hover:bg-orange-50 transition-colors cursor-pointer border-t border-orange-50">
                              <LogIn className="w-3 h-3" /> Criar conta com senha
                            </button>

                            {/* Magic link — tertiary */}
                            <button onClick={sendMagicLink} disabled={magicLinkLoading}
                              className="w-full flex items-center justify-center gap-1.5 py-2.5 text-gray-500 text-xs font-medium hover:bg-gray-50 transition-colors cursor-pointer border-t border-gray-100 disabled:opacity-50">
                              {magicLinkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                              Enviar link de acesso por email
                            </button>
                            {magicLinkError && <p className="text-[10px] text-red-600 text-center py-1">{magicLinkError}</p>}
                          </>
                        )}

                        <div className="grid grid-cols-2 border-t border-gray-100">
                          <Link to="/login?redirect=/minha-area"
                            className="flex items-center justify-center gap-1 py-2.5 text-gray-500 text-xs font-medium hover:bg-gray-50 transition-colors">
                            Já tenho conta
                          </Link>
                          <button onClick={reset}
                            className="flex items-center justify-center gap-1 py-2.5 text-gray-500 text-xs font-medium hover:bg-gray-50 transition-colors border-l border-gray-100 cursor-pointer">
                            <Plus className="w-3 h-3" /> Nova solicitação
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

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
      <div className="px-3 pb-2.5 pt-1.5 border-t border-white/40 shrink-0"
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
              className="flex flex-wrap gap-1.5 mb-2"
            >
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="px-2.5 py-1 text-xs border border-brand/30 text-brand rounded-lg bg-orange-50/70 hover:bg-brand hover:text-white transition-colors cursor-pointer font-medium"
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
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-brand hover:bg-orange-50 transition-colors shrink-0 cursor-pointer"
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

          {hasSpeechAPI && (
            <button
              onClick={toggleVoice}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0 cursor-pointer ${
                isRecording
                  ? 'text-red-500 bg-red-50 animate-pulse'
                  : 'text-gray-400 hover:text-brand hover:bg-orange-50'
              }`}
              title={isRecording ? 'Parar gravação' : 'Enviar mensagem por voz'}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

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
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-brand text-white hover:bg-brand-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <p className="text-center text-[10px] text-gray-400 mt-1">
          🛡️ Grátis · LGPD
        </p>
      </div>
    </div>
  )
}
