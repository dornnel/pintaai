import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, FileText, Users, MessageSquare, AlertTriangle, Settings, DollarSign, Bot } from 'lucide-react'
import { cn } from '../../lib/utils'

const NAV = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/requests', icon: FileText, label: 'Pedidos' },
  { to: '/admin/payments', icon: DollarSign, label: 'Pagamentos' },
  { to: '/admin/painters', icon: Users, label: 'Pintores' },
  { to: '/admin/agent', icon: Bot, label: 'Agente IA' },
  { to: '/admin/conversations', icon: MessageSquare, label: 'Conversas' },
  { to: '/admin/moderation', icon: AlertTriangle, label: 'Moderação' },
]

export function AdminLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col shrink-0">
        <div className="h-14 px-5 flex items-center border-b border-gray-100">
          <span className="text-base font-bold text-brand">Pintaê</span>
          <span className="ml-2 text-xs bg-orange-100 text-brand px-2 py-0.5 rounded-full font-medium">Admin</span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                cn('flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors',
                  isActive ? 'bg-orange-50 text-brand font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t border-gray-100">
          <NavLink to="/admin/settings"
            className={({ isActive }) =>
              cn('flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors',
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
