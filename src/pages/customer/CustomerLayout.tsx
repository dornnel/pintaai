import { useState, useEffect, createContext, useContext } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  LayoutDashboard, FileText, Star, User,
  Home, LogOut, Paintbrush2, Plus,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { RoleSwitcher } from '../../components/RoleSwitcher'

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface CustomerLead {
  id: string
  protocol: string
  service_interest: string | null
  neighborhood: string | null
  area_m2: number | null
  num_rooms: number | null
  calc_price_min: number | null
  calc_price_max: number | null
  property_type: string | null
  deadline: string | null
  material: string | null
  wall_condition: string | null
  final_notes: string | null
  preferred_professional: string | null
  estimated_budget: string | null
  current_color: string | null
  created_at: string
  is_partial: boolean
  cancelled_at: string | null
  cancel_reason: string | null
  lead_painter_interactions: Array<{
    id: string
    status: string
    notified_at: string | null
    proposal_viewed_at: string | null
    metadata: { quote?: {
      total_price: number
      includes_material: boolean
      duration_days: number
      validity_days: number
      payment_terms: string
      notes: string
    }; painter_notes?: string }
    painter: {
      id: string
      bio: string | null
      years_experience: number
      specialties: string[]
      kyc_status: string
      user: { name: string; phone?: string | null } | null
    } | null
  }>
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface CustomerContextType {
  leads: CustomerLead[]
  loading: boolean
  reload: () => void
  selectProposal: (leadId: string, interactionId: string) => Promise<void>
}

const CustomerContext = createContext<CustomerContextType>({
  leads: [], loading: true, reload: () => {}, selectProposal: async () => {},
})

export function useCustomerContext() {
  return useContext(CustomerContext)
}

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: '/minha-area', icon: LayoutDashboard, label: 'Início', end: true },
  { to: '/minha-area/pedidos', icon: FileText, label: 'Minhas Solicitações' },
  { to: '/minha-area/avaliacoes', icon: Star, label: 'Avaliações' },
  { to: '/minha-area/perfil', icon: User, label: 'Perfil' },
]

const MOBILE_TABS = [
  { to: '/minha-area', icon: LayoutDashboard, label: 'Início', end: true },
  { to: '/minha-area/pedidos', icon: FileText, label: 'Solic.' },
  { to: '/minha-area/avaliacoes', icon: Star, label: 'Aval.' },
  { to: '/minha-area/perfil', icon: User, label: 'Perfil' },
]

// ─── Layout ───────────────────────────────────────────────────────────────────

