import { useState, useRef, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, type Variants, useMotionValue, useSpring, useTransform, useScroll } from 'motion/react'
import {
  Send, Paperclip, ArrowRight, CheckCircle, Star,
  MapPin, MessageCircle, Paintbrush, ShieldCheck, ChevronDown, Sparkles, CreditCard,
  Home, Building2, Droplets, ImagePlus,
} from 'lucide-react'
import { WHATSAPP_URL } from '../lib/constants'
import { useAuth, getRoleHome } from '../lib/auth'

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

const VALUE_PROPS = [
  { text: 'Pintores com histórico verificado' },
  { text: 'Briefing técnico gerado por IA' },
  { text: 'Propostas comparáveis e transparentes' },
]

// ─── Motion variants ─────────────────────────────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
}

// ─── Hero background (alternating parede1 / parede2) ─────────────────────────

function HeroBackground() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setActive(a => (a + 1) % 2), 5000)
    return () => clearInterval(id)
  }, [])

  const imgs = ['/parede1.png', '/parede2.png']

  return (
    <div className="absolute inset-0 overflow-hidden">
      {imgs.map((src, i) => (
        <motion.div
          key={src}
          className="absolute inset-0"
          animate={{ opacity: active === i ? 1 : 0, scale: active === i ? 1.04 : 1 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          initial={{ opacity: i === 0 ? 1 : 0, scale: 1 }}
        >
          <img src={src} alt="" className="w-full h-full object-cover" />
        </motion.div>
      ))}
      {/* Very light vignette only at edges — keep photo visible */}
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
    <motion.div initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      style={{ x, y, boxShadow: '0 4px 20px rgba(0,0,0,0.10)' }}
      className={`absolute bg-white border border-gray-100 pointer-events-none select-none rounded ${className}`}>
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

// ─── Hero chat widget ─────────────────────────────────────────────────────────

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
      className="h-full flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100"
      style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}
    >
      {/* Agent header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 shrink-0">
        {/* Avatar — substituir src por imagem real do Koke */}
        <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-base"
          style={{ background: 'linear-gradient(135deg, #FF8C42, #E35A1A)' }}>
          K
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 leading-none">Koke</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0" />
            <span className="text-xs text-emerald-600">Online agora · orçamento grátis</span>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {[1,2,3].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-300" />)}
        </div>
      </div>

      {/* Welcome message */}
      <div className="px-4 py-4 shrink-0">
        <motion.div
          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="bg-orange-50 rounded-2xl rounded-tl-sm px-4 py-3"
        >
          <p className="text-sm text-gray-800 leading-relaxed">
            Olá! Eu sou o Koke 👋
          </p>
          <p className="text-sm text-gray-700 leading-relaxed mt-1">
            Me conte o que você precisa pintar ou envie <strong>FOTOS</strong> do ambiente.
          </p>
          <p className="text-sm text-gray-700 leading-relaxed mt-1">
            Vou te ajudar a encontrar o pintor certo.
          </p>
        </motion.div>
      </div>

      {/* Service chips grid */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85 }}
        className="flex-1 overflow-y-auto px-4 pb-3 grid grid-cols-2 gap-2 content-start"
      >
        {HERO_CHIPS.map(({ icon: Icon, label }) => (
          <motion.button
            key={label}
            whileTap={{ scale: 0.96 }}
            whileHover={{ borderColor: '#E35A1A', color: '#E35A1A' }}
            onClick={() => handleSend(label)}
            className="flex items-center gap-2.5 px-3.5 py-3 rounded-2xl bg-white border border-gray-100 text-left text-sm text-gray-700 font-medium transition-colors cursor-pointer"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          >
            <Icon className="w-4.5 h-4.5 text-brand shrink-0" style={{ width: 18, height: 18 }} />
            <span className="leading-tight">{label}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Input area */}
      <div className="border-t border-gray-100 px-3 pt-2.5 pb-2 shrink-0">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
          <Paperclip className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ex: quero pintar 2 quartos e a sala"
            className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none"
          />
          <motion.button
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white disabled:opacity-30 cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </motion.button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-1.5">🛡️ Grátis</p>
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

  // Parallax: hero background moves at 40% scroll speed
  const { scrollY } = useScroll()
  const heroBgY = useTransform(scrollY, [0, 800], [0, -120])

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
            <Link to="/visualizar-cor" className="hidden sm:flex items-center gap-1 text-sm text-white/60 hover:text-white transition-colors px-3 py-1.5">
              <Paintbrush className="w-3.5 h-3.5" /> Simular cor
            </Link>
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
                  <Link to="/login" className="px-4 py-2 border border-white/40 text-white text-sm font-medium rounded hover:bg-white/10 transition-colors">
                    Inscreva-se
                  </Link>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </motion.nav>

      {/* ── Hero mobile: chat fullscreen (sem foto de fundo) ── */}
      <section className="lg:hidden flex flex-col bg-gray-50"
        style={{ height: 'calc(100dvh - 56px)', marginTop: 56 }}>
        <p className="text-xs text-gray-400 font-medium px-4 pt-3 pb-1 shrink-0">
          Seja bem-vindo! 👋
        </p>
        <div className="flex-1 min-h-0 px-3 pb-3">
          <HeroChat />
        </div>
      </section>

      {/* ── Hero desktop (foto + título + floating cards + chat widget) ── */}
      <section ref={heroRef} onMouseMove={handleMouseMove}
        className="hidden lg:flex relative min-h-screen items-center pt-14 overflow-hidden bg-white">
        <motion.div className="absolute inset-0" style={{ y: heroBgY }}>
          <HeroBackground />
        </motion.div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-sm border border-white/50 rounded px-3 py-1.5 text-xs text-gray-600 font-semibold mb-8 uppercase tracking-widest">
              <MapPin className="w-3 h-3 text-brand" />
              Florianópolis · Sul da Ilha
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.04] tracking-tight mb-8"
              style={{ color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.18)' }}>
              O pintor certo<br />
              para o seu<br />
              <span style={{ color: '#FF7A30' }}>espaço.</span>
            </motion.h1>

            <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-wrap gap-2 mb-10">
              {VALUE_PROPS.map(({ text }) => (
                <motion.span key={text} variants={fadeUp}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-semibold"
                  style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}>
                  <CheckCircle className="w-3 h-3 shrink-0" style={{ color: '#4ade80' }} />{text}
                </motion.span>
              ))}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
              className="flex flex-wrap gap-3">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link to="/chat"
                  className="flex items-center gap-2 px-6 py-3.5 bg-brand text-white font-bold rounded hover:bg-brand-dark transition-colors text-sm"
                  style={{ boxShadow: '0 4px 16px rgba(227,90,26,0.4)' }}>
                  Encontrar meu pintor <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <a href="#como-funciona"
                  className="flex items-center gap-2 px-6 py-3.5 font-bold rounded text-sm transition-colors"
                  style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}>
                  Ver como funciona
                </a>
              </motion.div>
            </motion.div>
          </div>

          {/* Right: Chat + floating cards — px-16 gives room for outside cards */}
          <div className="relative flex justify-center lg:justify-end items-center px-16 lg:px-20" style={{ minHeight: 460 }}>
            <motion.div initial={{ opacity: 0, y: 32, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.35, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
              <HeroChat />
            </motion.div>

            {/* Floating cards — positioned OUTSIDE chat widget boundaries */}
            {/* Top-left: above the chat header */}
            <FloatingCard mouseX={mouseX} mouseY={mouseY} factorX={0.9} factorY={0.6} delay={1.0}
              className="top-0 -left-4 lg:-left-16 p-3 w-48 z-20">
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

            {/* Bottom-left: below chat bottom edge, no overlap with input */}
            <FloatingCard mouseX={mouseX} mouseY={mouseY} factorX={1.1} factorY={0.8} delay={1.2}
              className="-bottom-4 -left-4 lg:-left-16 p-3 w-40 z-20">
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

            {/* Top-right: above chat, right side */}
            <FloatingCard mouseX={mouseX} mouseY={mouseY} factorX={-0.8} factorY={1.0} delay={1.4}
              className="top-0 -right-2 lg:-right-8 p-2.5 w-36 z-20">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-orange-100 flex items-center justify-center shrink-0"><Sparkles className="w-3 h-3 text-brand" /></div>
                <div><p className="text-gray-900 text-[10px] font-semibold leading-tight">Briefing por IA</p><p className="text-gray-400 text-[9px]">gerado agora</p></div>
              </div>
            </FloatingCard>

            {/* Bottom-right: below input, right side */}
            <FloatingCard mouseX={mouseX} mouseY={mouseY} factorX={0.6} factorY={-0.9} delay={1.6}
              className="-bottom-4 -right-2 lg:-right-8 p-2.5 w-44 z-20">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center shrink-0"><CreditCard className="w-3 h-3 text-emerald-600" /></div>
                <div><p className="text-gray-900 text-[10px] font-semibold leading-tight">Pagamento seguro</p><p className="text-gray-400 text-[9px]">retido até conclusão</p></div>
              </div>
            </FloatingCard>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-white pointer-events-none" />
      </section>

      {/* ── How it works — amber tint ── */}
      <section id="como-funciona" className="py-24 px-4" style={{ background: '#FFFBF5' }}>
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <span className="text-xs font-bold text-brand uppercase tracking-widest">Como funciona</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-2 mb-3 tracking-tight">Do problema ao profissional certo</h2>
            <p className="text-gray-500 max-w-md mx-auto text-sm">Sem achismo. Só o pintor adequado para o seu espaço.</p>
          </motion.div>
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              {
                step: '01', title: 'Descreva no chat', desc: 'Envie fotos e diga o bairro. A IA entende o projeto.',
                gradient: 'from-blue-500 to-blue-700',
                icon: (
                  <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
                    <rect x="4" y="8" width="40" height="28" rx="4" fill="url(#g1)"/>
                    <rect x="8" y="16" width="14" height="2.5" rx="1.25" fill="white" opacity="0.9"/>
                    <rect x="8" y="21" width="22" height="2.5" rx="1.25" fill="white" opacity="0.6"/>
                    <rect x="8" y="26" width="18" height="2.5" rx="1.25" fill="white" opacity="0.6"/>
                    <path d="M16 36 L22 44 L28 36" fill="url(#g1)"/>
                    <circle cx="36" cy="20" r="6" fill="white" opacity="0.25"/>
                    <path d="M33 20 L35 22 L39 18" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#3B82F6"/><stop offset="1" stopColor="#1D4ED8"/></linearGradient></defs>
                  </svg>
                ),
              },
              {
                step: '02', title: 'IA analisa e classifica', desc: 'Metragem, estado da parede, riscos — tudo vira briefing técnico.',
                gradient: 'from-violet-500 to-purple-700',
                icon: (
                  <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
                    <circle cx="24" cy="24" r="20" fill="url(#g2)"/>
                    <path d="M16 24 Q20 16 24 24 Q28 32 32 24" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8"/>
                    <circle cx="24" cy="24" r="3" fill="white"/>
                    <circle cx="16" cy="24" r="2" fill="white" opacity="0.6"/>
                    <circle cx="32" cy="24" r="2" fill="white" opacity="0.6"/>
                    <path d="M24 10 L25.5 14 L30 14.5 L26.5 17.5 L27.5 22 L24 19.5 L20.5 22 L21.5 17.5 L18 14.5 L22.5 14 Z" fill="white" opacity="0.9"/>
                    <defs><linearGradient id="g2" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#8B5CF6"/><stop offset="1" stopColor="#7C3AED"/></linearGradient></defs>
                  </svg>
                ),
              },
              {
                step: '03', title: 'Match com o profissional', desc: 'Não o mais barato. O mais adequado por especialidade e histórico.',
                gradient: 'from-orange-400 to-brand',
                icon: (
                  <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
                    <circle cx="24" cy="16" r="8" fill="url(#g3)"/>
                    <path d="M8 40 C8 32 14 28 24 28 C34 28 40 32 40 40" fill="url(#g3)" opacity="0.85"/>
                    <circle cx="38" cy="14" r="5" fill="white" opacity="0.25"/>
                    <path d="M36 14 L37.5 15.5 L41 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="10" cy="14" r="5" fill="white" opacity="0.25"/>
                    <path d="M8 14 L9.5 15.5 L13 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <defs><linearGradient id="g3" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#FB923C"/><stop offset="1" stopColor="#E35A1A"/></linearGradient></defs>
                  </svg>
                ),
              },
              {
                step: '04', title: 'Pague, agende e acompanhe', desc: 'Pagamento retido, agendamento no chat, liberação por etapas.',
                gradient: 'from-emerald-400 to-emerald-700',
                icon: (
                  <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
                    <rect x="6" y="10" width="36" height="28" rx="4" fill="url(#g4)"/>
                    <rect x="6" y="16" width="36" height="4" fill="white" opacity="0.2"/>
                    <rect x="12" y="25" width="10" height="2" rx="1" fill="white" opacity="0.8"/>
                    <rect x="12" y="30" width="14" height="2" rx="1" fill="white" opacity="0.5"/>
                    <circle cx="36" cy="28" r="6" fill="white" opacity="0.2"/>
                    <path d="M33 28 L35 30 L39 26" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <defs><linearGradient id="g4" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#34D399"/><stop offset="1" stopColor="#059669"/></linearGradient></defs>
                  </svg>
                ),
              },
            ].map(({ step, title, desc, icon }) => (
              <motion.div key={step} variants={fadeUp} whileHover={{ y: -4, boxShadow: '0 16px 40px rgba(0,0,0,0.1)' }}
                className="bg-white rounded p-6 border border-gray-100 flex gap-5 items-start">
                <div className="shrink-0">{icon}</div>
                <div>
                  <span className="text-xs font-bold text-gray-300 tracking-widest block mb-1">{step}</span>
                  <h3 className="font-bold text-gray-900 mb-1.5">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Service types ── */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-12">
            <span className="text-xs font-bold text-brand uppercase tracking-widest">Serviços</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-2 tracking-tight">Para todo tipo de espaço</h2>
            <p className="text-gray-400 mt-2 text-sm">Clique para começar o orçamento</p>
          </motion.div>
          <motion.div variants={stagger} initial="hidden" whileInView="show"
            viewport={{ once: true, amount: 0.15 }} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              {
                label: 'Residencial', desc: 'Casas, apartamentos, quartos',
                icon: (
                  <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
                    <path d="M24 6 L42 22 L42 42 L6 42 L6 22 Z" fill="url(#sv1)"/>
                    <rect x="18" y="28" width="12" height="14" rx="2" fill="white" opacity="0.9"/>
                    <rect x="28" y="16" width="8" height="8" rx="1.5" fill="white" opacity="0.5"/>
                    <path d="M12 22 L24 11 L36 22" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.4"/>
                    <defs><linearGradient id="sv1" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#F59E0B"/><stop offset="1" stopColor="#D97706"/></linearGradient></defs>
                  </svg>
                ),
              },
              {
                label: 'Comercial', desc: 'Lojas, restaurantes, escritórios',
                icon: (
                  <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
                    <rect x="8" y="10" width="32" height="32" rx="4" fill="url(#sv2)"/>
                    <rect x="14" y="18" width="6" height="8" rx="1" fill="white" opacity="0.9"/>
                    <rect x="24" y="18" width="6" height="8" rx="1" fill="white" opacity="0.6"/>
                    <rect x="14" y="30" width="16" height="2" rx="1" fill="white" opacity="0.4"/>
                    <rect x="8" y="10" width="32" height="5" rx="4" fill="white" opacity="0.15"/>
                    <defs><linearGradient id="sv2" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#3B82F6"/><stop offset="1" stopColor="#1D4ED8"/></linearGradient></defs>
                  </svg>
                ),
              },
              {
                label: 'Fachada', desc: 'Externas, muros, garagens',
                icon: (
                  <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
                    <rect x="4" y="8" width="40" height="32" rx="4" fill="url(#sv3)"/>
                    <rect x="4" y="8" width="40" height="10" rx="4" fill="white" opacity="0.15"/>
                    <rect x="10" y="22" width="28" height="3" rx="1.5" fill="white" opacity="0.7"/>
                    <rect x="10" y="29" width="20" height="3" rx="1.5" fill="white" opacity="0.5"/>
                    <circle cx="36" cy="35" r="6" fill="white" opacity="0.2"/>
                    <path d="M33 35 L35.5 37.5 L39 32" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <defs><linearGradient id="sv3" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#8B5CF6"/><stop offset="1" stopColor="#6D28D9"/></linearGradient></defs>
                  </svg>
                ),
              },
              {
                label: 'Pós-obra', desc: 'Reboco novo, acabamento fino',
                icon: (
                  <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
                    <rect x="6" y="14" width="36" height="26" rx="4" fill="url(#sv4)"/>
                    <path d="M6 20 L42 20" stroke="white" strokeWidth="2" opacity="0.2"/>
                    <rect x="12" y="26" width="8" height="8" rx="2" fill="white" opacity="0.8"/>
                    <rect x="24" y="26" width="12" height="3" rx="1.5" fill="white" opacity="0.5"/>
                    <rect x="24" y="31" width="8" height="3" rx="1.5" fill="white" opacity="0.3"/>
                    <path d="M28 8 L32 14 L24 14 Z" fill="url(#sv4)" opacity="0.6"/>
                    <defs><linearGradient id="sv4" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#F97316"/><stop offset="1" stopColor="#E35A1A"/></linearGradient></defs>
                  </svg>
                ),
              },
              {
                label: 'Arte / Mural', desc: 'Grafite, decoração artística',
                icon: (
                  <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
                    <circle cx="24" cy="24" r="20" fill="url(#sv5)"/>
                    <circle cx="16" cy="20" r="4" fill="white" opacity="0.8"/>
                    <circle cx="28" cy="16" r="3" fill="white" opacity="0.6"/>
                    <circle cx="32" cy="28" r="4" fill="white" opacity="0.7"/>
                    <circle cx="20" cy="32" r="3" fill="white" opacity="0.5"/>
                    <path d="M16 20 Q22 18 28 16 Q30 22 32 28 Q26 30 20 32 Q18 26 16 20Z" fill="white" opacity="0.15"/>
                    <defs><linearGradient id="sv5" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#EC4899"/><stop offset="1" stopColor="#BE185D"/></linearGradient></defs>
                  </svg>
                ),
              },
              {
                label: 'Manutenção', desc: 'Rachaduras, mofo, manchas',
                icon: (
                  <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
                    <circle cx="24" cy="24" r="20" fill="url(#sv6)"/>
                    <path d="M16 32 L24 16 L32 32" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9"/>
                    <path d="M19 27 L29 27" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
                    <circle cx="24" cy="34" r="2" fill="white" opacity="0.9"/>
                    <defs><linearGradient id="sv6" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#10B981"/><stop offset="1" stopColor="#059669"/></linearGradient></defs>
                  </svg>
                ),
              },
            ].map(({ label, desc, icon }) => (
              <motion.div key={label} variants={fadeUp}
                whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(0,0,0,0.08)' }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { window.location.href = `/chat?q=${encodeURIComponent(label)}` }}
                className="bg-white border border-gray-100 rounded-2xl p-5 cursor-pointer group transition-shadow">
                <div className="mb-3 group-hover:scale-110 transition-transform duration-200 w-fit">{icon}</div>
                <p className="font-bold text-gray-900 text-sm mb-1">{label}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Payment / Security ── */}
      <HowPaymentWorks />

      {/* ── Reviews marquee (dark) — after security ── */}
      <ReviewMarquee />

      {/* ── Painter CTA — slate ── */}
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

      {/* ── Final CTA — dark with brand accent ── */}
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

      {/* ── Footer ── */}
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
