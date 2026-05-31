import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider, useAuth, getRoleHome } from './lib/auth'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { UsersPage } from './pages/admin/UsersPage'
import { ReviewsPage } from './pages/admin/ReviewsPage'
import { PermissionsPage } from './pages/admin/PermissionsPage'
import { CMSPage } from './pages/admin/CMSPage'
import { LeadsPage } from './pages/admin/LeadsPage'
import { AdminAgentChat } from './pages/admin/AdminAgentChat'
import { ColorVisualizerPage } from './pages/ColorVisualizerPage'
import { CRMBoard } from './pages/crm/CRMBoard'
import { AppShell } from './components/AppShell'
import { OnboardingPage } from './pages/OnboardingPage'
import { ProductsPage } from './pages/admin/ProductsPage'
import { PromotionsPage } from './pages/admin/PromotionsPage'
import { ConversationsPage } from './pages/admin/ConversationsPage'
import { SettingsPage } from './pages/admin/SettingsPage'
import { SubscriptionsPage } from './pages/admin/SubscriptionsPage'
import { AdsPage } from './pages/admin/AdsPage'
import { AuditLogPage } from './pages/admin/AuditLogPage'

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

function AuthCallback() {
  const navigate = useNavigate()
  const { user, loading, needsOnboarding } = useAuth()

  useEffect(() => {
    if (!loading) {
      if (needsOnboarding) navigate('/onboarding', { replace: true })
      else if (user) navigate(getRoleHome(user.role), { replace: true })
      else navigate('/', { replace: true })
    }
  }, [user, loading, needsOnboarding, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  )
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
    <AppShell>
      <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/marketplace" element={<MarketplacePage />} />
      <Route path="/visualizar-cor" element={<ColorVisualizerPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
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
        <Route path="users" element={<UsersPage />} />
        <Route path="reviews" element={<ReviewsPage />} />
        <Route path="permissions" element={<PermissionsPage />} />
        <Route path="cms" element={<CMSPage />} />
        <Route path="crm" element={<CRMBoard />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="agent" element={<AgentConfigPage />} />
        <Route path="ai" element={<AdminAgentChat />} />
        <Route path="conversations" element={<ConversationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="promotions" element={<PromotionsPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="ads" element={<AdsPage />} />
        <Route path="audit" element={<AuditLogPage />} />
      </Route>

      {/* CRM for painters */}
      <Route path="/crm" element={
        <RequireAuth roles={['painter', 'partner', 'admin']}>
          <CRMBoard />
        </RequireAuth>
      } />

      {/* Partner marketplace */}
      <Route path="/marketplace/minha-loja" element={
        <RequireAuth roles={['partner']}>
          <MarketplacePage />
        </RequireAuth>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </AppShell>
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
