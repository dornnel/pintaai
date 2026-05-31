import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { BottomNav } from './mobile/BottomNav'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const contentRef = useRef<HTMLDivElement>(null)

  // Reset scroll to top on every route change — prevents stale scroll position
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <div
      className="flex flex-col overflow-hidden bg-gray-50"
      style={{ height: '100dvh' }}
    >
      <div
        ref={contentRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative"
      >
        {children}
      </div>

      <BottomNav />
    </div>
  )
}
