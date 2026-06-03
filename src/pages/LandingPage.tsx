import { useState, useRef, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, type Variants, useMotionValue, useSpring, useTransform, useScroll } from 'motion/react'
import {
  Send, Paperclip, ArrowRight, CheckCircle, Star, Search,
  MapPin, MessageCircle, Paintbrush, ShieldCheck, ChevronDown, Sparkles, CreditCard,
  Home, Building2, Droplets, ImagePlus, Video, Layers, Wrench, Palette,
  Bot, FileText, UserCheck, BadgeCheck,
} from 'lucide-react'
import { WHATSAPP_URL } from '../lib/constants'
import { useAuth, getRoleHome } from '../lib/auth'
import { useScrollContainer } from '../contexts/scroll'

// ─── Design tokens ────────────────────────────────────────────────────────────
// CTA primary: slate-900 (dark, not orange — makes orange elements pop)
// CTA secondary: emerald-700
// Rounded: lg (8px) — square to reference walls, not bubbly

// ─── Logo — single span, orange underline accent under "ai" ─────────────────
function PintaiLogo({ white = false }: { white?: boolean }) {
  const color = white ? '#fff' : '#0F172A'
  return (
    <div
      className="select-none relative inline-flex items-center"
      style={{
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        fontWeight: 800,
        fontSize: 20,
        letterSpacing: '-0.5px',
        color,
        lineHeight: 1,
      }}
    >
      {/* Full word as one unit */}
      <span>pint</span>
      <span style={{ color: '#E35A1A' }}>ai</span>
      {/* Small orange square accent — like a paint chip */}
      <span
        style={{
          display: 'inline-block',
          width: 5,
          height: 5,
          background: '#E35A1A',
          borderRadius: 1,
          marginLeft: 3,
          marginBottom: 1,
          flexShrink: 0,
        }}
      />
    </div>
  )
}

// ─── Static fallback data (shown while CMS loads, and when DB is empty) ───────
// NOTE: All of these are managed via /admin/cms → edit freely without code deploy

const DEFAULT_CLIENT_REVIEWS = [
  { name: 'Ana Lúcia', location: 'Campeche', avatar: 'AL', rating: 5, text: 'O Carlos chegou sabendo exatamente o que fazer. Nunca vi um pintor tão bem preparado.', active: true },
  { name: 'Renato Machado', location: 'Rio Tavares', avatar: 'RM', rating: 5, text: 'Finalmente entendi o que estava pagando. Briefing claro, serviço pontual.', active: true },
  { name: 'Juliana Koss', location: 'Armação', avatar: 'JK', rating: 5, text: 'Sem aquela sensação de estar sendo enganado no preço. Transparência do início ao fim.', active: true },
  { name: 'Fábio Dutra', location: 'Campeche', avatar: 'FD', rating: 5, text: 'Nunca contratei serviço com tanto histórico. Vi as avaliações reais antes de escolher.', active: true },
  { name: 'Marina Luz', location: 'Pântano do Sul', avatar: 'ML', rating: 5, text: 'A IA me ajudou a descrever o problema que eu nem sabia nomear. Incrível.', active: true },
  { name: 'Carlos Estrela', location: 'Tapera', avatar: 'CE', rating: 4, text: 'Muito mais profissional do que contratar pelo WhatsApp de amigo.', active: true },
]

const DEFAULT_PAINTER_REVIEWS = [
  { name: 'Carlos Mendes', location: 'Campeche', avatar: 'https://images.unsplash.com/photo-1566753323558-f4e0952af115?w=48&q=70', jobs: 87, rating: 4.9, text: 'Chego no cliente sabendo tudo. Perco menos tempo, fecho mais serviços.', active: true },
  { name: 'Roberto Silva', location: 'Rio Tavares', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=48&q=70', jobs: 62, rating: 4.8, text: 'O briefing já me diz o estado da parede antes de eu visitar. Sem surpresa.', active: true },
  { name: 'Marcos Oliveira', location: 'Armação', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=48&q=70', jobs: 43, rating: 4.7, text: 'Os clientes chegam sabendo o que querem. Muito mais fácil fechar.', active: true },
  { name: 'Paulo Andrade', location: 'Tapera', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=48&q=70', jobs: 31, rating: 4.6, text: 'Deixei de depender de indicação. Tenho agenda constante agora.', active: true },
  { name: 'Diego Ramos', location: 'Costeira', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=48&q=70', jobs: 28, rating: 4.8, text: 'Nunca mais tive cliente que não sabia a metragem. Chega com tudo no briefing.', active: true },
]

// ─── Before/after data ───────────────────────────────────────────────────────

// ─── Motion variants ─────────────────────────────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
}

// ─── Hero background (alternating parede1 / parede2) ─────────────────────────

function DesktopVideoBackground({
  videoRef,
  onPaused,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>
  onPaused: () => void
}) {
  const [ended, setEnded] = useState(false)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    let triggered = false
    const check = () => {
      if (!triggered && v.duration && v.currentTime >= v.duration - 0.5) {
        triggered = true
        v.pause()
        setEnded(true)
        onPaused()
      }
    }
    v.addEventListener('timeupdate', check)
    return () => v.removeEventListener('timeupdate', check)
  }, [videoRef, onPaused])

  return (
    <div className="absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute inset-0"
        animate={ended ? { scale: [1, 1.025, 1] } : { scale: 1 }}
        transition={ended ? { duration: 9, ease: 'easeInOut', repeat: Infinity, repeatType: 'loop' } : { duration: 0 }}
      >
        <video
          ref={videoRef}
          src="/pincel_desktop.mp4"
          autoPlay
          muted
          playsInline
          preload="auto"
          className="w-full h-full object-cover"
        />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-white" />
    </div>
  )
}

// ─── Floating glass card ──────────────────────────────────────────────────────

function FloatingCard({ children, className = '', mouseX, mouseY, factorX = 1, factorY = 1, delay = 0 }: {
  children: React.ReactNode; className?: string
  mouseX: ReturnType<typeof useMotionValue<number>>; mouseY: ReturnType<typeof useMotionValue<number>>
  factorX?: number; factorY?: number; delay?: number
}) {
  const x = useSpring(useTransform(mouseX, [-400, 400], [-12 * factorX, 12 * factorX]), { stiffness: 80, damping: 20 })
  const y = useSpring(useTransform(mouseY, [-300, 300], [-8 * factorY, 8 * factorY]), { stiffness: 80, damping: 20 })

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      style={{ x, y, boxShadow: '0 4px 20px rgba(0,0,0,0.10)' }}
      drag
      dragMomentum={false}
      whileDrag={{ scale: 1.06, boxShadow: '0 16px 40px rgba(0,0,0,0.18)', zIndex: 50 }}
      className={`absolute bg-white border border-gray-100 select-none rounded cursor-grab active:cursor-grabbing ${className}`}
    >
      {children}
    </motion.div>
  )
}

