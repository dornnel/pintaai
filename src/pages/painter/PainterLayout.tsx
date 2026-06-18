import { useState, useEffect, createContext, useContext } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  LayoutDashboard, Inbox, Send, Star, Wrench, CreditCard, User,
  Home, LogOut, Loader2, UserCircle, MoreHorizontal,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { RoleSwitcher } from '../../components/RoleSwitcher'
import { logAudit } from '../../lib/audit'
import type { Painter, PainterScore, Review } from '../../lib/types'

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface LeadInteraction {
  id: string
  lead_id: string
  status: string
  notified_at: string | null
  proposal_sent_at: string | null
  metadata: Record<string, unknown>
  lead: {
    id: string
    protocol: string
    service_interest: string | null
    neighborhood: string | null
    area_m2: number | null
    num_rooms: number | null
    calc_price_min: number | null
    calc_price_max: number | null
    created_at: string
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface PainterContextType {
  painter: Painter | null
  score: PainterScore | null
  leadInteractions: LeadInteraction[]
  reviews: Review[]
  loading: boolean
  reload: () => void
  declineInteraction: (id: string) => Promise<void>
  saveAvailability: (status: 'available' | 'busy' | 'paused') => Promise<void>
}

const PainterContext = createContext<PainterContextType>({
  painter: null, score: null, leadInteractions: [], reviews: [],
  loading: true, reload: () => {}, declineInteraction: async () => {}, saveAvailability: async () => {},
})

export function usePainterContext() {
  return useContext(PainterContext)
}

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: '/portal/pintor', icon: LayoutDashboard, label: 'Início', end: true },
  { to: '/portal/pintor/solicitacoes', icon: Inbox, label: 'Solicitações' },
  { to: '/portal/pintor/propostas', icon: Send, label: 'Propostas' },
  { to: '/portal/pintor/avaliacoes', icon: Star, label: 'Avaliações' },
  { to: '/portal/pintor/ferramentas', icon: Wrench, label: 'Ferramentas' },
  { to: '/portal/pintor/assinatura', icon: CreditCard, label: 'Assinatura' },
  { to: '/portal/pintor/perfil', icon: User, label: 'Perfil' },
]

// Primary tabs visible in the mobile bottom bar
const MOBILE_TABS = [
  { to: '/portal/pintor', icon: LayoutDashboard, label: 'Início', end: true },
  { to: '/portal/pintor/solicitacoes', icon: Inbox, label: 'Leads' },
  { to: '/portal/pintor/propostas', icon: Send, label: 'Propostas' },
  { to: '/portal/pintor/perfil', icon: User, label: 'Perfil' },
]

// Secondary items in the "Mais" bottom sheet
const MOBILE_MORE = [
  { to: '/portal/pintor/avaliacoes', icon: Star, label: 'Avaliações' },
  { to: '/portal/pintor/ferramentas', icon: Wrench, label: 'Ferramentas' },
  { to: '/portal/pintor/assinatura', icon: CreditCard, label: 'Assinatura' },
]

// ─── Layout ───────────────────────────────────────────────────────────────────

