import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider, useAuth, getRoleHome } from './lib/auth'
import { LandingPage } from './pages/LandingPage'
import { ChatPage } from './pages/ChatPage'
import { LoginPage } from './pages/LoginPage'
import { MarketplacePage } from './pages/MarketplacePage'
import { CustomerArea } from './pages/customer/CustomerArea'
import { PainterPortal } from './pages/painter/PainterPortal'
import { AdminLayout } from './pages/admin/AdminLayout'
import { DashboardPage } from './pages/admin/DashboardPage'
import { RequestsPage } from './pages/admin/RequestsPage'
import { RequestDetailPage } from './pages/admin/RequestDetailPage'
import { PaintersPage } from './pages/admin/PaintersPage'
import { ModerationPage } from './pages/admin/ModerationPage'
import { PaymentsPage } from './pages/admin/PaymentsPage'
import { AgentConfigPage } from './pages/admin/AgentConfigPage'

// Route guard: redirect unauthenticated users to login
function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to={getRoleHome(user.role)} replace />
  return <>{children}</>
}

function NeighborhoodPage() {
  const { neighborhood } = useParams<{ neighborhood: string }>()
  const name = neighborhood?.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || ''
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-bold text-gray-900 mb-3">Pintores em {name}</h1>
      <p className="text-gray-500 mb-6">Receba até 3 orçamentos comparáveis de pintores próximos.</p>
      <a href="/chat" className="px-6 py-3 bg-brand text-white font-semibold rounded-2xl hover:bg-brand-dark transition-colors">
        Pedir orçamento grátis
      </a>
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/marketplace" element={<MarketplacePage />} />
      <Route path="/seja-pintor" element={<LoginPage />} />
      <Route path="/pintura/:neighborhood" element={<NeighborhoodPage />} />

      {/* Customer */}
      <Route path="/minha-area" element={
        <RequireAuth roles={['customer']}>
          <CustomerArea />
        </RequireAuth>
      } />

      {/* Painter */}
      <Route path="/portal/pintor" element={
        <RequireAuth roles={['painter']}>
          <PainterPortal />
        </RequireAuth>
      } />

      {/* Admin / Superadmin */}
      <Route path="/admin" element={
        <RequireAuth roles={['admin']}>
          <AdminLayout />
        </RequireAuth>
      }>
        <Route index element={<DashboardPage />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="requests/:id" element={<RequestDetailPage />} />
        <Route path="painters" element={<PaintersPage />} />
        <Route path="moderation" element={<ModerationPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="agent" element={<AgentConfigPage />} />
        <Route path="conversations" element={<div className="p-6 text-gray-400 text-sm">Em desenvolvimento</div>} />
        <Route path="settings" element={<div className="p-6 text-gray-400 text-sm">Em desenvolvimento</div>} />
      </Route>

      {/* Partner marketplace */}
      <Route path="/marketplace/minha-loja" element={
        <RequireAuth roles={['partner']}>
          <MarketplacePage />
        </RequireAuth>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
