import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Pencil, CheckCircle, Loader2, MapPin } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePainterContext } from './PainterLayout'
import { cn } from '../../lib/utils'
import { PainterAreaMap } from '../../components/PainterAreaMap'
import type { Neighborhood } from '../../lib/types'

const SPECIALTY_OPTIONS = [
  'Residencial', 'Comercial', 'Fachada', 'Pós-obra', 'Artístico',
  'Mural', 'Textura', 'Grafiato', 'Stencil', 'Epóxi',
]

export function PainterPerfil() {
  const { painter, loading, reload, saveAvailability } = usePainterContext()

  const [bio, setBio] = useState(painter?.bio || '')
  const [years, setYears] = useState(String(painter?.years_experience || 0))
  const [specialties, setSpecialties] = useState<string[]>(painter?.specialties || [])
  const [availability, setAvailability] = useState(painter?.availability_status || 'available')
  const [basePrice, setBasePrice] = useState(String(painter?.base_price_m2 || ''))
  const [radiusKm, setRadiusKm] = useState(String(painter?.service_radius_km ?? 10))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([])

  useEffect(() => {
    supabase.from('neighborhoods').select('id,name,city,region,latitude,longitude,active,launch_priority')
      .eq('active', true).order('name')
      .then(({ data }) => setNeighborhoods((data as Neighborhood[]) ?? []))
  }, [])

  // Re-initialize state if painter loads after mount
  if (painter && bio === '' && painter.bio) setBio(painter.bio)

  function toggleSpecialty(s: string) {
    setSpecialties(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!painter) return
    setSaving(true)
    await supabase.from('painters').update({
      bio,
      years_experience: parseInt(years) || 0,
      specialties,
      availability_status: availability,
      base_price_m2: parseFloat(basePrice) || null,
      service_radius_km: parseFloat(radiusKm) || 10,
    }).eq('id', painter.id)
    // Sync availability through context (keeps sidebar toggle in sync)
    if (availability !== painter.availability_status) {
      await saveAvailability(availability as 'available' | 'busy' | 'paused')
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => { setSaved(false); reload() }, 1500)
  }

  if (loading || !painter) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Meu Perfil</h1>
        <p className="text-gray-500 text-sm mt-0.5">Mantenha seus dados atualizados para atrair mais clientes.</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <form onSubmit={save} className="space-y-4">
          {/* Availability */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <label className="text-xs font-medium text-gray-600 mb-2 block">Disponibilidade</label>
            <div className="flex gap-2">
              {(['available', 'busy', 'paused'] as const).map(s => (
                <button key={s} type="button" onClick={() => setAvailability(s)}
                  className={cn('flex-1 py-2 text-xs font-medium rounded-xl border transition-colors cursor-pointer',
                    availability === s
                      ? s === 'available' ? 'bg-green-50 text-green-700 border-green-200'
                        : s === 'busy' ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        : 'bg-gray-100 text-gray-600 border-gray-200'
                      : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200')}>
                  {s === 'available' ? 'Disponível' : s === 'busy' ? 'Ocupado' : 'Pausado'}
                </button>
              ))}
            </div>
          </div>

          {/* Bio + experience */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Bio</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand resize-none"
                placeholder="Conte sobre seu trabalho e experiência..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Anos de experiência</label>
                <input type="number" value={years} onChange={e => setYears(e.target.value)} min="0"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Preço base (R$/m²)</label>
                <input type="number" value={basePrice} onChange={e => setBasePrice(e.target.value)} step="0.5"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" placeholder="25" />
              </div>
            </div>
          </div>

          {/* Specialties */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <label className="text-xs font-medium text-gray-600 mb-2 block">Especialidades</label>
            <div className="flex flex-wrap gap-2">
              {SPECIALTY_OPTIONS.map(s => (
                <button key={s} type="button" onClick={() => toggleSpecialty(s)}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                    specialties.includes(s)
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-brand hover:text-brand')}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Área de atendimento (mapa) */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand" />
              <p className="text-xs font-medium text-gray-700">Área de atendimento</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Raio de atendimento (km) a partir dos bairros selecionados
              </label>
              <input
                type="number" value={radiusKm} onChange={e => setRadiusKm(e.target.value)}
                min="1" max="100" step="1"
                className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand"
              />
            </div>
            {painter?.neighborhoods_ids?.length > 0 ? (
              <PainterAreaMap
                neighborhoods={neighborhoods}
                painterNeighborhoodIds={painter.neighborhoods_ids}
                radiusKm={parseFloat(radiusKm) || 10}
              />
            ) : (
              <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-4 text-center">
                Nenhum bairro selecionado ainda. O mapa aparecerá aqui após você definir sua área no cadastro.
              </p>
            )}
          </div>

          <motion.button type="submit" disabled={saving}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="w-full py-3 bg-brand text-white font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
            {saved ? 'Salvo!' : 'Salvar perfil'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  )
}
