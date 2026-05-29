import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, FileText, Users, MessageSquare, AlertTriangle,
  Settings, DollarSign, Bot, Star, Shield, BarChart3, Layout, Inbox, Paintbrush,
} from 'lucide-react'
import { cn } from '../../lib/utils'

const NAV = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/leads', icon: Inbox, label: 'Solicitações' },
  { to: '/admin/requests', icon: FileText, label: 'Pedidos' },
  { to: '/admin/payments', icon: DollarSign, label: 'Pagamentos' },
  { to: '/admin/users', icon: Users, label: 'Usuários' },
  { to: '/admin/painters', icon: Paintbrush, label: 'Pintores' },
  { to: '/admin/reviews', icon: Star, label: 'Avaliações' },
  { to: '/admin/crm', icon: BarChart3, label: 'CRM Global' },
  { to: '/admin/agent', icon: Bot, label: 'Agente IA' },
  { to: '/admin/permissions', icon: Shield, label: 'Permissões' },
  { to: '/admin/cms', icon: Layout, label: 'Conteúdo' },
  { to: '/admin/conversations', icon: MessageSquare, label: 'Conversas' },
  { to: '/admin/moderation', icon: AlertTriangle, label: 'Moderação' },
]

export function AdminLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col shrink-0 overflow-y-auto">
        <div className="h-14 px-5 flex items-center border-b border-gray-100 shrink-0">
          <span className="text-base font-bold text-brand">Pintai</span>
          <span className="ml-2 text-xs bg-gradient-to-r from-[#FF7A30] to-brand text-white px-2 py-0.5 rounded font-medium">Admin</span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                cn('flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors',
                  isActive ? 'bg-orange-50 text-brand font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t border-gray-100 shrink-0">
          <NavLink to="/admin/settings"
            className={({ isActive }) =>
              cn('flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors',
                isActive ? 'bg-orange-50 text-brand font-medium' : 'text-gray-500 hover:bg-gray-50')
            }
          >
            <Settings className="w-4 h-4 shrink-0" />
            Configurações
          </NavLink>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
