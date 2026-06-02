import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Paintbrush, Mail, Lock, Phone, User, Eye, EyeOff, ArrowLeft, Loader2, CheckCircle, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth, getRoleHome } from '../lib/auth'

type Tab = 'login' | 'register' | 'forgot'
type RegisterRole = 'customer' | 'painter' | 'partner'

const ROLE_OPTIONS: { value: RegisterRole; label: string; desc: string }[] = [
  { value: 'customer', label: 'Cliente', desc: 'Quero pedir orçamentos de pintura' },
  { value: 'painter', label: 'Pintor', desc: 'Quero receber pedidos e propostas' },
  { value: 'partner', label: 'Loja parceira', desc: 'Quero listar produtos no marketplace' },
]

export function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const defaultRole = (params.get('role') || 'customer') as RegisterRole

  const [tab, setTab] = useState<Tab>(params.get('tab') === 'register' ? 'register' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<RegisterRole>(defaultRole)
  const [showPw, setShowPw] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [waitingRedirect, setWaitingRedirect] = useState(false)

  // Limpar estado residual ao montar — loading pode ter ficado true após OAuth cancelado
  useEffect(() => {
    setLoading(false)
    setError('')
    setSuccess('')
    setWaitingRedirect(false)
  }, [])

  useEffect(() => {
    if (user && waitingRedirect) {
      navigate(getRoleHome(user.role), { replace: true })
    }
  }, [user, waitingRedirect, navigate])

  useEffect(() => {
    if (!authLoading && user) {
      navigate(getRoleHome(user.role), { replace: true })
    }
  }, [authLoading, user, navigate])

  function switchTab(t: Tab) {
    setTab(t)
    setError('')
    setSuccess('')
    setLoading(false)
    setEmail('')
    setPassword('')
  }

  async function handleGoogleLogin() {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) { setError(error.message); setLoading(false) }
    // Se sem erro: browser redireciona para Google — não resetar loading
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError(err.message.includes('Invalid') ? 'E-mail ou senha incorretos.' : err.message)
      setLoading(false)
      return
    }
    setWaitingRedirect(true)
    setLoading(false)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!termsAccepted) { setError('Você precisa aceitar os Termos de Uso e a Política de Privacidade.'); return }
    setLoading(true); setError('')

    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { name, role },
      },
    })

    if (err) {
      const msg = err.message.includes('already registered')
        ? 'Este e-mail já está cadastrado. Tente fazer login.'
        : err.message
      setError(msg)
      setLoading(false)
      return
    }

    if (data.user) {
      // Check if there's a pending invite record (admin created) → update it
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (existing) {
        await supabase.from('users').update({
          auth_user_id: data.user.id,
          name: name || undefined,
          role,
          status: 'pending',
          terms_accepted_at: new Date().toISOString(),
        }).eq('id', existing.id)
      } else {
        await supabase.from('users').insert({
          auth_user_id: data.user.id,
          role,
          name,
          phone: phone || null,
          email,
          status: 'pending',
          terms_accepted_at: new Date().toISOString(),
        })
      }

      if (data.session) {
        // Email confirmation disabled — user is already logged in
        setWaitingRedirect(true)
      } else {
        setSuccess('Conta criada! Enviamos um e-mail de confirmação — verifique sua caixa de entrada e spam.')
      }
    }
    setLoading(false)
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })
    if (err) { setError(err.message); setLoading(false); return }
    setSuccess('Email de redefinição de senha enviado! Verifique sua caixa de entrada.')
    setLoading(false)
  }

  if (authLoading || waitingRedirect) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Entrando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(227,90,26,0.07) 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(227,90,26,0.05) 0%, transparent 70%)' }} />

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10">
        <Link to="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-brand mb-8 transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Voltar ao site
        </Link>

        <div className="bg-white border border-gray-100 rounded-3xl shadow-xl shadow-black/5 overflow-hidden">
          <div className="px-8 pt-8 pb-0 flex flex-col items-center gap-2">
            <div className="w-11 h-11 rounded-2xl bg-brand flex items-center justify-center">
              <Paintbrush className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-brand">Pintai</span>
          </div>

          {/* Google OAuth */}
          <div className="px-8 pt-6">
            <motion.button onClick={handleGoogleLogin} disabled={loading}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-3 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-60">
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Entrar com Google
            </motion.button>
            <div className="flex items-center gap-3 mt-4">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400">ou</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
          </div>

          <div className="px-8 pt-2 flex gap-1 bg-white">
            {(['login', 'register'] as Tab[]).map((t) => (
              <button key={t} onClick={() => switchTab(t)}
                className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-colors cursor-pointer ${tab === t ? 'bg-brand text-white' : 'text-gray-500 hover:text-gray-800'}`}>
                {t === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>
          {tab === 'forgot' && (
            <div className="px-8 pt-3">
              <p className="text-xs text-brand font-medium flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" /> Redefinir senha
              </p>
            </div>
          )}

          <div className="px-8 py-6">
            <AnimatePresence mode="wait">
              {success ? (
                <motion.div key="success" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center py-8">
                  <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-7 h-7 text-green-500" />
                  </div>
                  <p className="text-gray-700 font-medium">{success}</p>
                  <button onClick={() => switchTab('login')} className="mt-4 text-sm text-brand font-medium cursor-pointer">
                    Fazer login →
                  </button>
                </motion.div>
              ) : tab === 'login' ? (
                <motion.form key="login" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.2 }} onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand bg-gray-50"
                        placeholder="seu@email.com" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
                        className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand bg-gray-50"
                        placeholder="••••••••" />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                  <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="w-full py-3 bg-brand text-white font-semibold rounded-xl hover:bg-brand-dark transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Entrar
                  </motion.button>
                  <button type="button" onClick={() => switchTab('forgot')}
                    className="w-full text-xs text-gray-400 hover:text-brand transition-colors text-center mt-1 cursor-pointer">
                    Esqueci minha senha
                  </button>
                </motion.form>
              ) : tab === 'forgot' ? (
                <motion.form key="forgot" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }} onSubmit={handleForgotPassword} className="space-y-4">
                  <p className="text-sm text-gray-600">Informe seu e-mail e enviaremos um link para redefinir sua senha.</p>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand bg-gray-50"
                        placeholder="seu@email.com" />
                    </div>
                  </div>
                  {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                  <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="w-full py-3 bg-brand text-white font-semibold rounded-xl hover:bg-brand-dark transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Enviar link de redefinição
                  </motion.button>
                  <button type="button" onClick={() => switchTab('login')}
                    className="w-full text-xs text-gray-400 hover:text-brand transition-colors text-center cursor-pointer">
                    ← Voltar ao login
                  </button>
                </motion.form>
              ) : (
                <motion.form key="register" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }} onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-2 block">Você é...</label>
                    <div className="space-y-2">
                      {ROLE_OPTIONS.map((opt) => (
                        <motion.label key={opt.value} whileHover={{ scale: 1.01 }}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${role === opt.value ? 'border-brand bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <input type="radio" name="role" value={opt.value} checked={role === opt.value} onChange={() => setRole(opt.value)} className="sr-only" />
                          <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors ${role === opt.value ? 'border-brand bg-brand' : 'border-gray-300'}`} />
                          <div>
                            <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                            <p className="text-xs text-gray-400">{opt.desc}</p>
                          </div>
                        </motion.label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Nome completo</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" value={name} onChange={e => setName(e.target.value)} required
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand bg-gray-50" placeholder="Seu nome completo" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand bg-gray-50" placeholder="seu@email.com" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Celular <span className="text-gray-400">(opcional)</span></label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand bg-gray-50" placeholder="(48) 9 9999-9999" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password"
                        className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand bg-gray-50" placeholder="Mínimo 6 caracteres" />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {/* Termos LGPD */}
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)}
                      className="mt-0.5 accent-brand w-4 h-4 shrink-0" />
                    <span className="text-xs text-gray-500 leading-relaxed">
                      Li e aceito os{' '}
                      <Link to="/termos" target="_blank" className="text-brand hover:underline">Termos de Uso</Link>
                      {' '}e a{' '}
                      <Link to="/privacidade" target="_blank" className="text-brand hover:underline">Política de Privacidade</Link>
                      {' '}(LGPD).
                    </span>
                  </label>
                  {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                  <motion.button type="submit" disabled={loading || !termsAccepted} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="w-full py-3 bg-brand text-white font-semibold rounded-xl hover:bg-brand-dark transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Criar conta
                  </motion.button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
