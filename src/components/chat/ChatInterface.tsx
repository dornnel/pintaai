import { useEffect, useRef, useState, type KeyboardEvent, type ChangeEvent } from 'react'
import { RotateCcw, Send, Paperclip, X, Video, AlertCircle, ArrowRight, LogIn, Mic, MicOff, Plus, Mail, Loader2, CheckCircle, Camera, StopCircle, AudioLines } from 'lucide-react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'
import { useChat } from '../../hooks/useChat'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { pendingChatFiles } from '../../lib/chatPendingFiles'

// File size limits
const FILE_LIMITS = {
  image: 10 * 1024 * 1024,    // 10 MB
  video: 30 * 1024 * 1024,    // 30 MB
  audio: 10 * 1024 * 1024,    // 10 MB
  document: 5 * 1024 * 1024,  // 5 MB
}
const VIDEO_MAX_SECONDS = 60

function formatRecordTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function checkVideoDuration(file: File): Promise<{ ok: boolean; duration: number }> {
  return new Promise((resolve) => {
    const el = document.createElement('video')
    el.preload = 'metadata'
    const url = URL.createObjectURL(file)
    el.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve({ ok: el.duration <= VIDEO_MAX_SECONDS, duration: Math.round(el.duration) }) }
    el.onerror = () => { URL.revokeObjectURL(url); resolve({ ok: false, duration: 0 }) }
    el.src = url
  })
}

