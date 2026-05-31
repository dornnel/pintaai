import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { User as DBUser } from './types'

interface AuthUser {
  id: string
  email?: string
  role: DBUser['role']
  name: string
  phone?: string
  status: DBUser['status']
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  needsOnboarding: boolean
  signOut: () => Promise<void>
  completeOnboarding: (role: DBUser['role']) => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null, loading: true, needsOnboarding: false,
  signOut: async () => {}, completeOnboarding: async () => {},
})

const ADMIN_EMAILS = ['andre@agenscia.com', 'admin@pintae.com.br', 'admin@pintai.com.br']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadProfile(session.user)
      else { setUser(null); setLoading(false); setNeedsOnboarding(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(authUser: { id: string; email?: string }) {
    const { data } = await supabase
      .from('users')
      .select('id, role, name, phone, status, email')
      .eq('auth_user_id', authUser.id)
      .single()

    if (data) {
      setUser({ id: data.id, role: data.role, name: data.name, phone: data.phone, status: data.status, email: data.email })
      setLoading(false)
      setNeedsOnboarding(false)
      return
    }

    // Sem registro — auto-criar para OAuth users
    const email = authUser.email || ''
    const isAdmin = ADMIN_EMAILS.includes(email)
    const role: DBUser['role'] = isAdmin ? 'admin' : 'customer'

    const { data: newUser, error } = await supabase.from('users').insert({
      auth_user_id: authUser.id,
      role,
      name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      email,
      phone: `auto_${authUser.id.slice(0, 8)}`,
      status: isAdmin ? 'active' : 'pending',
    }).select('id, role, name, phone, status, email').single()

    if (!error && newUser) {
      setUser({ id: newUser.id, role: newUser.role, name: newUser.name, phone: newUser.phone, status: newUser.status, email: newUser.email })

      if (isAdmin) {
        await supabase.from('admin_permissions').upsert({
          user_id: newUser.id,
          can_manage_users: true, can_manage_painters: true, can_approve_kyc: true,
          can_view_payments: true, can_manage_products: true, can_view_all_crm: true,
          can_ban_users: true, can_manage_admins: true,
        }, { onConflict: 'user_id' })
      } else {
        // Novo usuário não-admin: precisa escolher o perfil
        setNeedsOnboarding(true)
      }
    }

    setLoading(false)
  }

  async function completeOnboarding(role: DBUser['role']) {
    if (!user) return
    await supabase.from('users').update({ role, status: 'active' }).eq('id', user.id)
    setUser(prev => prev ? { ...prev, role, status: 'active' } : null)
    setNeedsOnboarding(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setNeedsOnboarding(false)
  }

  return (
    <AuthContext.Provider value={{ user, loading, needsOnboarding, signOut, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

export function getRoleHome(role: DBUser['role']): string {
  switch (role) {
    case 'admin': return '/admin'
    case 'painter': return '/portal/pintor'
    case 'partner': return '/marketplace/minha-loja'
    case 'customer': return '/minha-area'
    default: return '/'
  }
}