// ─── Review marquee ───────────────────────────────────────────────────────────

function ReviewMarquee() {
  return (
    <section className="py-20 bg-gray-950 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 mb-12 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <span className="text-xs font-bold text-brand uppercase tracking-widest">Avaliações verificadas</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 tracking-tight">Clientes e pintores falam</h2>
          <p className="text-gray-400 mt-2 text-sm">Só de serviços concluídos na plataforma. Impossível de falsificar.</p>
        </motion.div>
      </div>
      <div className="relative mb-4">
        <div className="flex gap-4 animate-marquee-left whitespace-nowrap">
          {[...DEFAULT_CLIENT_REVIEWS, ...DEFAULT_CLIENT_REVIEWS].map((r, i) => (
            <div key={i} className="inline-flex flex-col gap-2 bg-white/5 border border-white/10 rounded p-5 min-w-72 max-w-72 whitespace-normal shrink-0 align-top">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-brand flex items-center justify-center text-white text-xs font-bold shrink-0">{r.avatar}</div>
                <div>
                  <p className="text-white text-xs font-semibold leading-none">{r.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{r.location}</p>
                </div>
                <div className="ml-auto flex gap-0.5">{Array.from({ length: r.rating }).map((_, j) => <Star key={j} className="w-3 h-3 text-yellow-400 fill-yellow-400" />)}</div>
              </div>
              <p className="text-gray-300 text-xs leading-relaxed">{r.text}</p>
            </div>
          ))}
        </div>
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-gray-950 to-transparent pointer-events-none z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-gray-950 to-transparent pointer-events-none z-10" />
      </div>
      <div className="relative">
        <div className="flex gap-4 animate-marquee-right whitespace-nowrap">
          {[...DEFAULT_PAINTER_REVIEWS, ...DEFAULT_PAINTER_REVIEWS].map((r, i) => (
            <div key={i} className="inline-flex flex-col gap-2 bg-white/5 border border-white/10 rounded p-5 min-w-80 max-w-80 whitespace-normal shrink-0 align-top">
              <div className="flex items-center gap-2">
                <img src={r.avatar} alt={r.name} className="w-8 h-8 rounded object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold leading-none truncate">{r.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{r.jobs} serviços · {r.location}</p>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  <span className="text-white text-xs font-bold">{r.rating}</span>
                </div>
              </div>
              <p className="text-gray-300 text-xs leading-relaxed">{r.text}</p>
              <span className="text-xs text-brand font-semibold uppercase tracking-wide">Pintor verificado</span>
            </div>
          ))}
        </div>
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-gray-950 to-transparent pointer-events-none z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-gray-950 to-transparent pointer-events-none z-10" />
      </div>
    </section>
  )
}

// ─── Mobile simple landing (Lovable-style) ───────────────────────────────────

const MOBILE_CHIPS = ['Sala', 'Fachada', 'Pós-obra', 'Mural', 'Enviar fotos']

// Placeholder animado: "Quero pintar" + propriedade + local em loop
const PLACEHOLDER_CYCLE = [
  { prop: 'meu escritório', local: 'no Rio Tavares' },
  { prop: 'meu studio', local: 'no Campeche' },
  { prop: 'minha casa', local: 'no Morro das Pedras' },
  { prop: 'meu apartamento', local: 'na Armação' },
  { prop: 'minha sala', local: 'no Pântano do Sul' },
  { prop: 'meu restaurante', local: 'na Costeira' },
  { prop: 'minha loja', local: 'no Rio Tavares' },
  { prop: 'minha fachada', local: 'no Campeche' },
]

const MOBILE_BG_FALLBACK = [
  'radial-gradient(ellipse at 15% 30%, rgba(227,90,26,0.22) 0%, transparent 55%)',
  'radial-gradient(ellipse at 85% 70%, rgba(255,180,100,0.18) 0%, transparent 55%)',
  'radial-gradient(ellipse at 80% 10%, rgba(255,120,60,0.12) 0%, transparent 50%)',
  '#fdf8f5',
].join(', ')

// ─── Video background mobile ──────────────────────────────────────────────────

function MobileVideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ended, setEnded] = useState(false)
  const [error, setError] = useState(false)

  if (error) {
    return <div className="absolute inset-0" style={{ background: MOBILE_BG_FALLBACK }} />
  }

  return (
    <div className="absolute inset-0 overflow-hidden rounded-none">
      {/* Vídeo: toca uma vez, para no último frame */}
      <motion.div
        className="absolute inset-0"
        animate={ended ? { scale: [1, 1.04, 1, 1.04, 1] } : { scale: 1 }}
        transition={
          ended
            ? { duration: 8, ease: 'easeInOut', repeat: Infinity, repeatType: 'loop' }
            : { duration: 0 }
        }
      >
        <video
          ref={videoRef}
          src="/bkg_video_mobile.mp4"
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={() => setEnded(true)}
          onError={() => setError(true)}
          className="w-full h-full object-cover"
        />
      </motion.div>
      {/* Overlay suave para legibilidade do texto */}
      <div className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 60%, rgba(0,0,0,0.04) 100%)' }} />
    </div>
  )
}

