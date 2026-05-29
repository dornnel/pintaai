import { useState, useRef, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  motion, AnimatePresence, useInView, type Variants,
  useMotionValue, useSpring, useTransform,
} from 'motion/react'
import {
  Send, Paperclip, ArrowRight, CheckCircle, Star, X,
  MapPin, MessageCircle, Paintbrush, Home, Building2,
  Sparkles, TrendingUp, Users, Zap, ShieldCheck, CreditCard, Calendar,
  ChevronDown,
} from 'lucide-react'
import { WHATSAPP_URL } from '../lib/constants'
import { useAuth, getRoleHome } from '../lib/auth'

// ─── Data ────────────────────────────────────────────────────────────────────

const CLIENT_REVIEWS = [
  { name: 'Ana Lúcia', location: 'Campeche', avatar: 'AL', rating: 5, text: 'O Carlos chegou sabendo exatamente o que fazer. Nunca vi um pintor tão bem preparado.' },
  { name: 'Renato Machado', location: 'Rio Tavares', avatar: 'RM', rating: 5, text: 'Finalmente entendi o que estava pagando. Briefing claro, serviço pontual.' },
  { name: 'Juliana Koss', location: 'Armação', avatar: 'JK', rating: 5, text: 'Sem aquela sensação de estar sendo enganado no preço. Transparência do início ao fim.' },
  { name: 'Fábio Dutra', location: 'Campeche', avatar: 'FD', rating: 5, text: 'Nunca contratei serviço com tanto histórico disponível. Vi as avaliações reais do pintor.' },
  { name: 'Marina Luz', location: 'Pântano do Sul', avatar: 'ML', rating: 5, text: 'A IA me ajudou a descrever o problema que eu nem sabia nomear. Incrível.' },
  { name: 'Carlos Estrela', location: 'Tapera', avatar: 'CE', rating: 4, text: 'Muito mais profissional do que contratar pelo WhatsApp de amigo.' },
]

