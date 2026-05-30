import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
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
  { to: '/marketplace', icon: ShoppingBag, label: 'Loja' },
  { to: '/chat', icon: MessageCircle, label: 'Chat', primary: true },
  { to: '/visualizar-cor', icon: Paintbrush, label: 'Simular' },
  { to: '/minha-area', icon: User, label: 'Eu' },
]

const HIDE_ON = ['/admin', '/portal']

export function BottomNav() {
  const { pathname } = useLocation()

  if (HIDE_ON.some(p => pathname.startsWith(p))) return null

  return (
    <nav
      className="shrink-0 bg-white border-t border-gray-100"
      style={{ boxShadow: '0 -1px 0 rgba(0,0,0,0.05)' }}
    >
      <div
        className="flex items-end justify-around px-2"
        style={{ height: 60, paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 6px)' }}
      >
        {TABS.map(tab => {
          const active = tab.end
            ? pathname === tab.to
            : pathname === tab.to || (tab.to !== '/' && pathname.startsWith(tab.to))
          const Icon = tab.icon

          if (tab.primary) {
            return (
              <NavLink key={tab.to} to={tab.to} className="flex flex-col items-center -mt-4 mb-1">
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
                  style={{
                    background: active
                      ? 'linear-gradient(135deg, #FF7A30, #C84400)'
                      : 'linear-gradient(135deg, #FF8C42, #E35A1A)',
                    boxShadow: '0 4px 16px rgba(227,90,26,0.4)',
                  }}
                >
                  <Icon className="w-6 h-6 text-white" />
                </motion.div>
                <span className="text-[10px] text-brand font-semibold mt-0.5">{tab.label}</span>
              </NavLink>
            )
          }

          return (
            <NavLink key={tab.to} to={tab.to} end={tab.end}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 cursor-pointer">
              {({ isActive }) => (
                <>
                  <motion.div whileTap={{ scale: 0.85 }} className="relative">
                    <Icon className={`w-5 h-5 ${isActive || active ? 'text-brand' : 'text-gray-400'}`} />
                    <AnimatePresence>
                      {(isActive || active) && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand"
                        />
                      )}
                    </AnimatePresence>
                  </motion.div>
                  <span className={`text-[10px] font-medium ${isActive || active ? 'text-brand' : 'text-gray-400'}`}>
                    {tab.label}
                  </span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
