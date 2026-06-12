import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Paintbrush, Loader2, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { cn } from '../lib/utils'

const SPECIALTIES_OPTIONS = ['Pintura interna', 'Fachada', 'Textura / massa corrida', 'Impermeabilização', 'Arte / Mural', 'Pós-obra']

interface NeighborhoodOption { id: string; name: string }

export function BecomePainterPage() {
  const { user, loading: authLoading, switchRole } = useAuth()
  const navigate = useNavigate()

  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodOption[]>([])
  const [bio, setBio] = useState('')
  const [yearsExperience, setYearsExperience] = useState(1)
  const [specialties, setSpecialties] = useState<string[]>([])
  const [neighborhoodIds, setNeighborhoodIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isPainter = !!user?.roles?.includes('painter')

  useEffect(() => {
    supabase.from('neighborhoods').select('id, name').eq('active', true).order('name')
      .then(({ data }) => setNeighborhoods((data as NeighborhoodOption[]) || []))
  }, [])

  useEffect(() => {
    if (!authLoading && user && isPainter) {
      navigate('/portal/pintor', { replace: true })
    }
  }, [authLoading, user, isPainter, navigate])

  function toggleSpecialty(s: string) {
    setSpecialties(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  function toggleNeighborhood(id: string) {
    setNeighborhoodIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (specialties.length === 0 || neighborhoodIds.length === 0) {
      setError('Selecione ao menos uma especialidade e um bairro de atuação.')
      return
    }
    setSaving(true)
    setError('')

    const { error: insertErr } = await supabase.from('painters').insert({
      user_id: user.id,
      bio: bio || null,
      years_experience: yearsExperience,
      specialties,
      neighborhoods_ids: neighborhoodIds,
      availability_status: 'available',
      verification_status: 'unverified',
    })

    if (insertErr) {
      setError('Não foi possível concluir o cadastro. Tente novamente.')
      setSaving(false)
      return
    }

    const newRoles = Array.from(new Set([...(user.roles || []), 'painter']))
    await supabase.from('users').update({ roles: newRoles }).eq('id', user.id)

    switchRole('painter')
    navigate('/portal/pintor', { replace: true })
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-brand animate-spin" />
      </div>
    )
  }

  // Deslogado → tela de cadastro com perfil pintor pré-selecionado
  if (!user) {
    return <Navigate to="/login?role=painter&tab=register" replace />
  }

  // Já é pintor → redireciona (efeito acima cuida disso, mas evita flash)
  if (isPainter) return null

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg">
        <div className="bg-white border border-gray-100 rounded-3xl shadow-xl shadow-black/5 overflow-hidden">
          <div className="px-8 pt-8 pb-2 flex flex-col items-center gap-2 text-center">
            <div className="w-11 h-11 rounded-2xl bg-brand flex items-center justify-center">
              <Paintbrush className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-brand">Torne-se um pintor parceiro</span>
            <p className="text-sm text-gray-400">Receba leads qualificados com briefing técnico, sem visita desnecessária.</p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Sobre você <span className="text-gray-400">(opcional)</span></label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
                placeholder="Conte sua experiência, especialidades, diferenciais..."
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand bg-gray-50 resize-none" />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Anos de experiência</label>
              <input type="number" min={0} max={50} value={yearsExperience}
                onChange={e => setYearsExperience(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand bg-gray-50" />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Especialidades</label>
              <div className="flex flex-wrap gap-2">
                {SPECIALTIES_OPTIONS.map(s => (
                  <button key={s} type="button" onClick={() => toggleSpecialty(s)}
                    className={cn('text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer',
                      specialties.includes(s) ? 'border-brand bg-orange-50 text-brand' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Bairros de atuação</label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {neighborhoods.map(n => (
                  <button key={n.id} type="button" onClick={() => toggleNeighborhood(n.id)}
                    className={cn('text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer',
                      neighborhoodIds.includes(n.id) ? 'border-brand bg-orange-50 text-brand' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
                    {n.name}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <motion.button type="submit" disabled={saving} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="w-full py-3 bg-brand text-white font-semibold rounded-xl hover:bg-brand-dark transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Concluir cadastro de pintor
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