function getSupportedMimeType(kind: 'video' | 'audio'): string {
  const candidates = kind === 'video'
    ? ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  return candidates.find(t => { try { return MediaRecorder.isTypeSupported(t) } catch { return false } }) || ''
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
  const { messages, loading, sendMessage, reset, currentInputType, currentState, collectedData, authGateAction, clearAuthGateAction } = useChat()
  const { user, loading: authLoading } = useAuth()

  // Post-briefing signup state
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [magicLinkLoading, setMagicLinkLoading] = useState(false)
  const [magicLinkError, setMagicLinkError] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [password, setPassword] = useState('')
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupError, setSignupError] = useState('')
  const [signupDone, setSignupDone] = useState(false)

  // Auth gate login form state (mid-flow, before email step)
  const [gateLoginEmail, setGateLoginEmail] = useState('')
  const [gateLoginPassword, setGateLoginPassword] = useState('')
  const [gateLoginLoading, setGateLoginLoading] = useState(false)
  const [gateLoginError, setGateLoginError] = useState('')
  const [gateLoginDone, setGateLoginDone] = useState(false)
  const [gateMagicSent, setGateMagicSent] = useState(false)
  const [gateMagicLoading, setGateMagicLoading] = useState(false)
  const [showGateLogin, setShowGateLogin] = useState(false)

  // Handle authGateAction from useChat
  useEffect(() => {
    if (authGateAction === 'google') {
      handleGoogleSignup()
      clearAuthGateAction()
    }
    if (authGateAction === 'login') {
      setShowGateLogin(true)
      clearAuthGateAction()
    }
  }, [authGateAction]) // eslint-disable-line

  // Reset gate login state when leaving auth_gate
  useEffect(() => {
    if (currentState !== 'auth_gate') {
      setShowGateLogin(false)
      setGateLoginEmail('')
      setGateLoginPassword('')
      setGateLoginError('')
      setGateLoginDone(false)
      setGateMagicSent(false)
    }
  }, [currentState])

  async function handleGateLogin(e: React.FormEvent) {
    e.preventDefault()
    setGateLoginLoading(true)
    setGateLoginError('')
    const { error } = await supabase.auth.signInWithPassword({ email: gateLoginEmail, password: gateLoginPassword })
    if (error) {
      setGateLoginError('Email ou senha incorretos. Tente novamente.')
    } else {
      setGateLoginDone(true)
    }
    setGateLoginLoading(false)
  }

  async function handleGateMagicLink() {
    if (!gateLoginEmail) return
    setGateMagicLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: gateLoginEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?chat=true` },
    })
    if (!error) setGateMagicSent(true)
    setGateMagicLoading(false)
  }

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

  // MediaRecorder — gravar vídeo ou áudio direto no chat
  type RecordMode = 'idle' | 'video' | 'audio'
  const [recordMode, setRecordMode] = useState<RecordMode>('idle')
  const [showRecordMenu, setShowRecordMenu] = useState(false)
  const [recordSecs, setRecordSecs] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null)
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (authLoading) return   // wait for auth before init to avoid role_select flash
    if (initFired.current) return
    initFired.current = true
    // Pick up files staged on the landing page (hero chat file picker)
    const staged = pendingChatFiles.take()
    if (staged.length > 0) setFiles(staged)
    const q = searchParams.get('q')
    setTimeout(() => sendMessage(q ? q : '__init__'), 150)
  }, [authLoading]) // eslint-disable-line react-hooks/exhaustive-deps

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

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || [])
    const valid: File[] = []
    const rejected: string[] = []

    for (const f of picked) {
      const isVideo = f.type.startsWith('video/')
      const isAudio = f.type.startsWith('audio/')
      const limit = isVideo ? FILE_LIMITS.video : isAudio ? FILE_LIMITS.audio : f.type.startsWith('image/') ? FILE_LIMITS.image : FILE_LIMITS.document

      if (f.size > limit) {
        rejected.push(`${f.name} (muito grande)`)
        continue
      }

      if (isVideo) {
        const { ok, duration } = await checkVideoDuration(f)
        if (!ok) {
          rejected.push(`${f.name} (${duration}s — máx ${VIDEO_MAX_SECONDS}s)`)
          continue
        }
      }

      valid.push(f)
    }

    if (rejected.length > 0) {
      setSizeError(`Arquivo rejeitado: ${rejected.join('; ')} — imagens ≤10MB, vídeos ≤30MB e ≤60s, áudio ≤10MB`)
      setTimeout(() => setSizeError(''), 6000)
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

  // ── MediaRecorder: gravar vídeo ou áudio ────────────────────────────────────
  async function startRecording(kind: 'video' | 'audio') {
    setShowRecordMenu(false)
    try {
      // facingMode ideal (advisory) — prefers back camera on mobile, falls back on desktop
      const constraints = kind === 'video'
        ? { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true }
        : { audio: true }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      // Attach camera preview
      if (kind === 'video' && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream
        videoPreviewRef.current.play().catch(() => {})
      }
      const mimeType = getSupportedMimeType(kind)
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const ext = kind === 'video' ? 'webm' : 'webm'
        const type = mimeType || (kind === 'video' ? 'video/webm' : 'audio/webm')
        const blob = new Blob(chunksRef.current, { type })
        const file = new File([blob], `gravacao-${Date.now()}.${ext}`, { type })
        setFiles(prev => [...prev, file].slice(0, 5))
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      mr.start(200)
      mediaRecorderRef.current = mr
      setRecordMode(kind)
      setRecordSecs(0)
      let secs = 0
      recordIntervalRef.current = setInterval(() => {
        secs++
        setRecordSecs(secs)
        if (secs >= VIDEO_MAX_SECONDS) stopRecording()
      }, 1000)
    } catch {
      setSizeError('Não foi possível acessar câmera/microfone. Verifique as permissões.')
      setTimeout(() => setSizeError(''), 4000)
    }
  }

  function stopRecording() {
    if (recordIntervalRef.current) { clearInterval(recordIntervalRef.current); recordIntervalRef.current = null }
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setRecordMode('idle')
    setRecordSecs(0)
  }

  function cancelRecording() {
    if (recordIntervalRef.current) { clearInterval(recordIntervalRef.current); recordIntervalRef.current = null }
    // Stop without saving — clear chunks first
    chunksRef.current = []
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = null
      try { mediaRecorderRef.current.stop() } catch { /* ignore */ }
      mediaRecorderRef.current = null
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setRecordMode('idle')
    setRecordSecs(0)
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

          {/* ── Auth gate — inline login card (before email/phone steps) ── */}
          <AnimatePresence>
            {currentState === 'auth_gate' && !user && showGateLogin && (
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ type: 'spring', damping: 24, stiffness: 260 }}
                className="rounded-2xl overflow-hidden shadow-lg"
                style={{
                  background: 'rgba(255,255,255,0.97)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(99,102,241,0.18)',
                }}
              >
                <div className="px-4 py-3.5 border-b border-indigo-50">
                  <p className="font-semibold text-gray-900 text-sm mb-0.5">Entrar na Pinte Rápido</p>
                  <p className="text-xs text-gray-500">Após login, preencheremos tudo automaticamente.</p>
                </div>

                {gateLoginDone ? (
                  <div className="px-4 py-4 text-center">
                    <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-1.5" />
                    <p className="text-sm font-semibold text-green-700">Login realizado!</p>
                    <p className="text-xs text-gray-500 mt-0.5">Continuando o preenchimento...</p>
                  </div>
                ) : gateMagicSent ? (
                  <div className="px-4 py-4 text-center">
                    <CheckCircle className="w-6 h-6 text-brand mx-auto mb-1.5" />
                    <p className="text-sm font-semibold text-gray-800">Link enviado!</p>
                    <p className="text-xs text-gray-500 mt-0.5">Verifique <strong>{gateLoginEmail}</strong> e clique no link para continuar.</p>
                  </div>
                ) : (
                  <form onSubmit={handleGateLogin} className="px-4 py-3 space-y-2.5">
                    <div>
                      <input
                        type="email" value={gateLoginEmail}
                        onChange={e => setGateLoginEmail(e.target.value)}
                        placeholder="Seu email" required autoFocus
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                    <div>
                      <input
                        type="password" value={gateLoginPassword}
                        onChange={e => setGateLoginPassword(e.target.value)}
                        placeholder="Senha" required minLength={6}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                    {gateLoginError && <p className="text-[11px] text-red-600">{gateLoginError}</p>}
                    <button type="submit" disabled={gateLoginLoading || !gateLoginEmail || !gateLoginPassword}
                      className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 cursor-pointer hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5">
                      {gateLoginLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                      Entrar
                    </button>
                    <div className="flex items-center justify-between pt-0.5">
                      <button type="button" onClick={handleGateMagicLink} disabled={!gateLoginEmail || gateMagicLoading}
                        className="text-[11px] text-gray-400 hover:text-indigo-600 cursor-pointer disabled:opacity-40 flex items-center gap-1">
                        {gateMagicLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                        Enviar link por email
                      </button>
                      <button type="button" onClick={() => setShowGateLogin(false)}
                        className="text-[11px] text-gray-400 hover:text-gray-600 cursor-pointer">
                        ← Voltar
                      </button>
                    </div>
                  </form>
                )}

                <div className="border-t border-gray-100">
                  <button onClick={handleGoogleSignup}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-white hover:bg-gray-50 text-xs font-medium text-gray-600 transition-colors cursor-pointer">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    Continuar com Google
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
            <span>Envie fotos ou vídeo de até 60s / 30MB, ou grave agora com 📷.</span>
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
                ) : f.type.startsWith('audio/') ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-0.5">
                    <AudioLines className="w-5 h-5 text-brand" />
                    <span className="text-[9px] text-gray-500 font-medium">Áudio</span>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-0.5">
                    <Video className="w-5 h-5 text-gray-400" />
                    <span className="text-[9px] text-gray-500 font-medium">Vídeo</span>
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

        {/* Áudio recording bar */}
        <AnimatePresence>
          {recordMode === 'audio' && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-3 py-2.5 mb-2"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="font-mono text-sm text-red-600 font-semibold">{formatRecordTime(recordSecs)}</span>
              <div className="flex-1 h-1 bg-red-200 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 transition-all" style={{ width: `${(recordSecs / VIDEO_MAX_SECONDS) * 100}%` }} />
              </div>
              <span className="text-xs text-gray-400">/{formatRecordTime(VIDEO_MAX_SECONDS)}</span>
              <button onClick={stopRecording}
                className="flex items-center gap-1 text-xs text-red-600 font-semibold hover:text-red-800 cursor-pointer shrink-0">
                <StopCircle className="w-4 h-4" /> Enviar
              </button>
              <button onClick={cancelRecording}
                className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-200 text-gray-500 hover:bg-gray-300 cursor-pointer shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input box */}
        <div className={`flex items-end gap-2 border rounded-2xl bg-white transition-colors ${dragging ? 'border-brand bg-orange-50' : 'border-gray-200'}`}>
          {/* Paperclip — galeria */}
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
            accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.txt"
            multiple
            className="hidden"
            onChange={handleFiles}
          />

          {/* Camera — gravar vídeo ou áudio */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowRecordMenu(v => !v)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-brand hover:bg-orange-50 transition-colors cursor-pointer"
              title="Gravar vídeo ou áudio"
            >
              <Camera className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {showRecordMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute bottom-10 left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-1 z-20 w-44"
                >
                  <button
                    onClick={() => startRecording('video')}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-orange-50 hover:text-brand transition-colors cursor-pointer"
                  >
                    <Video className="w-4 h-4" /> Gravar vídeo
                  </button>
                  <button
                    onClick={() => startRecording('audio')}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-orange-50 hover:text-brand transition-colors cursor-pointer"
                  >
                    <Mic className="w-4 h-4" /> Gravar áudio
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

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

      {/* ── Overlay de gravação de vídeo ──────────────────────────────────────── */}
      <AnimatePresence>
        {recordMode === 'video' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            {/* Camera preview */}
            <video
              ref={videoPreviewRef}
              autoPlay
              muted
              playsInline
              className="flex-1 w-full object-cover"
            />

            {/* Controls bar */}
            <div className="shrink-0 bg-black/90 px-4 py-4 flex items-center gap-3">
              <button
                onClick={cancelRecording}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer shrink-0"
                title="Cancelar"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white font-mono font-semibold">{formatRecordTime(recordSecs)}</span>
                <span className="text-gray-500 text-xs">/ {formatRecordTime(VIDEO_MAX_SECONDS)}</span>
              </div>
              {/* Progress bar */}
              <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 transition-all" style={{ width: `${(recordSecs / VIDEO_MAX_SECONDS) * 100}%` }} />
              </div>
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-xl font-semibold text-sm hover:bg-gray-100 cursor-pointer shrink-0"
              >
                <StopCircle className="w-4 h-4 text-red-500" /> Parar e enviar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