function SimpleLanding() {
  const [input, setInput] = useState('')
  const [focused, setFocused] = useState(false)

  // ── Typewriter state ──────────────────────────────────────────────────────
  const [cycleIdx, setCycleIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [phase, setPhase] = useState<'typing' | 'pausing' | 'deleting'>('typing')
  const [typeText, setTypeText] = useState('')

  const fullPhrase = `${PLACEHOLDER_CYCLE[cycleIdx].prop} ${PLACEHOLDER_CYCLE[cycleIdx].local}`

  useEffect(() => {
    if (input || focused) return
    let t: ReturnType<typeof setTimeout>

    if (phase === 'typing') {
      if (charIdx < fullPhrase.length) {
        t = setTimeout(() => {
          setTypeText(fullPhrase.slice(0, charIdx + 1))
          setCharIdx(c => c + 1)
        }, 55)
      } else {
        t = setTimeout(() => setPhase('deleting'), 1800)
      }
    } else if (phase === 'deleting') {
      if (charIdx > 0) {
        t = setTimeout(() => {
          setTypeText(fullPhrase.slice(0, charIdx - 1))
          setCharIdx(c => c - 1)
        }, 28)
      } else {
        setCycleIdx(i => (i + 1) % PLACEHOLDER_CYCLE.length)
        setPhase('typing')
      }
    }
    return () => clearTimeout(t)
  }, [phase, charIdx, fullPhrase, input, focused])

  // Reset typewriter when user clears input
  useEffect(() => {
    if (!input && !focused) {
      setCharIdx(0)
      setTypeText('')
      setPhase('typing')
    }
  }, [input, focused])

  function handleSend(text?: string) {
    const msg = (text || input).trim()
    if (!msg) return
    window.location.href = `/chat?q=${encodeURIComponent(msg)}`
  }

  const showPlaceholder = !input && !focused

  return (
    <div className="h-full flex flex-col items-center justify-center px-5 gap-5">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="text-center"
      >
        <h1 className="font-extrabold leading-tight tracking-tight"
          style={{ fontSize: '2rem' }}>
          <span className="text-gray-900" style={{ textShadow: '0 1px 8px rgba(255,255,255,0.6)' }}>
            O pintor certo<br />para o seu{' '}
          </span>
          <span className="text-white" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>espaço.</span>
        </h1>
        <p className="text-white/85 text-sm mt-2 font-medium" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.25)' }}>
          Descreva o que precisa pintar.
        </p>
      </motion.div>

      {/* Glass input card — avatar e saudação dentro do card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="w-full rounded-3xl p-3.5"
        style={{
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
          border: '1px solid rgba(255,255,255,0.6)',
        }}
      >
        {/* Avatar + saudação dentro do card */}
        <div className="flex items-center gap-2.5 mb-3">
          <img src="/avatar_koke.jpeg" alt="Koke"
            className="w-8 h-8 rounded-full object-cover shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-900 leading-none">Koke</p>
            <p className="text-xs text-gray-500 mt-0.5">Olá! Me conta o que precisa pintar 👋</p>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-emerald-600 font-medium">Online</span>
          </div>
        </div>

        {/* Divisor */}
        <div className="h-px bg-gray-100 mb-3" />

        {/* Input limpo: texto + ícone dinâmico (lupa→seta ao digitar) */}
        <div className="flex items-center gap-2 border border-gray-200 rounded-2xl px-3 py-2.5 mb-3">
          <div className="flex-1 relative">
            {showPlaceholder && (
              <div className="absolute inset-0 flex items-center pointer-events-none select-none overflow-hidden whitespace-nowrap">
                <span className="text-gray-400 text-sm">{'Quero pintar '}</span>
                <span className="text-gray-600 text-sm">{typeText}</span>
                <span className="inline-block w-px h-3.5 bg-brand ml-0.5 shrink-0"
                  style={{ animation: 'blink 1s step-end infinite' }} />
              </div>
            )}
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSend() } }}
              className="w-full bg-transparent text-sm text-gray-800 outline-none"
              style={{ caretColor: '#E35A1A' }}
            />
          </div>
          {/* Ícone dinâmico: lupa quando vazio, seta laranja ao digitar */}
          {input.trim() ? (
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => handleSend()}
              className="w-7 h-7 rounded-lg bg-brand text-white flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </motion.button>
          ) : (
            <Search className="w-4 h-4 text-gray-300 shrink-0" />
          )}
        </div>

        {/* Chips — sem botão de envio separado */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {MOBILE_CHIPS.map(c => (
            <button key={c} onClick={() => handleSend(c)}
              className="shrink-0 text-[11px] px-2.5 py-1 rounded-full bg-gray-900 text-white font-medium whitespace-nowrap cursor-pointer hover:bg-brand transition-colors">
              {c}
            </button>
          ))}
        </div>
      </motion.div>

    </div>
  )
}

// ─── Hero chat widget (desktop only) ─────────────────────────────────────────

const HERO_CHIPS = [
  { icon: Home,       label: 'Pintar sala e quartos' },
  { icon: Building2,  label: 'Fachada externa' },
  { icon: Paintbrush, label: 'Pintura pós-obra' },
  { icon: Droplets,   label: 'Parede com mofo' },
  { icon: Sparkles,   label: 'Mural artístico' },
  { icon: ImagePlus,  label: 'Enviar fotos' },
]