export function CustomerLayout() {
  const { user, signOut, switchRole } = useAuth()
  const navigate = useNavigate()
  const [leads, setLeads] = useState<CustomerLead[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!user?.email) return
    const { data } = await supabase
      .from('leads')
      .select(`
        id, protocol, service_interest, neighborhood, area_m2, num_rooms,
        calc_price_min, calc_price_max, property_type, deadline, material,
        wall_condition, final_notes, preferred_professional, estimated_budget, current_color,
        created_at, is_partial, cancelled_at, cancel_reason,
        lead_painter_interactions(
          id, status, metadata, notified_at, proposal_viewed_at,
          painter:painters(
            id, bio, years_experience, specialties, kyc_status,
            user:users!painters_user_id_fkey(name, phone)
          )
        )
      `)
      .eq('email', user.email)
      .eq('is_partial', false)
      .order('created_at', { ascending: false })

    setLeads((data as unknown as CustomerLead[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  async function selectProposal(leadId: string, interactionId: string) {
    if (!confirm('Confirmar contratação desta proposta? Os outros pintores serão notificados.')) return

    await supabase.from('lead_painter_interactions')
      .update({ status: 'accepted' })
      .eq('id', interactionId)

    const lead = leads.find(l => l.id === leadId)
    const others = lead?.lead_painter_interactions.filter(
      i => i.id !== interactionId && i.status !== 'declined'
    ) ?? []
    for (const other of others) {
      await supabase.from('lead_painter_interactions').update({ status: 'declined' }).eq('id', other.id)
    }

    await load()
  }

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
      isActive ? 'bg-orange-50 text-brand font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
    )

  const pendingProposals = leads.reduce((acc, l) =>
    acc + l.lead_painter_interactions.filter(i => i.status === 'proposal_sent').length, 0)

  return (
    <CustomerContext.Provider value={{ leads, loading, reload: load, selectProposal }}>
      <div className="flex h-screen bg-gray-50 overflow-hidden">

        {/* ═══ DESKTOP SIDEBAR (hidden on mobile) ═══ */}
        <aside className="hidden lg:flex lg:flex-col w-56 bg-white border-r border-gray-100 shrink-0">
          <div className="h-14 px-4 flex items-center border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-brand">Pintai</span>
              <span className="text-xs bg-orange-100 text-brand px-2 py-0.5 rounded font-medium">
                Minha Área
              </span>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-brand" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>
            </div>
            {user?.roles?.includes('painter') && (
              <div className="mt-2"><RoleSwitcher /></div>
            )}
          </div>

          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto scrollbar-hide">
            {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
              <NavLink key={to} to={to} end={end} className={navLinkClass}>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {label === 'Minhas Solicitações' && pendingProposals > 0 && (
                  <span className="text-xs bg-brand text-white px-1.5 py-0.5 rounded-full font-medium shrink-0">
                    {pendingProposals}
                  </span>
                )}
              </NavLink>
            ))}

            <div className="pt-2">
              <button onClick={() => navigate('/chat')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white bg-brand hover:bg-orange-700 transition-colors cursor-pointer font-medium">
                <Plus className="w-4 h-4 shrink-0" /> Novo pedido
              </button>
            </div>
          </nav>

          <div className="p-2 border-t border-gray-100 shrink-0 space-y-0.5">
            {user?.roles?.includes('painter') && (
              <button onClick={() => { switchRole('painter'); navigate('/portal/pintor') }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-brand hover:bg-orange-50 cursor-pointer transition-colors">
                <Paintbrush2 className="w-4 h-4 shrink-0" /> Portal do Pintor
              </button>
            )}
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

          {/* Top bar */}
          <header className="bg-white border-b border-gray-100 shrink-0 z-10">
            <div className="h-12 lg:h-14 px-4 flex items-center gap-3"
              style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-sm font-bold text-brand shrink-0">Pintai</span>
                <span className="text-[11px] bg-orange-100 text-brand px-2 py-0.5 rounded font-semibold shrink-0">
                  Minha Área
                </span>
              </div>

              {/* Mobile: role switcher + proposal badge */}
              <div className="lg:hidden flex items-center gap-2 shrink-0">
                <RoleSwitcher />
                {pendingProposals > 0 && (
                  <span className="flex items-center gap-1 text-xs font-bold text-brand">
                    <span className="w-2 h-2 bg-brand rounded-full animate-pulse" />
                    {pendingProposals}
                  </span>
                )}
              </div>

              {/* Desktop: proposal count */}
              {pendingProposals > 0 && (
                <span className="hidden lg:flex items-center gap-1.5 text-xs text-brand font-medium">
                  <span className="w-2 h-2 bg-brand rounded-full animate-pulse" />
                  {pendingProposals} proposta{pendingProposals > 1 ? 's' : ''} nova{pendingProposals > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto">
            <Outlet />
            {/* Spacer so content isn't hidden behind mobile bottom nav */}
            <div className="lg:hidden" aria-hidden="true"
              style={{ height: 'calc(80px + env(safe-area-inset-bottom, 0px))' }} />
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

              {/* First 2 tabs */}
              {MOBILE_TABS.slice(0, 2).map(({ to, icon: Icon, label, end }) => (
                <NavLink key={to} to={to} end={end}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 relative">
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.div layoutId="customer-tab-pill"
                          className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-brand rounded-full" />
                      )}
                      <div className="relative">
                        <Icon className={cn('w-[22px] h-[22px] transition-colors duration-150',
                          isActive ? 'text-brand' : 'text-gray-400')} />
                        {label === 'Solic.' && pendingProposals > 0 && (
                          <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] bg-brand text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                            {pendingProposals > 9 ? '9+' : pendingProposals}
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

              {/* Center "+" action button */}
              <button onClick={() => navigate('/chat')}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 relative cursor-pointer">
                <motion.div
                  whileTap={{ scale: 0.88 }}
                  className="w-11 h-11 rounded-[14px] flex items-center justify-center -mt-3"
                  style={{
                    background: 'linear-gradient(135deg, #FF8C42, #E35A1A)',
                    boxShadow: '0 4px 14px rgba(227,90,26,0.38)',
                  }}>
                  <Plus className="w-5 h-5 text-white" />
                </motion.div>
                <span className="text-[10px] font-semibold text-gray-400 leading-none mt-0.5">Pedir</span>
              </button>

              {/* Last 2 tabs */}
              {MOBILE_TABS.slice(2).map(({ to, icon: Icon, label, end }) => (
                <NavLink key={to} to={to} end={end}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 relative">
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.div layoutId="customer-tab-pill"
                          className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-brand rounded-full" />
                      )}
                      <Icon className={cn('w-[22px] h-[22px] transition-colors duration-150',
                        isActive ? 'text-brand' : 'text-gray-400')} />
                      <span className={cn('text-[10px] font-semibold leading-none transition-colors duration-150',
                        isActive ? 'text-brand' : 'text-gray-400')}>
                        {label}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>

      </div>
    </CustomerContext.Provider>
  )
}