const PAINTER_REVIEWS = [
  { name: 'Carlos Mendes', location: 'Campeche', avatar: 'https://images.unsplash.com/photo-1566753323558-f4e0952af115?w=48&q=70', jobs: 87, rating: 4.9, text: 'Chego no cliente sabendo tudo. Perco menos tempo, fecho mais serviços.' },
  { name: 'Roberto Silva', location: 'Rio Tavares', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=48&q=70', jobs: 62, rating: 4.8, text: 'O briefing já me diz o estado da parede antes de eu visitar. Sem surpresa.' },
  { name: 'Marcos Oliveira', location: 'Armação', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=48&q=70', jobs: 43, rating: 4.7, text: 'Os clientes chegam sabendo o que querem. Muito mais fácil fechar.' },
  { name: 'Paulo Andrade', location: 'Tapera', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=48&q=70', jobs: 31, rating: 4.6, text: 'Deixei de depender de indicação. Tenho agenda constante agora.' },
  { name: 'Diego Ramos', location: 'Costeira', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=48&q=70', jobs: 28, rating: 4.8, text: 'Nunca mais tive cliente que não sabia a metragem. Chega com tudo no briefing.' },
]

const BEFORE_AFTER = [
  { before: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=600&q=80', after: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80', label: 'Sala · Campeche' },
  { before: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600&q=80', after: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80', label: 'Fachada · Rio Tavares' },
  { before: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&q=80', after: 'https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=600&q=80', label: 'Apartamento · Armação' },
]

const SUGGESTIONS = ['Pintar sala e quartos', 'Fachada externa', 'Pintura pós-obra', 'Mural artístico']

const PAIN_POINTS = [
  { text: 'Pintor sem histórico verificado' },
  { text: 'Preço sem nenhuma base técnica' },
  { text: 'Você no escuro sem referência' },
]

// ─── Motion variants ─────────────────────────────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}

// ─── Paint reveal animation ───────────────────────────────────────────────────

function PaintRevealAnimation() {
  const [progress, setProgress] = useState(0)
  const stateRef = useRef<'paused_start' | 'forward' | 'paused_end' | 'backward'>('paused_start')

  useEffect(() => {
    let frame: number
    let val = 0
    let pauseTimer: ReturnType<typeof setTimeout> | null = null

    function tick() {
      if (stateRef.current === 'forward') {
        val = Math.min(1, val + 0.002) // ~8s to reveal
        setProgress(val)
        if (val >= 1) {
          stateRef.current = 'paused_end'
          pauseTimer = setTimeout(() => { stateRef.current = 'backward'; frame = requestAnimationFrame(tick) }, 2500)
          return
        }
      } else if (stateRef.current === 'backward') {
        val = Math.max(0, val - 0.003) // ~5s to go back
        setProgress(val)
        if (val <= 0) {
          stateRef.current = 'paused_start'
          pauseTimer = setTimeout(() => { stateRef.current = 'forward'; frame = requestAnimationFrame(tick) }, 2000)
          return
        }
      }
      frame = requestAnimationFrame(tick)
    }

    // Start after 1.5s pause showing the "before"
    pauseTimer = setTimeout(() => { stateRef.current = 'forward'; frame = requestAnimationFrame(tick) }, 1500)
    return () => {
      if (pauseTimer) clearTimeout(pauseTimer)
      cancelAnimationFrame(frame)
    }
  }, [])

  const clip = `inset(0 ${((1 - progress) * 100).toFixed(1)}% 0 0)`

  return (
    <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl shadow-orange-200/50">
      {/* BEFORE: mesma imagem com filtro de parede velha/mofada */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=900&q=85"
          alt="antes da pintura"
          className="w-full h-full object-cover"
          loading="eager"
          style={{
            filter: 'grayscale(60%) brightness(0.6) contrast(1.15) sepia(30%)',
          }}
        />
        {/* Overlay de mancha/mofo */}
        <div className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 30% 40%, rgba(60,40,10,0.45), transparent), radial-gradient(ellipse 40% 35% at 70% 70%, rgba(30,50,20,0.35), transparent)',
          }}
        />
      </div>

      {/* AFTER: sala pintada nova e limpa, revelada pelo clip */}
      <div
        className="absolute inset-0"
        style={{ clipPath: clip }}
      >
        <img
          src="https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=900&q=85"
          alt="depois da pintura"
          className="w-full h-full object-cover"
          loading="eager"
        />
        {/* Paint roller effect: vertical line at clip edge */}
        <div
          className="absolute top-0 bottom-0 w-1.5 bg-white/80 blur-sm shadow-lg"
          style={{ right: 0 }}
        />
      </div>

      {/* Labels */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-between pointer-events-none">
        <span className="text-xs font-semibold bg-black/50 text-white px-2.5 py-1 rounded-full backdrop-blur-sm">ANTES</span>
        <span
          className="text-xs font-semibold bg-brand text-white px-2.5 py-1 rounded-full"
          style={{ opacity: progress > 0.15 ? 1 : 0, transition: 'opacity 0.3s' }}
        >DEPOIS</span>
      </div>

      {/* Paint roller icon following the reveal line */}
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ left: `${progress * 100}%`, x: '-50%' }}
      >
        <div className="w-10 h-10 bg-white rounded-full shadow-xl flex items-center justify-center border-2 border-brand">
          <Paintbrush className="w-5 h-5 text-brand" />
        </div>
      </motion.div>
    </div>
  )
}

// ─── Floating glass card (light) ──────────────────────────────────────────────

interface FloatingCardProps {
  children: React.ReactNode
  className?: string
  mouseX: ReturnType<typeof useMotionValue<number>>
  mouseY: ReturnType<typeof useMotionValue<number>>
  factorX?: number
  factorY?: number
  delay?: number
}

function FloatingCard({ children, className = '', mouseX, mouseY, factorX = 1, factorY = 1, delay = 0 }: FloatingCardProps) {
  const x = useSpring(useTransform(mouseX, [-400, 400], [-12 * factorX, 12 * factorX]), { stiffness: 80, damping: 20 })
  const y = useSpring(useTransform(mouseY, [-300, 300], [-8 * factorY, 8 * factorY]), { stiffness: 80, damping: 20 })

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      style={{ x, y }}
      className={`absolute bg-white border border-gray-100 rounded-2xl shadow-xl pointer-events-none select-none ${className}`}
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
          <span className="text-xs font-semibold text-brand uppercase tracking-widest">Avaliações reais</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mt-2 tracking-tight">Clientes e pintores falam</h2>
          <p className="text-gray-400 mt-2 text-sm">Verificadas — só de serviços concluídos na plataforma.</p>
        </motion.div>
      </div>

      {/* Row 1: clients */}
      <div className="relative mb-4">
        <div className="flex gap-4 animate-marquee-left whitespace-nowrap">
          {[...CLIENT_REVIEWS, ...CLIENT_REVIEWS].map((r, i) => (
            <div key={i} className="inline-flex flex-col gap-2 bg-white/5 border border-white/10 rounded-2xl p-5 min-w-72 max-w-72 whitespace-normal shrink-0 align-top">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold shrink-0">{r.avatar}</div>
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

      {/* Row 2: painters */}
      <div className="relative">
        <div className="flex gap-4 animate-marquee-right whitespace-nowrap">
          {[...PAINTER_REVIEWS, ...PAINTER_REVIEWS].map((r, i) => (
            <div key={i} className="inline-flex flex-col gap-2 bg-white/5 border border-white/10 rounded-2xl p-5 min-w-80 max-w-80 whitespace-normal shrink-0 align-top">
              <div className="flex items-center gap-2">
                <img src={r.avatar} alt={r.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
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
              <span className="text-xs text-brand font-medium">Pintor verificado</span>
            </div>
          ))}
        </div>
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-gray-950 to-transparent pointer-events-none z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-gray-950 to-transparent pointer-events-none z-10" />
      </div>
    </section>
  )
}

// ─── Before/after card ────────────────────────────────────────────────────────

function BeforeAfterCard({ item, index }: { item: typeof BEFORE_AFTER[0]; index: number }) {
  const [flipped, setFlipped] = useState(false)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.3 })

  return (
    <motion.div ref={ref} variants={fadeUp} initial="hidden" animate={inView ? 'show' : 'hidden'}
      transition={{ delay: index * 0.1 }} className="relative rounded-2xl overflow-hidden cursor-pointer"
      onClick={() => setFlipped(!flipped)} whileHover={{ y: -6 }}>
      <div className="relative h-56 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.img key={flipped ? 'after' : 'before'} src={flipped ? item.after : item.before} alt={item.label}
            className="w-full h-full object-cover" initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.4 }} />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <span className={`absolute top-3 left-3 text-xs font-semibold px-2.5 py-1 rounded-full text-white ${flipped ? 'bg-green-500' : 'bg-gray-500'}`}>
          {flipped ? 'DEPOIS' : 'ANTES'}
        </span>
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <span className="text-white text-sm font-medium">{item.label}</span>
          <span className="text-white/70 text-xs">Toque para ver</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Hero chat widget (light) ─────────────────────────────────────────────────

function HeroChat() {
  const [input, setInput] = useState('')
  const [started, setStarted] = useState(false)

  function handleSend(text?: string) {
    const msg = text || input
    if (!msg.trim()) return
    window.location.href = `/chat?q=${encodeURIComponent(msg)}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-gray-200/80 border border-gray-100 overflow-hidden"
    >
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center shrink-0">
          <Paintbrush className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Pintaê Assistente</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-green-600">Online agora</span>
          </div>
        </div>
        <div className="ml-auto flex gap-1">{[1,2,3].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-200" />)}</div>
      </div>

      <div className="px-5 py-4">
        <div className="flex items-end gap-2 mb-4">
          <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center shrink-0">
            <Paintbrush className="w-3.5 h-3.5 text-white" />
          </div>
          <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.9, duration: 0.4 }}
            className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 max-w-xs">
            <p className="text-sm text-gray-700 leading-relaxed">
              Qual é o seu projeto? Descreva ou escolha — vou encontrar o profissional certo.
            </p>
          </motion.div>
        </div>

        <AnimatePresence>
          {!started && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ delay: 1.1, duration: 0.4 }} className="flex flex-wrap gap-2 mb-4">
              {SUGGESTIONS.map((s) => (
                <motion.button key={s} whileHover={{ scale: 1.04, backgroundColor: '#E35A1A', color: '#fff', borderColor: '#E35A1A' }}
                  whileTap={{ scale: 0.96 }} onClick={() => { setStarted(true); handleSend(s) }}
                  className="text-xs px-3 py-1.5 rounded-full border border-brand/30 text-brand bg-orange-50 transition-colors cursor-pointer">
                  {s}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2">
          <Paperclip className="w-4 h-4 text-gray-400 shrink-0" />
          <input value={input} onChange={e => { setInput(e.target.value); setStarted(true) }}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Descreva o que precisa pintar..."
            className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none" />
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleSend()}
            disabled={!input.trim()} className="w-8 h-8 rounded-xl bg-brand flex items-center justify-center text-white disabled:opacity-30 cursor-pointer">
            <Send className="w-3.5 h-3.5" />
          </motion.button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">Grátis · Sem cadastro obrigatório</p>
      </div>
    </motion.div>
  )
}

// ─── Airbnb-style trust section ───────────────────────────────────────────────

function HowPaymentWorks() {
  return (
    <section className="py-20 px-4 bg-orange-50/50">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
          <span className="text-xs font-semibold text-brand uppercase tracking-widest">Segurança</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2 tracking-tight">Como o pagamento funciona</h2>
          <p className="text-gray-500 mt-2 text-sm max-w-lg mx-auto">Como o Airbnb para hospedagem — o dinheiro fica retido e só é liberado conforme o serviço avança.</p>
        </motion.div>

        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            {
              icon: CreditCard, step: '01', color: 'bg-blue-50 text-blue-500',
              title: 'Você paga com segurança',
              desc: 'Pix, boleto ou cartão. O valor fica retido na plataforma — o pintor não recebe nada ainda.',
            },
            {
              icon: Calendar, step: '02', color: 'bg-orange-50 text-brand',
              title: 'Serviço agendado e executado',
              desc: 'Agenda diretamente no chat. Pintor inicia o serviço e envia fotos de progresso.',
            },
            {
              icon: CheckCircle, step: '03', color: 'bg-green-50 text-green-600',
              title: 'Pagamento liberado por etapas',
              desc: 'Você aprova cada etapa. Só então o valor é liberado ao pintor, menos a comissão da plataforma.',
            },
          ].map(({ icon: Icon, step, color, title, desc }) => (
            <motion.div key={step} variants={fadeUp}
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className={`w-10 h-10 rounded-2xl ${color} flex items-center justify-center mb-4`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-gray-300 tracking-widest">{step}</span>
              <h3 className="font-semibold text-gray-900 mt-1 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="text-center text-xs text-gray-400 mt-8">
          Pagamentos processados via <strong>Asaas</strong> (autorizado Banco Central) · Pix instantâneo · Split automático
        </motion.p>
      </div>
    </section>
  )
}

// ─── Phone mockup wrapper ─────────────────────────────────────────────────────

function PhoneMockup({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto select-none" style={{ width: 280 }}>
      {/* Shadow glow */}
      <div className="absolute -inset-4 rounded-[56px] opacity-20 blur-2xl bg-brand pointer-events-none" />
      {/* Frame */}
      <div className="relative rounded-[44px] overflow-hidden shadow-2xl"
        style={{ border: '10px solid #111', background: '#111' }}>
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 py-2 bg-white" style={{ background: '#fff' }}>
          <span className="text-[10px] font-semibold text-gray-900">9:41</span>
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-4 bg-[#111] rounded-full z-10" />
          <div className="flex items-center gap-1">
            <div className="flex gap-px items-end h-3">
              {[2, 3, 4, 5].map(h => <div key={h} className="w-0.5 bg-gray-900 rounded-sm" style={{ height: `${h * 2}px` }} />)}
            </div>
            <div className="w-4 h-2 border border-gray-900 rounded-sm ml-1 relative">
              <div className="absolute inset-0.5 bg-gray-900 rounded-sm w-3/4" />
            </div>
          </div>
        </div>
        {/* Content — scaled down chat */}
        <div className="overflow-hidden bg-white" style={{ height: 480 }}>
          {children}
        </div>
        {/* Home bar */}
        <div className="bg-white py-2 flex items-center justify-center">
          <div className="w-20 h-1 bg-gray-200 rounded-full" />
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function LandingPage() {
  const { user, signOut } = useAuth()
  const heroRef = useRef<HTMLElement>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = heroRef.current?.getBoundingClientRect()
    if (!rect) return
    mouseX.set(e.clientX - rect.left - rect.width / 2)
    mouseY.set(e.clientY - rect.top - rect.height / 2)
  }, [mouseX, mouseY])

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── Nav ── */}
      <motion.nav
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100"
      >
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-xl font-bold text-brand tracking-tight">Pintaê</span>
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <Link to={getRoleHome(user.role)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors">
                  <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center text-white text-[10px] font-bold">
                    {user.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="text-xs font-semibold text-brand hidden sm:block">{user.name?.split(' ')[0]}</span>
                  <ChevronDown className="w-3 h-3 text-brand" />
                </Link>
                <button onClick={signOut} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">Sair</button>
              </div>
            ) : (
              <>
                <Link to="/login" className="text-sm text-gray-600 hover:text-brand transition-colors px-3 py-1.5">Entrar</Link>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Link to="/chat" className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-dark transition-colors shadow-md shadow-brand/20">
                    Encontrar pintor
                  </Link>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </motion.nav>

      {/* ── Hero (LIGHT) ── */}
      <section
        ref={heroRef}
        onMouseMove={handleMouseMove}
        className="relative min-h-screen flex items-center pt-14 overflow-hidden bg-white"
      >
        {/* Subtle warm radial glow top-right */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(227,90,26,0.08) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(227,90,26,0.05) 0%, transparent 70%)' }} />

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left */}
          <div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-full px-3 py-1.5 text-xs text-brand font-medium mb-8">
              <MapPin className="w-3 h-3" />
              Plataforma especializada em pintura · Florianópolis
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 leading-[1.05] tracking-tight mb-6"
            >
              O pintor certo<br />
              para o seu<br />
              <span className="text-brand">espaço.</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
              className="text-lg text-gray-500 mb-8 leading-relaxed max-w-md">
              Pare de contratar às cegas. IA analisa seu projeto, profissionais verificados respondem.
              Você vê o histórico real — qualidade, pontualidade, o que quem contratou disse.
            </motion.p>

            {/* Pain pills */}
            <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-wrap gap-2 mb-10">
              {PAIN_POINTS.map(({ text }) => (
                <motion.span key={text} variants={fadeUp}
                  className="flex items-center gap-1.5 text-xs text-red-600 px-3 py-1.5 rounded-full bg-red-50 border border-red-200">
                  <X className="w-3 h-3 shrink-0" />{text}
                </motion.span>
              ))}
            </motion.div>

            {/* CTAs */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
              className="flex flex-wrap gap-3 mb-12">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link to="/chat"
                  className="flex items-center gap-2 px-6 py-3.5 bg-brand text-white font-semibold rounded-2xl hover:bg-brand-dark transition-colors shadow-xl shadow-brand/25 text-sm">
                  Encontrar meu pintor <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <a href="#como-funciona"
                  className="flex items-center gap-2 px-6 py-3.5 text-gray-600 font-medium rounded-2xl border border-gray-200 hover:border-brand hover:text-brand transition-colors text-sm">
                  Ver como funciona
                </a>
              </motion.div>
            </motion.div>

            {/* Stats */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
              className="flex flex-wrap gap-8">
              {[
                { value: '200+', label: 'pintores ativos' },
                { value: '1.200+', label: 'serviços concluídos' },
                { value: '4.8★', label: 'avaliação média real' },
              ].map(({ value, label }) => (
                <div key={label}>
                  <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right: phone mockup + floating cards */}
          <div className="relative flex justify-center lg:justify-end items-center" style={{ minHeight: 560 }}>

            {/* Phone with chat inside */}
            <motion.div
              initial={{ opacity: 0, y: 32, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.35, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <PhoneMockup>
                {/* Mini chat inside phone — scaled down */}
                <div className="w-full h-full flex flex-col bg-gray-50" style={{ fontSize: '0.75rem' }}>
                  {/* Chat header */}
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-white border-b border-gray-100">
                    <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center shrink-0">
                      <Paintbrush className="w-3 h-3 text-white" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-gray-900 leading-none">Pintaê Floripa</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="w-1 h-1 bg-green-400 rounded-full animate-pulse" />
                        <span className="text-[9px] text-green-500">Online agora</span>
                      </div>
                    </div>
                  </div>
                  {/* Messages */}
                  <div className="flex-1 px-3 py-3 space-y-2 overflow-hidden">
                    <div className="flex items-end gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-brand shrink-0 flex items-center justify-center">
                        <Paintbrush className="w-2.5 h-2.5 text-white" />
                      </div>
                      <div className="bg-white rounded-xl rounded-bl-sm px-2.5 py-1.5 max-w-[78%] border border-gray-100">
                        <p className="text-[11px] text-gray-700 leading-relaxed">Olá! Para começar, qual é o seu nome?</p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="bg-brand rounded-xl rounded-br-sm px-2.5 py-1.5 max-w-[70%]">
                        <p className="text-[11px] text-white">João da Silva</p>
                      </div>
                    </div>
                    <div className="flex items-end gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-brand shrink-0 flex items-center justify-center">
                        <Paintbrush className="w-2.5 h-2.5 text-white" />
                      </div>
                      <div className="bg-white rounded-xl rounded-bl-sm px-2.5 py-1.5 max-w-[78%] border border-gray-100">
                        <p className="text-[11px] text-gray-700">Em qual **bairro** fica o local?</p>
                      </div>
                    </div>
                    {/* Quick replies */}
                    <div className="flex flex-wrap gap-1 pl-7">
                      {['Campeche', 'Rio Tavares', 'Armação'].map(r => (
                        <span key={r} className="text-[9px] px-2 py-1 rounded-full border border-brand/30 text-brand bg-orange-50">{r}</span>
                      ))}
                    </div>
                    {/* Before/after mini */}
                    <div className="mt-2 rounded-xl overflow-hidden" style={{ height: 80 }}>
                      <PaintRevealAnimation />
                    </div>
                  </div>
                  {/* Input */}
                  <div className="px-3 pb-3 pt-1 bg-white border-t border-gray-100">
                    <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5">
                      <Paperclip className="w-3 h-3 text-gray-400" />
                      <span className="flex-1 text-[10px] text-gray-400">Escreva aqui...</span>
                      <div className="w-5 h-5 rounded-lg bg-brand flex items-center justify-center">
                        <Send className="w-2.5 h-2.5 text-white" />
                      </div>
                    </div>
                  </div>
                </div>
              </PhoneMockup>
            </motion.div>

            {/* Floating cards */}
            <FloatingCard mouseX={mouseX} mouseY={mouseY} factorX={0.9} factorY={0.6} delay={1.0}
              className="top-8 -left-6 lg:-left-16 p-3 w-48 z-20">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold shrink-0">JK</div>
                <div>
                  <p className="text-gray-900 text-xs font-semibold leading-none">Juliana K.</p>
                  <p className="text-gray-400 text-[10px]">Armação</p>
                </div>
                <div className="ml-auto flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className="w-2 h-2 text-yellow-400 fill-yellow-400" />)}</div>
              </div>
              <p className="text-gray-500 text-[10px] leading-relaxed">"Sem sensação de estar sendo enganado."</p>
            </FloatingCard>

            <FloatingCard mouseX={mouseX} mouseY={mouseY} factorX={1.1} factorY={0.8} delay={1.2}
              className="bottom-8 -left-6 lg:-left-16 p-3 w-40 z-20">
              <div className="flex items-center gap-2">
                <img src="https://images.unsplash.com/photo-1566753323558-f4e0952af115?w=32&q=70" alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                <div>
                  <p className="text-gray-900 text-xs font-semibold leading-none">Carlos M.</p>
                  <p className="text-gray-400 text-[9px]">87 jobs · Campeche</p>
                </div>
              </div>
              <div className="flex items-center gap-1 mt-1.5">
                <div className="flex gap-px">{[1,2,3,4,5].map(i => <Star key={i} className="w-2 h-2 text-yellow-400 fill-yellow-400" />)}</div>
                <span className="text-gray-900 font-bold text-[10px] ml-0.5">4.9</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <ShieldCheck className="w-2.5 h-2.5 text-brand" />
                <span className="text-brand text-[9px] font-medium">Verificado</span>
              </div>
            </FloatingCard>

            <FloatingCard mouseX={mouseX} mouseY={mouseY} factorX={-0.8} factorY={1.0} delay={1.4}
              className="top-10 -right-4 lg:-right-8 p-2.5 w-36 z-20">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3 h-3 text-brand" />
                </div>
                <div>
                  <p className="text-gray-900 text-[10px] font-semibold leading-tight">Briefing por IA</p>
                  <p className="text-gray-400 text-[9px]">gerado agora</p>
                </div>
              </div>
            </FloatingCard>

            <FloatingCard mouseX={mouseX} mouseY={mouseY} factorX={0.6} factorY={-0.9} delay={1.6}
              className="bottom-16 -right-4 lg:-right-8 p-2.5 w-40 z-20">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                  <CreditCard className="w-3 h-3 text-green-600" />
                </div>
                <div>
                  <p className="text-gray-900 text-[10px] font-semibold leading-tight">Pagamento seguro</p>
                  <p className="text-gray-400 text-[9px]">retido até conclusão</p>
                </div>
              </div>
            </FloatingCard>
          </div>
        </div>

        {/* Bottom separator */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-100" />
      </section>

      {/* ── Chat widget section ── */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-12">
            <span className="text-xs font-semibold text-brand uppercase tracking-widest">Tudo no chat</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2 tracking-tight">Do briefing ao pagamento</h2>
            <p className="text-gray-500 mt-2 text-sm">Sem formulário longo. Sem telefonema. Sem ir a um escritório.</p>
          </motion.div>
          <div className="flex justify-center">
            <HeroChat />
          </div>
        </div>
      </section>

      {/* ── Payment trust ── */}
      <HowPaymentWorks />

      {/* ── How it works ── */}
      <section id="como-funciona" className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-16">
            <span className="text-xs font-semibold text-brand uppercase tracking-widest">Como funciona</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2 mb-3 tracking-tight">Do problema ao profissional certo</h2>
            <p className="text-gray-500 max-w-md mx-auto text-sm">Sem achismo. Só o pintor adequado para o seu espaço.</p>
          </motion.div>
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              { icon: MessageCircle, step: '01', title: 'Descreva no chat', desc: 'Envie fotos e diga o bairro. A IA entende o projeto sem você saber o nome técnico.' },
              { icon: Sparkles, step: '02', title: 'IA analisa e classifica', desc: 'Metragem, estado da parede, riscos — tudo vira um briefing técnico preciso.' },
              { icon: Users, step: '03', title: 'Match com profissional adequado', desc: 'Não o mais barato. O mais adequado por especialidade, bairro e histórico real.' },
              { icon: CheckCircle, step: '04', title: 'Pague, agende e acompanhe', desc: 'Pagamento retido, agendamento pelo chat, liberação por etapas. Tudo registrado.' },
            ].map(({ icon: Icon, step, title, desc }) => (
              <motion.div key={step} variants={fadeUp} whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.08)' }}
                className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-brand" />
                  </div>
                  <span className="text-xs font-bold text-brand/40 tracking-widest">{step}</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Reviews marquee ── */}
      <ReviewMarquee />

      {/* ── Before / After ── */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-12">
            <span className="text-xs font-semibold text-brand uppercase tracking-widest">Portfólio</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2 tracking-tight">Antes e depois</h2>
            <p className="text-gray-500 mt-2 text-sm">Toque nos cards para ver a transformação</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {BEFORE_AFTER.map((item, i) => <BeforeAfterCard key={item.label} item={item} index={i} />)}
          </div>
        </div>
      </section>

      {/* ── Service types ── */}
      <section className="py-24 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-12">
            <span className="text-xs font-semibold text-brand uppercase tracking-widest">Serviços</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2 tracking-tight">Para todo tipo de espaço</h2>
          </motion.div>
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}
            className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { icon: Home, label: 'Residencial', desc: 'Casas, apartamentos, quartos, salas' },
              { icon: Building2, label: 'Comercial', desc: 'Lojas, restaurantes, escritórios' },
              { icon: Paintbrush, label: 'Fachada', desc: 'Externas, muros, garagens' },
              { icon: Zap, label: 'Pós-obra', desc: 'Reboco novo, acabamento fino' },
              { icon: Sparkles, label: 'Arte / Mural', desc: 'Grafite, decoração, fachadas artísticas' },
              { icon: TrendingUp, label: 'Manutenção', desc: 'Reparo de rachaduras, mofo, manchas' },
            ].map(({ icon: Icon, label, desc }) => (
              <motion.div key={label} variants={fadeUp} whileHover={{ y: -4, borderColor: '#E35A1A' }}
                onClick={() => { window.location.href = `/chat?q=${encodeURIComponent(label)}` }}
                className="bg-white border border-gray-100 rounded-2xl p-5 cursor-pointer transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-3 group-hover:bg-brand transition-colors">
                  <Icon className="w-5 h-5 text-brand group-hover:text-white transition-colors" />
                </div>
                <p className="font-semibold text-gray-900 text-sm mb-1">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-4 bg-brand">
        <motion.div initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
          transition={{ duration: 0.6 }} className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">Pronto para encontrar o profissional certo?</h2>
          <p className="text-white/70 mb-8">Grátis para clientes. Sem cadastro obrigatório.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link to="/chat" className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-brand font-semibold rounded-2xl hover:bg-gray-50 transition-colors text-base">
                Encontrar meu pintor <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white/10 border border-white/30 text-white font-semibold rounded-2xl hover:bg-white/20 transition-colors text-base">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-950 text-gray-500 py-12 px-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 mb-8">
            <div>
              <p className="text-xl font-bold text-white mb-1">Pintaê</p>
              <p className="text-sm">Plataforma de pintura inteligente · Florianópolis</p>
            </div>
            <div className="flex gap-6 text-sm">
              <Link to="/chat" className="hover:text-white transition-colors">Encontrar pintor</Link>
              <Link to="/login?role=painter" className="hover:text-white transition-colors">Sou pintor</Link>
              <Link to="/marketplace" className="hover:text-white transition-colors">Marketplace</Link>
              <Link to="/login" className="hover:text-white transition-colors">Entrar</Link>
            </div>
          </div>
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs">© {new Date().getFullYear()} Pintaê · Dados protegidos pela LGPD</p>
            <a href="mailto:oi@pintae.com.br" className="text-xs hover:text-white transition-colors">oi@pintae.com.br</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
