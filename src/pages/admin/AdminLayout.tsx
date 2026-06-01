import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, Users, MessageSquare, AlertTriangle,
  Settings, DollarSign, Bot, Star, Shield, BarChart3, Layout, Inbox,
  Paintbrush, BrainCircuit, Menu, X, Home, LogOut, Package, Tag,
  CreditCard, Megaphone, ClipboardList, Lock,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuth } from '../../lib/auth'

const NAV_ADMIN = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/leads', icon: Inbox, label: 'Solicitações' },
  { to: '/admin/requests', icon: FileText, label: 'Pedidos' },
  { to: '/admin/payments', icon: DollarSign, label: 'Pagamentos' },
  { to: '/admin/subscriptions', icon: CreditCard, label: 'Assinaturas' },
  { to: '/admin/users', icon: Users, label: 'Usuários' },
  { to: '/admin/painters', icon: Paintbrush, label: 'Pintores' },
  { to: '/admin/products', icon: Package, label: 'Produtos' },
  { to: '/admin/promotions', icon: Tag, label: 'Promoções' },
  { to: '/admin/ads', icon: Megaphone, label: 'Anúncios' },
  { to: '/admin/reviews', icon: Star, label: 'Avaliações' },
  { to: '/admin/crm', icon: BarChart3, label: 'CRM Global' },
  { to: '/admin/conversations', icon: MessageSquare, label: 'Conversas' },
  { to: '/admin/moderation', icon: AlertTriangle, label: 'Moderação' },
]

const NAV_SUPERADMIN = [
  { to: '/admin/agent', icon: Bot, label: 'Agente IA' },
  { to: '/admin/ai', icon: BrainCircuit, label: 'IA Ops' },
  { to: '/admin/permissions', icon: Shield, label: 'Permissões' },
  { to: '/admin/cms', icon: Layout, label: 'Conteúdo' },
  { to: '/admin/audit', icon: ClipboardList, label: 'Auditoria' },
  { to: '/admin/settings', icon: Settings, label: 'Configurações' },
]

export function AdminLayout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

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

  return (
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
              {user?.isSuperAdmin ? 'Super Admin' : 'Admin'}
            </span>
          </div>
          <button onClick={close} className="lg:hidden w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto scrollbar-hide">
          {NAV_ADMIN.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} onClick={close} className={navLinkClass}>
              <Icon className="w-4 h-4 shrink-0" />{label}
            </NavLink>
          ))}

          {/* Super Admin section — only visible to superadmin */}
          {user?.isSuperAdmin && (
            <>
              <div className="pt-3 pb-1 px-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Lock className="w-3 h-3" /> Super Admin
                </p>
              </div>
              {NAV_SUPERADMIN.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} onClick={close} className={navLinkClass}>
                  <Icon className="w-4 h-4 shrink-0" />{label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-gray-100 shrink-0 space-y-0.5">
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
            <span className="text-xs bg-gradient-to-r from-[#FF7A30] to-brand text-white px-2 py-0.5 rounded font-medium">
              {user?.isSuperAdmin ? 'Super Admin' : 'Admin'}
            </span>
          </div>
          <span className="ml-auto text-xs text-gray-400 truncate max-w-32">
            {[...NAV_ADMIN, ...NAV_SUPERADMIN].find(n => 'end' in n && n.end ? pathname === n.to : pathname.startsWith(n.to))?.label || ''}
          </span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
