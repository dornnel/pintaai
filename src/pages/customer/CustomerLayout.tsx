import { useState, useEffect, createContext, useContext } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, Star, User,
  Menu, X, Home, LogOut, Paintbrush2, Plus,
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
  { to: '/minha-area/pedidos', icon: FileText, label: 'Meus Pedidos' },
  { to: '/minha-area/avaliacoes', icon: Star, label: 'Avaliações' },
  { to: '/minha-area/perfil', icon: User, label: 'Perfil' },
]

// ─── Layout ───────────────────────────────────────────────────────────────────

export function CustomerLayout() {
  const { user, signOut, switchRole } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
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
        created_at, is_partial,
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

  const close = () => setOpen(false)

  async function handleSignOut() {
    close()
    await signOut()
    navigate('/', { replace: true })
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
      isActive
        ? 'bg-orange-50 text-brand font-medium'
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
    )

  const pendingProposals = leads.reduce((acc, l) =>
    acc + l.lead_painter_interactions.filter(i => i.status === 'proposal_sent').length, 0)

  return (
    <CustomerContext.Provider value={{ leads, loading, reload: load, selectProposal }}>
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
              <span className="text-xs bg-orange-100 text-brand px-2 py-0.5 rounded font-medium">
                Minha Área
              </span>
            </div>
            <button onClick={close} className="lg:hidden w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* User info */}
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
              <div className="mt-2">
                <RoleSwitcher />
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto scrollbar-hide">
            {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
              <NavLink key={to} to={to} end={end} onClick={close} className={navLinkClass}>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {label === 'Meus Pedidos' && pendingProposals > 0 && (
                  <span className="text-xs bg-brand text-white px-1.5 py-0.5 rounded-full font-medium shrink-0">
                    {pendingProposals}
                  </span>
                )}
              </NavLink>
            ))}

            <div className="pt-2">
              <button onClick={() => { close(); navigate('/chat') }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white bg-brand hover:bg-orange-700 transition-colors cursor-pointer font-medium">
                <Plus className="w-4 h-4 shrink-0" /> Novo pedido
              </button>
            </div>
          </nav>

          {/* Footer */}
          <div className="p-2 border-t border-gray-100 shrink-0 space-y-0.5">
            {user?.roles?.includes('painter') && (
              <button onClick={() => { close(); switchRole('painter'); navigate('/portal/pintor') }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-brand hover:bg-orange-50 cursor-pointer transition-colors">
                <Paintbrush2 className="w-4 h-4 shrink-0" /> Portal do Pintor
              </button>
            )}
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
          {/* Mobile top bar */}
          <div className="lg:hidden h-14 bg-white border-b border-gray-100 flex items-center gap-3 px-4 shrink-0 z-10">
            <button onClick={() => setOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-brand">Pintai</span>
              <span className="text-xs bg-orange-100 text-brand px-2 py-0.5 rounded font-medium">
                Minha Área
              </span>
            </div>
            {pendingProposals > 0 && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-brand font-medium">
                <span className="w-2 h-2 bg-brand rounded-full animate-pulse" />
                {pendingProposals} proposta{pendingProposals > 1 ? 's' : ''} nova{pendingProposals > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </CustomerContext.Provider>
  )
}
