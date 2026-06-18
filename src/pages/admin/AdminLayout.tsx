import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  LayoutDashboard, FileText, Users, MessageSquare, AlertTriangle,
  Settings, DollarSign, Bot, Star, Shield, BarChart3, Layout, Inbox,
  Paintbrush, Home, LogOut, Package, Tag,
  CreditCard, Megaphone, ClipboardList, Lock, MoreHorizontal, Paintbrush2, UserCircle,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuth } from '../../lib/auth'

// ─── Nav config ───────────────────────────────────────────────────────────────

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
  { to: '/admin/ia', icon: Bot, label: 'Central de IA' },
  { to: '/admin/permissions', icon: Shield, label: 'Permissões' },
  { to: '/admin/cms', icon: Layout, label: 'Conteúdo' },
  { to: '/admin/audit', icon: ClipboardList, label: 'Auditoria' },
  { to: '/admin/settings', icon: Settings, label: 'Configurações' },
]

// Primary tabs shown in mobile bottom bar (max 3 + Mais)
const MOBILE_TABS = [
  { to: '/admin', icon: LayoutDashboard, label: 'Painel', end: true },
  { to: '/admin/leads', icon: Inbox, label: 'Leads' },
  { to: '/admin/painters', icon: Paintbrush, label: 'Pintores' },
]

// Groups for the "Mais" bottom sheet
const MORE_GROUPS = [
  {
    title: 'Operações',
    items: [
      { to: '/admin/requests', icon: FileText, label: 'Pedidos' },
      { to: '/admin/payments', icon: DollarSign, label: 'Pagamentos' },
      { to: '/admin/subscriptions', icon: CreditCard, label: 'Assinaturas' },
      { to: '/admin/conversations', icon: MessageSquare, label: 'Conversas' },
      { to: '/admin/moderation', icon: AlertTriangle, label: 'Moderação' },
    ],
  },
  {
    title: 'Dados',
    items: [
      { to: '/admin/users', icon: Users, label: 'Usuários' },
      { to: '/admin/reviews', icon: Star, label: 'Avaliações' },
      { to: '/admin/crm', icon: BarChart3, label: 'CRM Global' },
    ],
  },
  {
    title: 'Catálogo',
    items: [
      { to: '/admin/products', icon: Package, label: 'Produtos' },
      { to: '/admin/promotions', icon: Tag, label: 'Promoções' },
      { to: '/admin/ads', icon: Megaphone, label: 'Anúncios' },
    ],
  },
]

