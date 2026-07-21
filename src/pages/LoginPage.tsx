import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Paintbrush, Mail, Lock, User, Eye, EyeOff, ArrowLeft, Loader2, CheckCircle, KeyRound, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth, getRoleHome } from '../lib/auth'

type Step = 'email' | 'login' | 'register' | 'forgot' | 'success'

export function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, loading: authLoading } = useAuth()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [waitingRedirect, setWaitingRedirect] = useState(false)

  useEffect(() => { setLoading(false); setError('') }, [])

  useEffect(() => {
    if (user && waitingRedirect) {
      const redirect = params.get('redirect')
      navigate(redirect || getRoleHome(user.activeRole || user.role), { replace: true })
    }
  }, [user, waitingRedirect, navigate, params])

  useEffect(() => {
    if (!authLoading && user) {
      const redirect = params.get('redirect')
      navigate(redirect || getRoleHome(user.activeRole || user.role), { replace: true })
    }
  }, [authLoading, user, navigate, params])

  function goBack() {
    setStep('email')
    setError('')
    setPassword('')
  }

  async function handleGoogleLogin() {
    setLoading(true); setError('')
    const redirect = params.get('redirect') || ''
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  async function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setLoading(true); setError('')

    const { data } = await supabase
      .from('users')
      .select('id, name')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle()

    if (data) {
      if (data.name) setName(data.name)
      setStep('login')
    } else {
      setStep('register')
    }
    setLoading(false)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    let loginErr: string | null = null
    for (let attempt = 0; attempt < 2; attempt++) {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      })
      if (!err) { loginErr = null; break }
      loginErr = err.message
      if (!err.message.includes('Load failed') && !err.message.includes('fetch')) break
      await new Promise(r => setTimeout(r, 1000))
    }
    if (loginErr) {
      const msg = loginErr.includes('Invalid') ? 'Senha incorreta. Tente novamente.'
        : (loginErr.includes('Load failed') || loginErr.includes('fetch'))
        ? 'Erro de conexão. Abra no navegador (Safari/Chrome) ou tente com Google.'
        : loginErr
      setError(msg)
      setLoading(false)
      return
    }
    setWaitingRedirect(true)
    setLoading(false)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!termsAccepted) { setError('Aceite os Termos de Uso para continuar.'); return }
    setLoading(true); setError('')

    const trimmedEmail = email.toLowerCase().trim()

    try {
      const { data: resp, error: fnErr } = await supabase.functions.invoke('register-user', {
        body: { email: trimmedEmail, password, name, role: 'customer' },
      })

      if (fnErr || resp?.error) {
        const msg = (resp?.error || fnErr?.message || 'Erro ao criar conta')
        setError(
          msg.includes('já tem conta') || msg.includes('already')
            ? 'Este email já tem conta. Tente fazer login.'
            : msg.includes('rate') ? 'Muitas tentativas. Aguarde e tente novamente.'
            : msg
        )
        setLoading(false)
        return
      }

      // Auto-login with the created credentials
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (loginErr) {
        setSuccessMsg('Conta criada! Faça login para continuar.')
        setStep('success')
      } else {
        navigate('/onboarding', { replace: true })
      }
    } catch (err) {
      console.error('[Register] error:', err)
      setError('Erro ao criar conta. Tente novamente.')
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
    setSuccessMsg('Link de redefinição enviado! Verifique seu email.')
    setStep('success')
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
          {/* Logo */}
          <div className="px-8 pt-8 pb-2 flex flex-col items-center gap-2">
            <div className="w-11 h-11 rounded-2xl bg-brand flex items-center justify-center">
              <Paintbrush className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-brand">Pinte Rápido</span>
          </div>

          <div className="px-8 py-6">
            <AnimatePresence mode="wait">

              {/* ═══ STEP 1: Email ═══ */}
              {step === 'email' && (
                <motion.div key="email" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
                  <p className="text-center text-sm text-gray-500 mb-5">Entre ou crie sua conta</p>

                  {/* Google */}
                  <motion.button onClick={handleGoogleLogin} disabled={loading}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center justify-center gap-3 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-60">
                    <svg className="w-4 h-4" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                    Continuar com Google
                  </motion.button>

                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-xs text-gray-400">ou use seu email</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>

                  <form onSubmit={handleEmailContinue} className="space-y-4">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" autoFocus
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand bg-gray-50"
                        placeholder="seu@email.com" />
                    </div>
                    {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                    <motion.button type="submit" disabled={loading || !email} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      className="w-full py-3 bg-brand text-white font-semibold rounded-xl hover:bg-brand-dark transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      Continuar
                    </motion.button>
                  </form>
                </motion.div>
              )}

              {/* ═══ STEP 2A: Login (email exists) ═══ */}
              {step === 'login' && (
                <motion.div key="login" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }}>
                  <button onClick={goBack} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand transition-colors cursor-pointer mb-4">
                    <ArrowLeft className="w-3.5 h-3.5" /> Usar outro email
                  </button>

                  <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 mb-5">
                    <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-brand text-xs font-bold shrink-0">
                      {(name || email)[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      {name && <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>}
                      <p className="text-xs text-gray-500 truncate">{email}</p>
                    </div>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1.5 block">Senha</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                          required autoComplete="current-password" autoFocus
                          className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand bg-gray-50"
                          placeholder="Sua senha" />
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
                    <button type="button" onClick={() => { setError(''); setStep('forgot') }}
                      className="w-full text-xs text-gray-400 hover:text-brand transition-colors text-center cursor-pointer">
                      Esqueci minha senha
                    </button>
                  </form>
                </motion.div>
              )}

              {/* ═══ STEP 2B: Register (email is new) ═══ */}
              {step === 'register' && (
                <motion.div key="register" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }}>
                  <button onClick={goBack} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand transition-colors cursor-pointer mb-4">
                    <ArrowLeft className="w-3.5 h-3.5" /> Usar outro email
                  </button>

                  <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-5">
                    <p className="text-xs text-green-800 font-medium">Criar conta para <strong>{email}</strong></p>
                    <p className="text-[11px] text-green-600 mt-0.5">Preencha os dados abaixo para começar</p>
                  </div>

                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1.5 block">Seu nome</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus
                          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand bg-gray-50"
                          placeholder="Nome completo" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1.5 block">Crie uma senha</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                          required minLength={6} autoComplete="new-password"
                          className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand bg-gray-50"
                          placeholder="Mínimo 6 caracteres" />
                        <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer">
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)}
                        className="mt-0.5 accent-brand w-4 h-4 shrink-0" />
                      <span className="text-xs text-gray-500 leading-relaxed">
                        Li e aceito os{' '}
                        <Link to="/termos" target="_blank" className="text-brand hover:underline">Termos de Uso</Link>
                        {' '}e a{' '}
                        <Link to="/privacidade" target="_blank" className="text-brand hover:underline">Política de Privacidade</Link>.
                      </span>
                    </label>
                    {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                    <motion.button type="submit" disabled={loading || !termsAccepted} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      className="w-full py-3 bg-brand text-white font-semibold rounded-xl hover:bg-brand-dark transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
                      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Criar conta
                    </motion.button>
                  </form>
                </motion.div>
              )}

              {/* ═══ FORGOT ═══ */}
              {step === 'forgot' && (
                <motion.div key="forgot" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }}>
                  <button onClick={goBack} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand transition-colors cursor-pointer mb-4">
                    <ArrowLeft className="w-3.5 h-3.5" /> Voltar
                  </button>

                  <div className="flex items-center gap-2 mb-5">
                    <KeyRound className="w-4 h-4 text-brand" />
                    <p className="text-sm font-semibold text-gray-900">Redefinir senha</p>
                  </div>

                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <p className="text-xs text-gray-500">Enviaremos um link de redefinição para <strong>{email}</strong></p>
                    {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                    <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      className="w-full py-3 bg-brand text-white font-semibold rounded-xl hover:bg-brand-dark transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
                      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Enviar link
                    </motion.button>
                  </form>
                </motion.div>
              )}

              {/* ═══ SUCCESS ═══ */}
              {step === 'success' && (
                <motion.div key="success" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center py-6">
                  <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-7 h-7 text-green-500" />
                  </div>
                  <p className="text-gray-700 font-medium text-sm">{successMsg}</p>
                  <button onClick={goBack} className="mt-4 text-sm text-brand font-medium cursor-pointer hover:underline">
                    ← Voltar
                  </button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