function HeroChat() {
  const [input, setInput] = useState('')

  function handleSend(text?: string) {
    const msg = (text || input).trim()
    if (!msg) return
    window.location.href = `/chat?q=${encodeURIComponent(msg)}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100"
      style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)', minHeight: 560, width: 320 }}
    >
      {/* Agent header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 shrink-0">
        <img src="/avatar_koke.jpeg" alt="Koke"
          className="w-8 h-8 rounded-full object-cover shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-gray-900 leading-none">Koke</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0" />
            <span className="text-[10px] text-emerald-600">Online agora · orçamento grátis</span>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {[1,2,3].map(i => <span key={i} className="w-1 h-1 rounded-full bg-gray-300" />)}
        </div>
      </div>

      {/* Welcome message */}
      <div className="px-3.5 py-3.5 shrink-0">
        <motion.div
          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="bg-orange-50 rounded-2xl rounded-tl-sm px-3.5 py-2.5"
        >
          <p className="text-[13px] text-gray-800 leading-snug">
            Olá! Eu sou o Koke 👋
          </p>
          <p className="text-[13px] text-gray-700 leading-snug mt-1">
            Me conte o que você precisa pintar ou envie <strong>FOTOS</strong> do ambiente.
          </p>
          <p className="text-[13px] text-gray-600 leading-snug mt-1">
            Vou te ajudar a encontrar o pintor certo.
          </p>
        </motion.div>
      </div>

      {/* Service chips grid */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85 }}
        className="flex-1 px-3.5 pb-4 grid grid-cols-2 gap-1.5 content-end"
      >
        {HERO_CHIPS.map(({ icon: Icon, label }) => (
          <motion.button
            key={label}
            whileTap={{ scale: 0.96 }}
            whileHover={{ borderColor: '#E35A1A', color: '#E35A1A' }}
            onClick={() => handleSend(label)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-gray-100 text-left text-[11px] text-gray-600 font-medium transition-colors cursor-pointer"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <Icon className="text-brand shrink-0" style={{ width: 14, height: 14 }} />
            <span className="leading-tight">{label}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Input area */}
      <div className="border-t border-gray-100 px-3 pt-2 pb-2.5 shrink-0">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
          <Paperclip className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ex: quero pintar 2 quartos e a sala"
            className="flex-1 bg-transparent text-xs text-gray-700 placeholder:text-gray-400 outline-none"
          />
          <motion.button
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center text-white disabled:opacity-30 cursor-pointer shrink-0"
          >
            <Send className="w-3 h-3" />
          </motion.button>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-1">🛡️ Grátis · LGPD</p>
      </div>
    </motion.div>
  )
}

// ─── How payment works ────────────────────────────────────────────────────────

function HowPaymentWorks() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const bgY = useTransform(scrollYProgress, [0, 1], ['-8%', '8%'])

  const steps = [
    {
      step: '01', title: 'Pague com total segurança', desc: 'Pix, cartão ou boleto. O valor fica retido — o pintor não recebe nada ainda.',
      icon: (
        <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
          <rect x="4" y="12" width="40" height="26" rx="5" fill="url(#sp1)"/>
          <rect x="4" y="19" width="40" height="5" fill="white" opacity="0.15"/>
          <rect x="10" y="28" width="10" height="3" rx="1.5" fill="white" opacity="0.9"/>
          <rect x="24" y="28" width="6" height="3" rx="1.5" fill="white" opacity="0.5"/>
          <circle cx="38" cy="11" r="7" fill="url(#sp1b)"/>
          <path d="M35 11 L37 13 L41 9" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <defs>
            <linearGradient id="sp1" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#3B82F6"/><stop offset="1" stopColor="#1D4ED8"/></linearGradient>
            <linearGradient id="sp1b" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#10B981"/><stop offset="1" stopColor="#059669"/></linearGradient>
          </defs>
        </svg>
      ),
    },
    {
      step: '02', title: 'Agendamento e execução', desc: 'Agenda direto no chat. O pintor executa e envia fotos de progresso em cada etapa.',
      icon: (
        <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
          <rect x="6" y="8" width="36" height="34" rx="5" fill="url(#sp2)"/>
          <rect x="6" y="16" width="36" height="2.5" fill="white" opacity="0.2"/>
          <rect x="14" y="6" width="3" height="6" rx="1.5" fill="white" opacity="0.8"/>
          <rect x="31" y="6" width="3" height="6" rx="1.5" fill="white" opacity="0.8"/>
          <rect x="12" y="23" width="5" height="5" rx="1.5" fill="white" opacity="0.7"/>
          <rect x="21" y="23" width="5" height="5" rx="1.5" fill="white" opacity="0.5"/>
          <rect x="30" y="23" width="5" height="5" rx="1.5" fill="white" opacity="0.3"/>
          <rect x="12" y="32" width="5" height="5" rx="1.5" fill="white" opacity="0.5"/>
          <rect x="21" y="32" width="5" height="5" rx="1.5" fill="white" opacity="0.8"/>
          <defs>
            <linearGradient id="sp2" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#F97316"/><stop offset="1" stopColor="#E35A1A"/></linearGradient>
          </defs>
        </svg>
      ),
    },
    {
      step: '03', title: 'Liberação por etapas', desc: 'Você aprova cada fase. Só então o valor é desbloqueado. Controle total, do início ao fim.',
      icon: (
        <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
          <circle cx="24" cy="24" r="20" fill="url(#sp3)"/>
          <path d="M14 24 L20 30 L34 18" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="24" cy="24" r="14" stroke="white" strokeWidth="1.5" opacity="0.25"/>
          <defs>
            <linearGradient id="sp3" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#10B981"/><stop offset="1" stopColor="#059669"/></linearGradient>
          </defs>
        </svg>
      ),
    },
  ]

  return (
    <section ref={ref} className="py-24 px-4 relative overflow-hidden text-white"
      style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 60%, #0F172A 100%)' }}>
      {/* Parallax mesh bg */}
      <motion.div className="absolute inset-0 pointer-events-none" style={{ y: bgY }}>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-blue-500/8 rounded-full blur-3xl" />
      </motion.div>

      <div className="max-w-4xl mx-auto relative z-10">
        <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-14">
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Segurança</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold mt-2 tracking-tight">
            Pagamento protegido,<br className="hidden sm:block" /> do início ao fim
          </h2>
          <p className="text-white/50 mt-3 text-sm max-w-md mx-auto leading-relaxed">
            O valor fica retido e só é liberado quando você aprova. Zero risco para o cliente.
          </p>
        </motion.div>

        <motion.div variants={stagger} initial="hidden" whileInView="show"
          viewport={{ once: true, amount: 0.2 }} className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {steps.map(({ step, title, desc, icon }) => (
            <motion.div key={step} variants={fadeUp}
              whileHover={{ y: -4, borderColor: 'rgba(99,102,241,0.4)' }}
              className="border border-white/10 rounded-2xl p-6 transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
              <div className="mb-4">{icon}</div>
              <span className="text-xs font-bold text-white/25 tracking-widest block mb-1">{step}</span>
              <h3 className="font-bold text-white mb-2">{title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center text-xs text-white/25 mt-10">
          Pagamentos via <strong className="text-white/40">Asaas</strong> · autorizado Banco Central · Pix · Cartão · Split automático
        </motion.p>
      </div>
    </section>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function LandingPage() {
  const { user, signOut } = useAuth()
  const heroRef = useRef<HTMLElement>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  // Use the AppShell scroll container so parallax tracks the real scroll
  const scrollContainer = useScrollContainer()
  const { scrollY } = useScroll({ container: scrollContainer ?? undefined })
  // Parallax moves DOWN with scroll (slower than content) — no bottom gap
  const heroBgY = useTransform(scrollY, [0, 800], [0, 80])

  // ── Desktop video scroll-lock ──────────────────────────────────────────────
  const desktopVideoRef = useRef<HTMLVideoElement>(null)
  const [videoPhase, setVideoPhase] = useState<'playing' | 'paused' | 'animating' | 'released'>('playing')
  const lockParallaxY = useMotionValue(0)
  const lockParallaxSpring = useSpring(lockParallaxY, { stiffness: 55, damping: 22 })

  const startScrollAnimation = useCallback(() => {
    const v = desktopVideoRef.current
    if (!v) return
    setVideoPhase('animating')
    lockParallaxY.set(-200)
    v.play()
    const onEnded = () => {
      v.removeEventListener('ended', onEnded)
      setVideoPhase('released')
      requestAnimationFrame(() => window.scrollTo({ top: 280, behavior: 'smooth' }))
    }
    v.addEventListener('ended', onEnded)
  }, [lockParallaxY])

  useEffect(() => {
    if (videoPhase !== 'paused') return
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY <= 0) return
      e.preventDefault()
      startScrollAnimation()
    }
    const onTouchMove = (e: TouchEvent) => { e.preventDefault() }
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchmove', onTouchMove)
    }
  }, [videoPhase, startScrollAnimation])

  // Y parallax: só durante 'animating' usa lockParallaxSpring; todos os outros estados usam heroBgY
  const activeHeroBgY = videoPhase === 'animating' ? lockParallaxSpring : heroBgY
  // ── fim scroll-lock ────────────────────────────────────────────────────────

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = heroRef.current?.getBoundingClientRect()
    if (!rect) return
    mouseX.set(e.clientX - rect.left - rect.width / 2)
    mouseY.set(e.clientY - rect.top - rect.height / 2)
  }, [mouseX, mouseY])

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── Nav ── */}
      <motion.nav initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-white/8">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <PintaiLogo white />
          <div className="flex items-center gap-2">
            {/* WhatsApp — always visible desktop + mobile */}
            <motion.a
              href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="WhatsApp"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-[#25D366]">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span className="hidden sm:block text-sm font-medium">WhatsApp</span>
            </motion.a>
            {user ? (
              <div className="flex items-center gap-2">
                <Link to={getRoleHome(user.role)} className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/10 border border-white/20 hover:bg-white/15 transition-colors">
                  <div className="w-5 h-5 rounded bg-brand flex items-center justify-center text-white text-[10px] font-bold">
                    {user.name?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold text-white hidden sm:block">{user.name?.split(' ')[0]}</span>
                  <ChevronDown className="w-3 h-3 text-white/60" />
                </Link>
                <button onClick={signOut} className="text-xs text-white/40 hover:text-white cursor-pointer">Sair</button>
              </div>
            ) : (
              <>
                <Link to="/login" className="text-sm text-white/60 hover:text-white transition-colors px-3 py-1.5">Entrar</Link>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Link to="/login?tab=register" className="px-4 py-2 border border-white/40 text-white text-sm font-medium rounded hover:bg-white/10 transition-colors">
                    Inscreva-se
                  </Link>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </motion.nav>

      {/* ── Hero mobile: vídeo background (toca 1x → zoom pulse) + SimpleLanding ── */}
      <section className="lg:hidden relative flex flex-col"
        style={{ height: 'calc(100dvh - 136px)', marginTop: 56 }}>
        <MobileVideoBackground />
        <div className="relative z-10 h-full flex flex-col">
          <SimpleLanding />
        </div>
      </section>

      {/* ── Hero desktop (vídeo + título + floating cards + chat widget) ── */}
      <section ref={heroRef} onMouseMove={handleMouseMove}
        className="hidden lg:flex relative min-h-screen items-center pt-14 overflow-hidden bg-white">
        <motion.div className="absolute inset-0" style={{ y: activeHeroBgY }}>
          <DesktopVideoBackground
            videoRef={desktopVideoRef}
            onPaused={() => setVideoPhase('paused')}
          />
        </motion.div>

        {/* Hint: "role para continuar" quando vídeo pausou antes do fim */}
        {videoPhase === 'paused' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 pointer-events-none"
          >
            <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.4, repeat: Infinity }}>
              <ChevronDown className="w-5 h-5 text-white/70" />
            </motion.div>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-white/60">Role para continuar</span>
          </motion.div>
        )}

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-sm border border-white/50 rounded px-3 py-1.5 text-xs text-gray-600 font-semibold mb-8 uppercase tracking-widest">
              <MapPin className="w-3 h-3 text-brand" />
              Florianópolis · Sul da Ilha
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.02] mb-10"
              style={{ color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.12)', letterSpacing: '-0.03em' }}>
              O pintor certo<br />
              para o seu<br />
              <span style={{ color: '#FF7A30', textShadow: 'none' }}>espaço.</span>
            </motion.h1>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48 }}
              className="flex flex-col items-start gap-4">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link to="/chat"
                  className="flex items-center gap-2 px-7 py-4 text-white font-bold rounded-xl transition-colors text-sm tracking-wide"
                  style={{ background: '#25D366' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#1dbd5a')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#25D366')}>
                  Encontrar meu pintor <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </motion.div>
          </div>

          {/* Right: Chat + floating cards — px-16 gives room for outside cards */}
          <div className="relative flex justify-center lg:justify-end items-center px-16 lg:px-20" style={{ minHeight: 580 }}>
            <motion.div initial={{ opacity: 0, y: 32, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.35, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
              <HeroChat />
            </motion.div>

            {/* Floating cards — arrastar para reposicionar */}
            {/* Top-left: abaixo do header do chat (top-16) para não cobrir o avatar */}
            <FloatingCard mouseX={mouseX} mouseY={mouseY} factorX={0.9} factorY={0.6} delay={1.0}
              className="top-16 -left-6 lg:-left-20 p-3 w-48 z-20">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded bg-brand flex items-center justify-center text-white text-xs font-bold shrink-0">JK</div>
                <div>
                  <p className="text-gray-900 text-xs font-semibold leading-none">Juliana K.</p>
                  <p className="text-gray-400 text-[10px]">Armação</p>
                </div>
                <div className="ml-auto flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className="w-2 h-2 text-yellow-400 fill-yellow-400" />)}</div>
              </div>
              <p className="text-gray-500 text-[10px] leading-relaxed">"Sem sensação de estar sendo enganado."</p>
            </FloatingCard>

            {/* Bottom-left */}
            <FloatingCard mouseX={mouseX} mouseY={mouseY} factorX={1.1} factorY={0.8} delay={1.2}
              className="bottom-14 -left-6 lg:-left-20 p-3 w-40 z-20">
              <div className="flex items-center gap-2">
                <img src="https://images.unsplash.com/photo-1566753323558-f4e0952af115?w=32&q=70" alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                <div><p className="text-gray-900 text-xs font-semibold leading-none">Carlos M.</p><p className="text-gray-400 text-[9px]">87 jobs · Campeche</p></div>
              </div>
              <div className="flex items-center gap-1 mt-2">
                <div className="flex gap-px">{[1,2,3,4,5].map(i => <Star key={i} className="w-2 h-2 text-yellow-400 fill-yellow-400" />)}</div>
                <span className="text-gray-900 font-bold text-[10px] ml-0.5">4.9</span>
              </div>
              <div className="flex items-center gap-1 mt-1"><ShieldCheck className="w-2.5 h-2.5 text-brand" /><span className="text-brand text-[9px] font-bold">Verificado</span></div>
            </FloatingCard>

            {/* Top-right — abaixo do header */}
            <FloatingCard mouseX={mouseX} mouseY={mouseY} factorX={-0.8} factorY={1.0} delay={1.4}
              className="top-16 -right-4 lg:-right-12 p-2.5 w-36 z-20">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-orange-100 flex items-center justify-center shrink-0"><Sparkles className="w-3 h-3 text-brand" /></div>
                <div><p className="text-gray-900 text-[10px] font-semibold leading-tight">Briefing por IA</p><p className="text-gray-400 text-[9px]">gerado agora</p></div>
              </div>
            </FloatingCard>

            {/* Bottom-right */}
            <FloatingCard mouseX={mouseX} mouseY={mouseY} factorX={0.6} factorY={-0.9} delay={1.6}
              className="bottom-14 -right-4 lg:-right-12 p-2.5 w-44 z-20">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center shrink-0"><CreditCard className="w-3 h-3 text-emerald-600" /></div>
                <div><p className="text-gray-900 text-[10px] font-semibold leading-tight">Pagamento seguro</p><p className="text-gray-400 text-[9px]">retido até conclusão</p></div>
              </div>
            </FloatingCard>
          </div>
        </div>
        {/* "Como funciona" — centered at section bottom, above white fade */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1">
          <a href="#como-funciona"
            className="flex flex-col items-center gap-1 text-white/40 hover:text-white/65 transition-colors cursor-pointer">
            <span className="text-[9px] font-semibold tracking-[0.2em] uppercase">Como funciona</span>
            <motion.div animate={{ y: [0, 5, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}>
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          </a>
        </motion.div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-white pointer-events-none" />
      </section>

      {/* ── How it works — desktop only ── */}
      <section id="como-funciona" className="hidden lg:block py-28 px-4 relative overflow-hidden" style={{ background: '#FAF8F5' }}>

        {/* Brush stroke background — Pantone 7506 C warm sand, parallax down */}
        <motion.div
          style={{ y: useTransform(scrollY, [400, 2200], [-40, 80]) }}
          className="absolute inset-0 pointer-events-none overflow-hidden"
        >
          <svg viewBox="0 0 1440 500" className="absolute top-0 left-0 w-full h-full" preserveAspectRatio="xMidYMid slice" style={{ opacity: 0.06 }}>
            <path d="M-120,280 Q180,100 500,260 Q780,400 1080,200 Q1280,100 1580,280"
              stroke="#C4A882" strokeWidth="320" fill="none" strokeLinecap="round"/>
          </svg>
        </motion.div>

        {/* Floating benefit pills — parallax at different speeds */}
        {[
          { text: 'Pintores verificados',    Icon: ShieldCheck,  color: 'text-brand',       side: 'left',  top: '8%',   delay: 0.3,  parallax: [0,-45]  as [number,number] },
          { text: 'Briefing gerado por IA',  Icon: Sparkles,     color: 'text-brand',       side: 'right', top: '12%',  delay: 0.45, parallax: [0,-70]  as [number,number] },
          { text: 'Pagamento em escrow',     Icon: CreditCard,   color: 'text-emerald-600', side: 'left',  top: '36%',  delay: 0.55, parallax: [0,-30]  as [number,number] },
          { text: 'Meet virtual incluso',    Icon: Video,        color: 'text-sky-500',     side: 'right', top: '50%',  delay: 0.65, parallax: [0,-55]  as [number,number] },
          { text: 'Propostas transparentes', Icon: CheckCircle,  color: 'text-emerald-500', side: 'left',  bottom: '18%', delay: 0.5, parallax: [0,-35] as [number,number] },
          { text: 'Serviço com registro',    Icon: BadgeCheck,   color: 'text-pink-500',    side: 'right', bottom: '22%', delay: 0.7, parallax: [0,-50] as [number,number] },
        ].map(({ text, Icon, color, side, top, bottom, delay, parallax }) => (
          <motion.div
            key={text}
            style={{
              y: useTransform(scrollY, [400, 2200], [parallax[1] * 0.3, parallax[1] * -0.7]),
              position: 'absolute',
              ...(side === 'left' ? { left: '2%' } : { right: '2%' }),
              ...(top ? { top } : { bottom }),
            }}
            className="pointer-events-none z-10"
            initial={{ opacity: 0, x: side === 'left' ? -24 : 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-2 bg-white/85 backdrop-blur-xl border border-white/80 rounded-full px-3.5 py-2 shadow-md">
              <Icon className={`w-3.5 h-3.5 shrink-0 ${color}`} />
              <span className="text-[11px] font-semibold text-gray-700 whitespace-nowrap">{text}</span>
            </div>
          </motion.div>
        ))}

        <div className="max-w-4xl mx-auto relative">
          {/* Heading with its own parallax speed (moves slower than BG) */}
          <motion.div style={{ y: useTransform(scrollY, [400, 2200], [-10, 30]) }} className="text-center mb-16">
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
              <span className="text-xs font-bold text-brand uppercase tracking-widest">Como funciona</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-3 mb-3" style={{ letterSpacing: '-0.02em' }}>Do problema ao profissional certo</h2>
              <p className="text-gray-400 max-w-sm mx-auto text-sm">Sem achismo. Só o pintor adequado para o seu espaço.</p>
            </motion.div>
          </motion.div>
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }} className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                step: '01', title: 'Descreva no chat',
                desc: 'Envie fotos, vídeos e descreva o espaço em linguagem natural. Sem formulários chatos.',
                color: '#3B82F6', Icon: Send, isNew: false,
              },
              {
                step: '02', title: 'IA gera o briefing',
                desc: 'Metragem estimada, condição das paredes, material sugerido e riscos. Um documento técnico completo.',
                color: '#8B5CF6', Icon: Bot, isNew: false,
              },
              {
                step: '03', title: 'Pintores recebem e avaliam',
                desc: 'Profissionais verificados recebem o briefing e avaliam viabilidade — antes de se deslocar.',
                color: '#F97316', Icon: UserCheck, isNew: false,
              },
              {
                step: '04', title: 'Meet virtual',
                desc: 'Para projetos maiores, o pintor agenda uma videochamada. Alinha expectativas e evita deslocamento desnecessário.',
                color: '#0EA5E9', Icon: Video, isNew: true,
              },
              {
                step: '05', title: 'Proposta detalhada',
                desc: 'Material, mão de obra, prazo e condições de pagamento — tudo em uma proposta comparável e transparente.',
                color: '#10B981', Icon: FileText, isNew: false,
              },
              {
                step: '06', title: 'Serviço com registro',
                desc: 'Com autorização do cliente, o andamento pode ser filmado. Protocolo de qualidade e segurança para todos.',
                color: '#EC4899', Icon: Video, isNew: true,
              },
              {
                step: '07', title: 'Pagamento por etapas',
                desc: 'O valor fica retido e é liberado ao pintor conforme cada etapa é concluída e confirmada. Zero risco.',
                color: '#059669', Icon: BadgeCheck, isNew: false,
              },
            ].map(({ step, title, desc, color, Icon, isNew }) => (
              <motion.div key={step} variants={fadeUp}
                whileHover={{ y: -4, boxShadow: '0 20px 48px rgba(0,0,0,0.08)' }}
                className="relative bg-white rounded-2xl p-6 border border-gray-100/80 flex gap-4 items-start shadow-sm overflow-hidden group transition-all">
                {/* Left color bar — visible on hover for ALL cards */}
                <div className="absolute left-0 top-0 bottom-0 w-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ background: color }} />
                {/* NOVO badge — top right corner */}
                {isNew && (
                  <span className="absolute top-3 right-3 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: color }}>
                    NOVO
                  </span>
                )}
                <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-gray-300 tracking-widest block mb-1">{step}</span>
                  <h3 className="font-bold text-gray-900 text-sm mb-1.5 leading-tight">{title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Service types — desktop only ── */}
      <section className="py-28 px-4 relative overflow-hidden" style={{ background: '#0F172A' }}>

        {/* ── Parallax blobs de fundo — múltiplas camadas de cor ── */}
        <motion.div style={{ y: useTransform(scrollY, [1600, 3800], [-40, 80]) }}
          className="absolute pointer-events-none"
          style2={{ top: '-10%', left: '-5%', width: '55%', height: '70%',
            background: 'radial-gradient(ellipse, rgba(227,90,26,0.18) 0%, transparent 70%)' }}
        />
        <motion.div
          style={{ y: useTransform(scrollY, [1600, 3800], [20, -60] as [number,number]) }}
          className="absolute pointer-events-none"
          style={{ top: '10%', right: '-8%', width: '50%', height: '60%',
            background: 'radial-gradient(ellipse, rgba(99,102,241,0.16) 0%, transparent 70%)' }}
        />
        <motion.div
          style={{ y: useTransform(scrollY, [1600, 3800], [-10, 70] as [number,number]) }}
          className="absolute pointer-events-none"
          style={{ bottom: '-15%', left: '30%', width: '45%', height: '55%',
            background: 'radial-gradient(ellipse, rgba(16,185,129,0.12) 0%, transparent 70%)' }}
        />
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />

        <div className="max-w-5xl mx-auto relative">
          {/* Heading */}
          <motion.div style={{ y: useTransform(scrollY, [1600, 3200], [-8, 32] as [number,number]) }} className="text-center mb-14">
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
              <span className="text-xs font-bold text-brand uppercase tracking-widest">Serviços</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-3"
                style={{ letterSpacing: '-0.02em' }}>Para todo tipo de espaço</h2>
              <p className="text-white/40 mt-2 text-sm">Clique para começar o orçamento gratuito</p>
            </motion.div>
          </motion.div>

          <motion.div variants={stagger} initial="hidden" whileInView="show"
            viewport={{ once: true, amount: 0.1 }} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: 'Residencial',  desc: 'Casas, apartamentos e quartos',   color: '#F97316', Icon: Home,      n: '01' },
              { label: 'Comercial',    desc: 'Lojas, restaurantes, escritórios', color: '#3B82F6', Icon: Building2, n: '02' },
              { label: 'Fachada',      desc: 'Externas, muros, garagens',        color: '#A855F7', Icon: Layers,    n: '03' },
              { label: 'Pós-obra',     desc: 'Reboco novo, acabamento fino',     color: '#E35A1A', Icon: Wrench,    n: '04' },
              { label: 'Arte / Mural', desc: 'Grafite, decoração artística',     color: '#EC4899', Icon: Palette,   n: '05' },
              { label: 'Manutenção',   desc: 'Rachaduras, mofo, manchas',        color: '#10B981', Icon: Droplets,  n: '06' },
            ].map(({ label, desc, color, Icon, n }) => (
              <motion.div key={label} variants={fadeUp}
                whileHover={{ y: -10, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { window.location.href = `/chat?q=${encodeURIComponent(label)}` }}
                className="relative rounded-2xl cursor-pointer group overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(12px)',
                  transition: 'all 0.3s cubic-bezier(0.22,1,0.36,1)',
                }}>
                {/* Hover: full color fill */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-350"
                  style={{ background: `linear-gradient(135deg, ${color}22 0%, ${color}10 100%)` }} />
                {/* Glow border on hover */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-350"
                  style={{ boxShadow: `inset 0 0 0 1px ${color}50` }} />

                <div className="relative p-6">
                  <div className="flex items-start justify-between mb-6">
                    {/* Icon circle */}
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                      style={{ background: `${color}20` }}>
                      <Icon className="w-6 h-6" style={{ color }} />
                    </div>
                    <span className="text-[10px] font-bold tracking-widest"
                      style={{ color: 'rgba(255,255,255,0.2)' }}>{n}</span>
                  </div>
                  <p className="font-bold text-white text-base mb-1.5 leading-tight">{label}</p>
                  <p className="text-xs leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>{desc}</p>
                  <div className="flex items-center gap-1.5 text-xs font-semibold translate-y-1 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200"
                    style={{ color }}>
                    Solicitar orçamento <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Payment / Security — desktop only ── */}
      <HowPaymentWorks />

      {/* ── Reviews marquee ── */}
      <ReviewMarquee />

      {/* ── Painter CTA ── */}
      <section className="py-16 px-4 border-t border-gray-100 bg-white">
        <div className="max-w-xl mx-auto text-center">
          <ShieldCheck className="w-10 h-10 text-brand mx-auto mb-4" />
          <h2 className="text-xl font-extrabold text-gray-900 mb-2">Sou pintor e quero receber pedidos</h2>
          <p className="text-gray-500 text-sm mb-6">Leads qualificados com briefing técnico, metragem e fotos. Menos visita perdida, mais fechamento.</p>
          <Link to="/login?role=painter"
            className="inline-flex items-center gap-2 px-6 py-3 border-2 border-gray-900 text-gray-900 font-bold rounded hover:bg-gray-900 hover:text-white transition-colors">
            Cadastrar como pintor <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Final CTA — desktop only ── */}
      <section className="py-24 px-4 bg-gray-950">
        <motion.div initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center">
          <div className="inline-block w-12 h-1 bg-brand mb-6" />
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">
            Pronto para encontrar o<br /><span className="text-brand">profissional certo?</span>
          </h2>
          <p className="text-white/40 mb-8">Grátis para clientes. Sem cadastro obrigatório.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link to="/chat"
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-brand text-white font-bold rounded hover:bg-brand-dark transition-colors shadow-xl shadow-brand/20 text-base">
                Encontrar meu pintor <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-6 py-3.5 text-white font-medium rounded border border-white/20 hover:bg-white/10 transition-colors text-base">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ── Footer — desktop only ── */}
      <footer className="bg-gray-950 text-gray-500 py-10 px-4 border-t border-white/6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start justify-between gap-6 mb-6">
          <div>
            <PintaiLogo white />
            <p className="text-sm mt-2">Plataforma de pintura inteligente · Florianópolis</p>
          </div>
          <div className="flex gap-6 text-sm">
            <Link to="/chat" className="hover:text-white transition-colors">Encontrar pintor</Link>
            <Link to="/login?role=painter" className="hover:text-white transition-colors">Sou pintor</Link>
            <Link to="/marketplace" className="hover:text-white transition-colors">Marketplace</Link>
            <Link to="/login" className="hover:text-white transition-colors">Entrar</Link>
          </div>
        </div>
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-white/6">
          <p className="text-xs">© {new Date().getFullYear()} Pintai · Dados protegidos pela LGPD</p>
          <a href="mailto:oi@pintai.com.br" className="text-xs hover:text-white transition-colors">oi@pintai.com.br</a>
        </div>
      </footer>
    </div>
  )
}
