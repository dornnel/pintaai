import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { Home, MessageCircle, Paintbrush, ShoppingBag, User } from 'lucide-react'
import type { ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'

interface Tab {
  to: string
  icon: ComponentType<LucideProps>
  label: string
  end?: boolean
  primary?: boolean
}

const TABS: Tab[] = [
  { to: '/', icon: Home, label: 'Início', end: true },
  { to: '/visualizar-cor', icon: Paintbrush, label: 'Simular' },
  { to: '/chat', icon: MessageCircle, label: 'Chat', primary: true },
  { to: '/marketplace', icon: ShoppingBag, label: 'Loja' },
  { to: '/minha-area', icon: User, label: 'Eu' },
]

const HIDE_ON = ['/admin', '/portal']

export function BottomNav() {
  const { pathname } = useLocation()

  if (HIDE_ON.some(p => pathname.startsWith(p))) return null

  return (
    <div
      className="shrink-0 px-3"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 10px)', paddingTop: 6 }}
    >
      <nav
        className="rounded-2xl border border-white/60"
        style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.9) inset',
        }}
      >
        <div className="flex items-center justify-around h-14 px-1">
          {TABS.map(tab => {
            const active = tab.end
              ? pathname === tab.to
              : pathname === tab.to || (tab.to !== '/' && pathname.startsWith(tab.to))
            const Icon = tab.icon

            if (tab.primary) {
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className="flex flex-col items-center gap-0.5 px-3 py-1 cursor-pointer"
                >
                  <motion.div
                    whileTap={{ scale: 0.88 }}
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
                    style={active ? {
                      background: 'linear-gradient(135deg, #FF8C42, #E35A1A)',
                      boxShadow: '0 2px 10px rgba(227,90,26,0.4)',
                    } : {
                      background: 'rgba(0,0,0,0.06)',
                    }}
                  >
                    <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-500'}`} />
                  </motion.div>
                  <span className={`text-[10px] font-bold leading-none ${active ? 'text-brand' : 'text-gray-400'}`}>Chat</span>
                </NavLink>
              )
            }

            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className="flex flex-col items-center gap-0.5 px-3 py-1 cursor-pointer"
              >
                {({ isActive }) => (
                  <>
                    <motion.div whileTap={{ scale: 0.85 }}>
                      <Icon
                        className={`w-5 h-5 transition-colors duration-150 ${
                          isActive || active ? 'text-brand' : 'text-gray-400'
                        }`}
                      />
                    </motion.div>
                    <span
                      className={`text-[10px] font-medium transition-colors duration-150 leading-none ${
                        isActive || active ? 'text-brand' : 'text-gray-400'
                      }`}
                    >
                      {tab.label}
                    </span>
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
