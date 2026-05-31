import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { BottomNav } from './mobile/BottomNav'
import { CookieBanner } from './CookieBanner'

// Routes where the layout must be fully fixed — no scroll at all
const FIXED_ROUTES = ['/chat', '/visualizar-cor', '/minha-area', '/portal/pintor']

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const contentRef = useRef<HTMLDivElement>(null)
  const isFixed = FIXED_ROUTES.some(r => pathname.startsWith(r))

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0
  }, [pathname])

  return (
    <div className="flex flex-col overflow-hidden bg-gray-50" style={{ height: '100dvh' }}>
      {/* flex flex-col on fixed routes so children can use flex-1 reliably */}
      <div
        ref={contentRef}
        className={`flex-1 min-h-0 overflow-x-hidden relative ${
          isFixed
            ? 'overflow-hidden flex flex-col'
            : 'overflow-y-auto'
        }`}
      >
        {children}
      </div>
      <CookieBanner />
      <BottomNav />
    </div>
  )
}
