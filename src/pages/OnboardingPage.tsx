import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Loader2 } from 'lucide-react'
import { useAuth, getRoleHome } from '../lib/auth'
import type { User as DBUser } from '../lib/types'

type Role = DBUser['role']

const ROLE_OPTIONS: { value: Role; label: string; desc: string; emoji: string }[] = [
  { value: 'customer', label: 'Quero contratar pintores', desc: 'Receber orçamentos e encontrar profissionais verificados', emoji: '🏠' },
  { value: 'painter', label: 'Sou pintor', desc: 'Quero receber pedidos de clientes e enviar propostas', emoji: '🎨' },
  { value: 'partner', label: 'Sou loja / empresa', desc: 'Quero listar produtos e serviços no marketplace', emoji: '🏪' },
]

export function OnboardingPage() {
  const { user, needsOnboarding, completeOnboarding } = useAuth()
  const navigate = useNavigate()
  const [role, setRole] = useState<Role>('customer')
  const [saving, setSaving] = useState(false)

  // Se não precisa de onboarding e já tem role definido, redirecionar
  if (!needsOnboarding && !saving && user?.status !== 'pending') {
    return <Navigate to={user ? getRoleHome(user.role) : '/'} replace />
  }

  async function handleContinue() {
    setSaving(true)
    await completeOnboarding(role)
    if (role === 'painter') {
      navigate('/seja-pintor', { replace: true })
    } else {
      navigate(getRoleHome(role), { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden p-8">
          {/* Avatar Koke */}
          <div className="text-center mb-6">
            <img src="/avatar_koke.jpeg" alt="Koke" className="w-16 h-16 rounded-full object-cover mx-auto mb-3 shadow-md" />
            <h1 className="text-xl font-bold text-gray-900">Olá! Como você vai usar a Pintai?</h1>
            <p className="text-sm text-gray-500 mt-1">
              {user?.name ? `${user.name.split(' ')[0]}, escolha` : 'Escolha'} seu perfil principal.
              Você pode adicionar mais depois.
            </p>
          </div>

          <div className="space-y-3 mb-6">
            {ROLE_OPTIONS.map((opt) => (
              <motion.button
                key={opt.value}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setRole(opt.value)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all text-left ${
                  role === opt.value
                    ? 'border-brand bg-orange-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <span className="text-2xl shrink-0">{opt.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{opt.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${
                  role === opt.value ? 'border-brand bg-brand' : 'border-gray-300'
                }`} />
              </motion.button>
            ))}
          </div>

          <motion.button
            onClick={handleContinue}
            disabled={saving}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="w-full py-3 bg-brand text-white font-bold rounded-xl hover:bg-brand-dark transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Configurando...' : 'Continuar →'}
          </motion.button>

          <p className="text-xs text-gray-400 text-center mt-4">
            Você pode ter múltiplos perfis — configure nas suas preferências depois.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