const MORE_SUPERADMIN = {
  title: 'Super Admin',
  items: NAV_SUPERADMIN,
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function AdminLayout() {
  const [moreOpen, setMoreOpen] = useState(false)
  const navigate = useNavigate()
  const { user, signOut, switchRole } = useAuth()

  async function handleSignOut() {
    setMoreOpen(false)
    await signOut()
    navigate('/', { replace: true })
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
      isActive ? 'bg-orange-50 text-brand font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
    )

  const adminBadge = user?.isSuperAdmin ? 'Super Admin' : 'Admin'

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ═══ DESKTOP SIDEBAR (hidden on mobile) ═══ */}
      <aside className="hidden lg:flex lg:flex-col w-56 bg-white border-r border-gray-100 shrink-0">
        <div className="h-14 px-4 flex items-center border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-brand">Pintai</span>
            <span className="text-xs bg-gradient-to-r from-[#FF7A30] to-brand text-white px-2 py-0.5 rounded font-medium">
              {adminBadge}
            </span>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto scrollbar-hide">
          {NAV_ADMIN.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} className={navLinkClass}>
              <Icon className="w-4 h-4 shrink-0" />{label}
            </NavLink>
          ))}

          {user?.isSuperAdmin && (
            <>
              <div className="pt-3 pb-1 px-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Lock className="w-3 h-3" /> Super Admin
                </p>
              </div>
              {NAV_SUPERADMIN.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} className={navLinkClass}>
                  <Icon className="w-4 h-4 shrink-0" />{label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* Logged-in user identity */}
        <div className="px-3 py-2.5 border-t border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF7A30] to-brand flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user?.name?.charAt(0).toUpperCase() ?? 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-900 truncate">{user?.name}</p>
              <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
          {user?.roles && user.roles.length > 1 && (
            <div className="flex flex-wrap gap-1 mt-1.5 pl-[42px]">
              {user.roles.map(r => (
                <span key={r} className={cn(
                  'text-[9px] font-semibold px-1.5 py-0.5 rounded-full',
                  r === user.role
                    ? 'bg-gradient-to-r from-[#FF7A30] to-brand text-white'
                    : 'bg-gray-100 text-gray-500',
                )}>
                  {r === 'admin' ? 'Admin' : r === 'painter' ? 'Pintor' : r === 'customer' ? 'Cliente' : r}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="p-2 border-t border-gray-100 shrink-0 space-y-0.5">
          {user?.roles?.includes('painter') && (
            <button onClick={() => { switchRole('painter'); navigate('/portal/pintor') }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 cursor-pointer transition-colors">
              <Paintbrush2 className="w-4 h-4 shrink-0" /> Portal do Pintor
            </button>
          )}
          {user?.roles?.includes('customer') && (
            <button onClick={() => { switchRole('customer'); navigate('/minha-area') }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 cursor-pointer transition-colors">
              <UserCircle className="w-4 h-4 shrink-0" /> Minha Área
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
              <span className="text-[11px] bg-gradient-to-r from-[#FF7A30] to-brand text-white px-2 py-0.5 rounded font-semibold shrink-0">
                {adminBadge}
              </span>
            </div>
            <span className="text-xs text-gray-400 truncate max-w-28 lg:hidden">
              {user?.name}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
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
                      <motion.div layoutId="admin-tab-pill"
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
              className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-[28px]"
              style={{ maxHeight: '85dvh', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>

              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-2 shrink-0">
                <div className="w-9 h-1 bg-gray-200 rounded-full" />
              </div>

              {/* User info */}
              <div className="px-5 pb-3 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-brand">
                      {user?.name?.charAt(0).toUpperCase() ?? 'A'}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
                    <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-gradient-to-r from-[#FF7A30] to-brand text-white shrink-0">
                    {adminBadge}
                  </span>
                </div>
              </div>

              {/* Scrollable nav groups */}
              <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(85dvh - 120px)' }}>
                {MORE_GROUPS.map(group => (
                  <div key={group.title} className="px-3 pt-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-1">
                      {group.title}
                    </p>
                    <div className="space-y-0.5">
                      {group.items.map(({ to, icon: Icon, label }) => (
                        <NavLink key={to} to={to} onClick={() => setMoreOpen(false)}
                          className={({ isActive }) => cn(
                            'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors',
                            isActive ? 'bg-orange-50 text-brand' : 'text-gray-700 active:bg-gray-50'
                          )}>
                          <Icon className="w-4 h-4 shrink-0 text-gray-400" />
                          {label}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Super admin section */}
                {user?.isSuperAdmin && (
                  <div className="px-3 pt-3 pb-1">
                    <p className="text-[10px] font-bold text-brand/70 uppercase tracking-wider px-3 mb-1 flex items-center gap-1.5">
                      <Lock className="w-3 h-3" /> {MORE_SUPERADMIN.title}
                    </p>
                    <div className="rounded-xl border border-brand/10 bg-orange-50/50 overflow-hidden">
                      {MORE_SUPERADMIN.items.map(({ to, icon: Icon, label }) => (
                        <NavLink key={to} to={to} onClick={() => setMoreOpen(false)}
                          className={({ isActive }) => cn(
                            'flex items-center gap-3 px-3 py-3 text-sm font-medium transition-colors border-b border-brand/5 last:border-0',
                            isActive ? 'text-brand bg-orange-100/70' : 'text-gray-700 active:bg-orange-100/40'
                          )}>
                          <Icon className="w-4 h-4 shrink-0 text-brand/50" />
                          {label}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                )}

                {/* Account actions */}
                <div className="px-3 pt-2 pb-2 mt-1 border-t border-gray-100 space-y-0.5">
                  {user?.roles?.includes('painter') && (
                    <button onClick={() => { switchRole('painter'); setMoreOpen(false); navigate('/portal/pintor') }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-700 active:bg-gray-50 transition-colors">
                      <Paintbrush2 className="w-4 h-4 shrink-0 text-gray-400" />
                      Portal do Pintor
                    </button>
                  )}
                  {user?.roles?.includes('customer') && (
                    <button onClick={() => { switchRole('customer'); setMoreOpen(false); navigate('/minha-area') }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-700 active:bg-gray-50 transition-colors">
                      <UserCircle className="w-4 h-4 shrink-0 text-gray-400" />
                      Minha Área
                    </button>
                  )}
                  <button onClick={() => { setMoreOpen(false); navigate('/') }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-600 active:bg-gray-50 transition-colors">
                    <Home className="w-4 h-4 shrink-0 text-gray-400" />
                    Voltar ao site
                  </button>
                  <button onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-red-500 active:bg-red-50 transition-colors">
                    <LogOut className="w-4 h-4 shrink-0" />
                    Sair
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  )
}
