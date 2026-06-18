import { useState, useEffect, createContext, useContext } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Inbox, Send, Star, Wrench, CreditCard, User,
  Menu, X, Home, LogOut, ChevronRight, Loader2, UserCircle,
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

// ─── Layout ───────────────────────────────────────────────────────────────────

export function PainterLayout() {
  const { user, signOut, switchRole, addRole } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  // ── Data loading ──
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
        // Query error (network, RLS, etc.) — do NOT redirect, just log and stop
        console.error('[PainterLayout] painter query error:', painterErr)
        setLoading(false)
        return
      }

      if (!painterData) {
        // Confirmed: no painter record → redirect to complete setup
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

  // Redirect to painter registration if no painter record exists
  useEffect(() => {
    if (!loading && noPainterRecord) {
      navigate('/seja-pintor', { replace: true })
    }
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

  const close = () => setOpen(false)

  async function goToCustomerPortal() {
    close()
    if (!user?.roles.includes('customer')) {
      await addRole('customer')
    }
    switchRole('customer')
    navigate('/minha-area')
  }

  async function handleSignOut() {
    close()
    await signOut()
    navigate('/', { replace: true })
  }

  // Show loading spinner while redirecting to /seja-pintor
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
      isActive
        ? 'bg-orange-50 text-brand font-medium'
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
    )

  const newCount = leadInteractions.filter(i => i.status === 'notified').length

  return (
    <PainterContext.Provider value={{ painter, score, leadInteractions, reviews, loading, reload: load, declineInteraction, saveAvailability }}>
      <div className="flex h-screen bg-gray-50 overflow-hidden">

        {/* Mobile backdrop */}
        {open && (
          <div className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm lg:hidden" onClick={close} />
        )}

        {/* Sidebar */}
        <aside className={cn(
          'fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-100 flex flex-col',
          'transition-transform duration-300 ease-in-out',
          'lg:relative lg:translate-x-0 lg:w-56 lg:z-auto lg:shrink-0',
          open ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
        )}>
          {/* Header */}
          <div className="h-14 px-4 flex items-center justify-between border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-brand">Pintai</span>
              <span className="text-xs bg-gradient-to-r from-[#FF7A30] to-brand text-white px-2 py-0.5 rounded font-medium">
                Pintor
              </span>
            </div>
            <button onClick={close} className="lg:hidden w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* User info + role switcher */}
          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-brand" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                {score && score.overall_score > 0 ? (
                  <p className="text-xs text-amber-500 font-medium">★ {score.overall_score.toFixed(1)}</p>
                ) : (
                  <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                )}
              </div>
            </div>
            {painter && (
              <div className="mt-2">
                <div className="flex gap-1">
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
              </div>
            )}
            <div className="mt-1">
              <RoleSwitcher />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto scrollbar-hide">
            {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
              <NavLink key={to} to={to} end={end} onClick={close} className={navLinkClass}>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {label === 'Solicitações' && newCount > 0 && (
                  <span className="text-xs bg-brand text-white px-1.5 py-0.5 rounded-full font-medium shrink-0">
                    {newCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-2 border-t border-gray-100 shrink-0 space-y-0.5">
            <button onClick={goToCustomerPortal}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-brand hover:bg-orange-50 cursor-pointer transition-colors">
              <UserCircle className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">Minha Área</span>
              <span className="text-[10px] text-gray-400">cliente</span>
            </button>
            <button onClick={() => { close(); navigate('/') }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 cursor-pointer transition-colors">
              <Home className="w-4 h-4 shrink-0" /> Voltar ao site
            </button>
            <button onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 cursor-pointer transition-colors">
              <LogOut className="w-4 h-4 shrink-0" /> Sair
            </button>
          </div>
        </aside>

        {/* Main area */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Top bar — mobile hamburger / desktop title */}
          <div className="h-14 bg-white border-b border-gray-100 flex items-center gap-3 px-4 shrink-0 z-10">
            <button onClick={() => setOpen(true)}
              className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-brand">Pintai</span>
              <span className="text-xs bg-gradient-to-r from-[#FF7A30] to-brand text-white px-2 py-0.5 rounded font-medium">
                Portal do Pintor
              </span>
            </div>
            {newCount > 0 && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-brand font-medium">
                <ChevronRight className="w-3.5 h-3.5" />
                {newCount} nova{newCount > 1 ? 's' : ''} solicitação{newCount > 1 ? 'ões' : ''}
              </span>
            )}
          </div>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </PainterContext.Provider>
  )
}
