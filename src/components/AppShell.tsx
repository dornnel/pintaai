import { BottomNav } from './mobile/BottomNav'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col overflow-hidden bg-gray-50"
      style={{ height: '100dvh' }}
    >
      {/* Área de conteúdo — scroll controlado aqui, nunca na page inteira */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative">
        {children}
      </div>

      {/* BottomNav sabe quando se esconder (/admin, /portal) */}
      <BottomNav />
    </div>
  )
}