export function PainterLayout() {
  const { user, signOut, switchRole, addRole } = useAuth()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)

  const [painter, setPainter] = useState<Painter | null>(null)
  const [score, setScore] = useState<PainterScore | null>(null)
  const [leadInteractions, setLeadInteractions] = useState<LeadInteraction[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [noPainterRecord, setNoPainterRecord] = useState(false)

  async function load() {
    if (!user) return
    try {
      const { data: painterData, error: painterErr } = await supabase
        .from('painters').select('*, user:users!painters_user_id_fkey(name,phone)').eq('user_id', user.id).maybeSingle()

      if (painterErr) {
        console.error('[PainterLayout] painter query error:', painterErr)
        setLoading(false)
        return
      }

      if (!painterData) {
        setNoPainterRecord(true)
        setLoading(false)
        return
      }

      const painterId = painterData.id

      const [intRes, scoreRes, revRes] = await Promise.all([
        supabase.from('lead_painter_interactions')
          .select('*, lead:leads(id,protocol,service_interest,neighborhood,area_m2,num_rooms,calc_price_min,calc_price_max,created_at)')
          .eq('painter_id', painterId).neq('status', 'declined').order('created_at', { ascending: false }),
        supabase.from('painter_scores').select('*').eq('painter_id', painterId).maybeSingle(),
        supabase.from('reviews').select('*').eq('provider_id', painterId).eq('provider_type', 'painter').order('created_at', { ascending: false }),
      ])

      setPainter(painterData)
      setLeadInteractions((intRes.data as LeadInteraction[]) || [])
      setScore(scoreRes.data as PainterScore | null)
      setReviews((revRes.data as Review[]) || [])
    } catch (err) {
      console.error('PainterLayout load error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user])

  useEffect(() => {
    if (!loading && noPainterRecord) navigate('/seja-pintor', { replace: true })
  }, [loading, noPainterRecord, navigate])

  async function saveAvailability(status: 'available' | 'busy' | 'paused') {
    if (!painter) return
    const old = painter.availability_status
    setPainter(prev => prev ? { ...prev, availability_status: status } : null)
    await supabase.from('painters').update({ availability_status: status }).eq('id', painter.id)
    if (user) {
      await logAudit({
        actor_user_id: user.id,
        entity_type: 'painter',
        entity_id: painter.id,
        action: 'painter_availability_changed',
        old_values: { availability_status: old },
        new_values: { availability_status: status },
      })
    }
  }

  async function declineInteraction(id: string) {
    await supabase.from('lead_painter_interactions').update({
      status: 'declined',
      metadata: { declined_at: new Date().toISOString() },
    }).eq('id', id)
    setLeadInteractions(prev => prev.filter(i => i.id !== id))
  }

  async function goToCustomerPortal() {
    setMoreOpen(false)
    if (!user?.roles.includes('customer')) await addRole('customer')
    switchRole('customer')
    navigate('/minha-area')
  }

  async function handleSignOut() {
    setMoreOpen(false)
    await signOut()
    navigate('/', { replace: true })
  }

  if (loading || noPainterRecord) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 text-brand animate-spin" />
      </div>
    )
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
      isActive ? 'bg-orange-50 text-brand font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
    )

  const newCount = leadInteractions.filter(i => i.status === 'notified').length

  const availColor = painter?.availability_status === 'available'
    ? 'bg-green-100 text-green-700'
    : painter?.availability_status === 'busy'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-gray-100 text-gray-500'

  return (
    <PainterContext.Provider value={{ painter, score, leadInteractions, reviews, loading, reload: load, declineInteraction, saveAvailability }}>
      <div className="flex h-screen bg-gray-50 overflow-hidden">

        {/* ═══ DESKTOP SIDEBAR (hidden on mobile) ═══ */}
        <aside className="hidden lg:flex lg:flex-col w-56 bg-white border-r border-gray-100 shrink-0">
          <div className="h-14 px-4 flex items-center border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-brand">Pintai</span>
              <span className="text-xs bg-gradient-to-r from-[#FF7A30] to-brand text-white px-2 py-0.5 rounded font-medium">
                Pintor
              </span>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-brand" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                {score && score.overall_score > 0
                  ? <p className="text-xs text-amber-500 font-medium">★ {score.overall_score.toFixed(1)}</p>
                  : <p className="text-xs text-gray-400 truncate">{user?.email}</p>}
              </div>
            </div>
            {painter && (
              <div className="mt-2 flex gap-1">
                {(['available', 'busy', 'paused'] as const).map(s => (
                  <button key={s} onClick={() => saveAvailability(s)}
                    className={cn('flex-1 py-1 text-[10px] font-medium rounded-lg transition-colors cursor-pointer',
                      painter.availability_status === s
                        ? s === 'available' ? 'bg-green-100 text-green-700'
                          : s === 'busy' ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-200 text-gray-600'
                        : 'bg-gray-50 text-gray-400 hover:bg-gray-100')}>
                    {s === 'available' ? 'Livre' : s === 'busy' ? 'Ocupado' : 'Pausado'}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-1"><RoleSwitcher /></div>
          </div>

          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto scrollbar-hide">
            {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
              <NavLink key={to} to={to} end={end} className={navLinkClass}>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {label === 'Solicitações' && newCount > 0 && (
                  <span className="text-xs bg-brand text-white px-1.5 py-0.5 rounded-full font-medium shrink-0">{newCount}</span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="p-2 border-t border-gray-100 shrink-0 space-y-0.5">
            <button onClick={goToCustomerPortal}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-brand hover:bg-orange-50 cursor-pointer transition-colors">
              <UserCircle className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">Minha Área</span>
              <span className="text-[10px] text-gray-400">cliente</span>
            </button>
            <button onClick={() => navigate('/')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 cursor-pointer transition-colors">
              <Home className="w-4 h-4 shrink-0" /> Voltar ao site
            </button>
            <button onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 cursor-pointer transition-colors">
              <LogOut className="w-4 h-4 shrink-0" /> Sair
            </button>
          </div>
        </aside>

        {/* ═══ MAIN CONTENT AREA ═══ */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

          {/* Top bar — mobile: slim with quick status; desktop: title + count */}
          <header className="bg-white border-b border-gray-100 shrink-0 z-10">
            <div className="h-12 lg:h-14 px-4 flex items-center gap-3"
              style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-sm font-bold text-brand shrink-0">Pintai</span>
                <span className="text-[11px] bg-gradient-to-r from-[#FF7A30] to-brand text-white px-2 py-0.5 rounded font-semibold shrink-0">
                  Pintor
                </span>
                {/* Desktop: new count */}
                {newCount > 0 && (
                  <span className="hidden lg:inline-flex text-xs text-brand font-medium truncate">
                    · {newCount} nova{newCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Mobile: availability quick toggle */}
              {painter && (
                <div className="lg:hidden flex items-center gap-1 shrink-0">
                  {(['available', 'busy', 'paused'] as const).map(s => {
                    const isActive = painter.availability_status === s
                    return (
                      <button key={s} onClick={() => saveAvailability(s)}
                        className={cn('px-2 py-1 text-[10px] font-semibold rounded-lg transition-all cursor-pointer',
                          isActive ? availColor : 'text-gray-300 bg-transparent')}>
                        {s === 'available' ? 'Livre' : s === 'busy' ? 'Ocupado' : 'Pausado'}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Mobile: new leads pulse badge */}
              {newCount > 0 && (
                <div className="lg:hidden flex items-center gap-1 shrink-0">
                  <span className="w-2 h-2 bg-brand rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-brand">{newCount}</span>
                </div>
              )}
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto">
            <Outlet />
            {/* Spacer so last content isn't hidden behind mobile bottom nav */}
            <div className="lg:hidden" aria-hidden="true"
              style={{ height: 'calc(72px + env(safe-area-inset-bottom, 0px))' }} />
          </main>
        </div>

        {/* ═══ MOBILE BOTTOM TAB BAR ═══ */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40">
          <div className="mx-3 rounded-2xl border border-gray-200/70 overflow-hidden"
            style={{
              marginBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
              background: 'rgba(255,255,255,0.94)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 -2px 20px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.08)',
            }}>
            <div className="flex items-stretch h-[56px]">

              {MOBILE_TABS.map(({ to, icon: Icon, label, end }) => (
                <NavLink key={to} to={to} end={end}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 relative">
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.div layoutId="painter-tab-pill"
                          className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-brand rounded-full" />
                      )}
                      <div className="relative">
                        <Icon className={cn('w-[22px] h-[22px] transition-colors duration-150',
                          isActive ? 'text-brand' : 'text-gray-400')} />
                        {label === 'Leads' && newCount > 0 && (
                          <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] bg-brand text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                            {newCount > 9 ? '9+' : newCount}
                          </span>
                        )}
                      </div>
                      <span className={cn('text-[10px] font-semibold leading-none transition-colors duration-150',
                        isActive ? 'text-brand' : 'text-gray-400')}>
                        {label}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}

              {/* Mais button */}
              <button onClick={() => setMoreOpen(true)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 cursor-pointer">
                <MoreHorizontal className="w-[22px] h-[22px] text-gray-400" />
                <span className="text-[10px] font-semibold text-gray-400 leading-none">Mais</span>
              </button>
            </div>
          </div>
        </nav>

        {/* ═══ MOBILE "MAIS" BOTTOM SHEET ═══ */}
        <AnimatePresence>
          {moreOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="lg:hidden fixed inset-0 z-50 bg-black/40"
                style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
                onClick={() => setMoreOpen(false)} />

              <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 32, stiffness: 320 }}
                className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-[28px] overflow-hidden"
                style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}>

                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-9 h-1 bg-gray-200 rounded-full" />
                </div>

                {/* User info */}
                <div className="px-5 pt-2 pb-4 border-b border-gray-100/80">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-brand" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
                      {score && score.overall_score > 0
                        ? <p className="text-xs text-amber-500 font-semibold">★ {score.overall_score.toFixed(1)}</p>
                        : <p className="text-xs text-gray-400">Portal do Pintor</p>}
                    </div>
                    {painter && (
                      <span className={cn('text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0', availColor)}>
                        {painter.availability_status === 'available' ? 'Livre'
                          : painter.availability_status === 'busy' ? 'Ocupado' : 'Pausado'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Secondary nav items */}
                <nav className="px-3 pt-3 pb-1 space-y-0.5">
                  {MOBILE_MORE.map(({ to, icon: Icon, label }) => (
                    <NavLink key={to} to={to} onClick={() => setMoreOpen(false)}
                      className={({ isActive }) => cn(
                        'flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-medium transition-colors',
                        isActive ? 'bg-orange-50 text-brand' : 'text-gray-800 active:bg-gray-50'
                      )}>
                      <Icon className="w-5 h-5 shrink-0 text-gray-400" />
                      {label}
                    </NavLink>
                  ))}
                </nav>

                {/* Divider + account actions */}
                <div className="mx-3 mt-2 pt-3 border-t border-gray-100/80 space-y-0.5">
                  <button onClick={goToCustomerPortal}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-medium text-brand active:bg-orange-50 transition-colors">
                    <UserCircle className="w-5 h-5 shrink-0" />
                    Minha Área (cliente)
                  </button>
                  <button onClick={() => { setMoreOpen(false); navigate('/') }}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-medium text-gray-600 active:bg-gray-50 transition-colors">
                    <Home className="w-5 h-5 shrink-0 text-gray-400" />
                    Voltar ao site
                  </button>
                  <button onClick={handleSignOut}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-medium text-red-500 active:bg-red-50 transition-colors">
                    <LogOut className="w-5 h-5 shrink-0" />
                    Sair
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

      </div>
    </PainterContext.Provider>
  )
}
