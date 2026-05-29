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
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, signOut: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user.id)
      else setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadProfile(session.user.id)
      else { setUser(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(authUserId: string) {
    const { data } = await supabase
      .from('users')
      .select('id, role, name, phone, status')
      .eq('auth_user_id', authUserId)
      .single()

    if (data) {
      setUser({
        id: data.id,
        role: data.role,
        name: data.name,
        phone: data.phone,
        status: data.status,
      })
    }
    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>
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
