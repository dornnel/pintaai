import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Paintbrush, Mail, Lock, Phone, User, Eye, EyeOff, ArrowLeft, Loader2, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getRoleHome } from '../lib/auth'

type Tab = 'login' | 'register'
type RegisterRole = 'customer' | 'painter' | 'partner'

const ROLE_OPTIONS: { value: RegisterRole; label: string; desc: string }[] = [
  { value: 'customer', label: 'Cliente', desc: 'Quero pedir orçamentos de pintura' },
  { value: 'painter', label: 'Pintor', desc: 'Quero receber pedidos e propostas' },
  { value: 'partner', label: 'Loja parceira', desc: 'Quero listar produtos no marketplace' },
]

export function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const defaultRole = (params.get('role') || 'customer') as RegisterRole

  const [tab, setTab] = useState<Tab>(params.get('tab') === 'register' ? 'register' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<RegisterRole>(defaultRole)
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false); return }
    if (data.user) {
      const { data: profile } = await supabase.from('users').select('role').eq('auth_user_id', data.user.id).single()
      navigate(getRoleHome(profile?.role || 'customer'))
    }
    setLoading(false)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error: err } = await supabase.auth.signUp({ email, password })
    if (err) { setError(err.message); setLoading(false); return }
    if (data.user) {
      await supabase.from('users').insert({
        auth_user_id: data.user.id,
        role,
        name,
        phone: phone || null,
        email,
        status: 'pending',
      })
      setSuccess('Conta criada! Verifique seu e-mail para confirmar.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-brand/5" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-brand/5" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <Link to="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-brand mb-8 transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="bg-white border border-gray-100 rounded-3xl shadow-xl shadow-black/5 overflow-hidden">
          {/* Logo */}
          <div className="px-8 pt-8 pb-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand flex items-center justify-center">
              <Paintbrush className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-brand">Pintaê</span>
          </div>

          {/* Tabs */}
          <div className="px-8 pt-6 flex gap-1 bg-white">
            {(['login', 'register'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); setSuccess('') }}
                className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-colors cursor-pointer ${
                  tab === t ? 'bg-brand text-white' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {t === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          <div className="px-8 py-6">
            <AnimatePresence mode="wait">
              {success ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-8"
                >
                  <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-7 h-7 text-green-500" />
                  </div>
                  <p className="text-gray-700 font-medium">{success}</p>
                  <button onClick={() => setTab('login')} className="mt-4 text-sm text-brand font-medium cursor-pointer">
                    Fazer login
                  </button>
                </motion.div>
              ) : tab === 'login' ? (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handleLogin}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email" value={email} onChange={e => setEmail(e.target.value)} required
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand bg-gray-50"
                        placeholder="seu@email.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                        className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand bg-gray-50"
                        placeholder="••••••••"
                      />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                  <motion.button
                    type="submit" disabled={loading}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="w-full py-3 bg-brand text-white font-semibold rounded-xl hover:bg-brand-dark transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Entrar
                  </motion.button>
                  {/* Superadmin quick access hint */}
                  <p className="text-center text-xs text-gray-400">
                    Admin?{' '}
                    <button type="button" onClick={() => setEmail('admin@pintae.com')} className="text-brand cursor-pointer">
                      Usar conta admin
                    </button>
                  </p>
                </motion.form>
              ) : (
                <motion.form
                  key="register"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handleRegister}
                  className="space-y-4"
                >
                  {/* Role selector */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-2 block">Você é...</label>
                    <div className="space-y-2">
                      {ROLE_OPTIONS.map((opt) => (
                        <motion.label
                          key={opt.value}
                          whileHover={{ scale: 1.01 }}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                            role === opt.value ? 'border-brand bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input type="radio" name="role" value={opt.value} checked={role === opt.value}
                            onChange={() => setRole(opt.value)} className="sr-only" />
                          <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors ${
                            role === opt.value ? 'border-brand bg-brand' : 'border-gray-300'
                          }`} />
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
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand bg-gray-50"
                        placeholder="Seu nome" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand bg-gray-50"
                        placeholder="seu@email.com" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Celular <span className="text-gray-400">(opcional)</span></label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand bg-gray-50"
                        placeholder="(48) 9 9999-9999" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                        className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand bg-gray-50"
                        placeholder="Mínimo 6 caracteres" />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                  <motion.button
                    type="submit" disabled={loading}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="w-full py-3 bg-brand text-white font-semibold rounded-xl hover:bg-brand-dark transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
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
