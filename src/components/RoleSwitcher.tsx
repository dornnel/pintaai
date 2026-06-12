import { useNavigate } from 'react-router-dom'
import { Briefcase, User as UserIcon } from 'lucide-react'
import { useAuth, getRoleHome } from '../lib/auth'
import { cn } from '../lib/utils'

const ROLE_LABELS: Record<string, { label: string; icon: typeof UserIcon }> = {
  customer: { label: 'Cliente', icon: UserIcon },
  painter: { label: 'Pintor', icon: Briefcase },
}

export function RoleSwitcher() {
  const { user, switchRole } = useAuth()
  const navigate = useNavigate()

  if (!user || user.roles.length < 2) return null

  const switchableRoles = user.roles.filter(r => ROLE_LABELS[r])
  if (switchableRoles.length < 2) return null

  return (
    <div className="inline-flex items-center bg-gray-100 rounded-full p-1 gap-1">
      {switchableRoles.map(role => {
        const { label, icon: Icon } = ROLE_LABELS[role]
        const active = user.activeRole === role
        return (
          <button
            key={role}
            onClick={() => {
              if (!active) {
                switchRole(role as typeof user.role)
                navigate(getRoleHome(role as typeof user.role))
              }
            }}
            className={cn(
              'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors cursor-pointer',
              active ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
