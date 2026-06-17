import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { Search, Star, Paintbrush, ShieldCheck, ArrowRight, Zap, Filter } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface PainterListing {
  id: string
  user_id: string
  bio?: string
  years_experience: number
  specialties: string[]
  neighborhoods_ids: string[]
  base_price_m2?: number
  availability_status: string
  verification_status: string
  portfolio_url?: string
  user: { name: string; email: string }
  score?: {
    overall_score: number
    quality_score: number
    punctuality_score: number
    completed_jobs_count: number
    reviews_count: number
  }
}

const SPECIALTIES_LABELS: Record<string, string> = {
  'Pintura interna': 'Interna',
  'Fachada': 'Fachada',
  'Textura / massa corrida': 'Textura',
  'Impermeabilização': 'Impermeab.',
  'Arte / mural': 'Arte / Mural',
  'Geral (todos)': 'Geral',
  'Pós-obra': 'Pós-obra',
}

const NEIGHBORHOODS = [
  'Campeche', 'Rio Tavares', 'Armação', 'Morro das Pedras',
  'Pântano do Sul', 'Costeira', 'Ribeirão da Ilha', 'Tapera',
]

function PainterCard({ painter }: { painter: PainterListing }) {
  const score = painter.score?.overall_score || 0
  const jobs = painter.score?.completed_jobs_count || 0
  const reviews = painter.score?.reviews_count || 0
  const initials = painter.user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4, boxShadow: '0 20px 48px rgba(0,0,0,0.08)' }}
      className="bg-white rounded-2xl border border-gray-100 p-5 transition-all">

      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white text-xl font-black shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-gray-900 leading-tight truncate">{painter.user.name}</h3>
            {painter.verification_status === 'verified' && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-brand bg-orange-50 px-2 py-0.5 rounded-full shrink-0">
                <ShieldCheck className="w-3 h-3" /> Verificado
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {score > 0 && (
              <div className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                <span className="text-sm font-bold text-gray-900">{score.toFixed(1)}</span>
                {reviews > 0 && <span className="text-xs text-gray-400">({reviews})</span>}
              </div>
            )}
            {jobs > 0 && (
              <span className="text-xs text-gray-500">{jobs} job{jobs !== 1 ? 's' : ''}</span>
            )}
            {painter.years_experience > 0 && (
              <span className="text-xs text-gray-500">{painter.years_experience} ano{painter.years_experience !== 1 ? 's' : ''} exp.</span>
            )}
          </div>
        </div>
      </div>

      {/* Bio */}
      {painter.bio && (
        <p className="text-sm text-gray-600 leading-relaxed mb-3 line-clamp-2">{painter.bio}</p>
      )}

      {/* Especialidades */}
      {painter.specialties.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {painter.specialties.slice(0, 4).map(s => (
            <span key={s} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {SPECIALTIES_LABELS[s] || s}
            </span>
          ))}
          {painter.specialties.length > 4 && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
              +{painter.specialties.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1 text-xs text-gray-400">
          {painter.availability_status === 'available' && (
            <><Zap className="w-3.5 h-3.5 text-emerald-500" /><span className="text-emerald-600 font-medium">Disponível</span></>
          )}
          {painter.base_price_m2 && (
            <span className="ml-2 text-gray-400">A partir de R${painter.base_price_m2}/m²</span>
          )}
        </div>
        <Link
          to={`/chat?q=${encodeURIComponent(`Quero um orçamento com ${painter.user.name.split(' ')[0]}, pintor verificado`)}`}
          className="flex items-center gap-1.5 text-xs font-bold text-brand hover:text-brand-dark transition-colors">
          Solicitar <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </motion.div>
  )
}

export function PaintersDirectoryPage() {
  const [params, setParams] = useSearchParams()
  const [painters, setPainters] = useState<PainterListing[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(params.get('q') || '')
  const [specialty, setSpecialty] = useState(params.get('specialty') || '')
  const [neighborhood, setNeighborhood] = useState(params.get('bairro') || '')
  const [showFilters, setShowFilters] = useState(false)

  const loadPainters = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('painters')
      .select(`
        id, user_id, bio, years_experience, specialties, neighborhoods_ids,
        base_price_m2, availability_status, verification_status, portfolio_url,
        user:users!painters_user_id_fkey(name, email),
        score:painter_scores(overall_score, quality_score, punctuality_score, completed_jobs_count, reviews_count)
      `)
      .neq('availability_status', 'paused')
      .order('created_at', { ascending: false })

    let results = (data || []) as unknown as PainterListing[]

    if (search) {
      const q = search.toLowerCase()
      results = results.filter(p =>
        p.user.name.toLowerCase().includes(q) ||
        p.bio?.toLowerCase().includes(q) ||
        p.specialties.some(s => s.toLowerCase().includes(q))
      )
    }
    if (specialty) {
      results = results.filter(p =>
        p.specialties.some(s => s.toLowerCase().includes(specialty.toLowerCase()))
      )
    }

    // Sort by score desc, then verified
    results.sort((a, b) => {
      const verified = (b.verification_status === 'verified' ? 1 : 0) - (a.verification_status === 'verified' ? 1 : 0)
      if (verified !== 0) return verified
      return (b.score?.overall_score || 0) - (a.score?.overall_score || 0)
    })

    setPainters(results)
    setLoading(false)
  }, [search, specialty, neighborhood])

  useEffect(() => { loadPainters() }, [loadPainters])

  function applyFilters() {
    const p: Record<string, string> = {}
    if (search) p.q = search
    if (specialty) p.specialty = specialty
    if (neighborhood) p.bairro = neighborhood
    setParams(p)
    setShowFilters(false)
    loadPainters()
  }

  const allSpecialties = Object.keys(SPECIALTIES_LABELS)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <Link to="/" className="text-gray-400 hover:text-brand transition-colors">
              <ArrowRight className="w-4 h-4 rotate-180" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Pintores verificados</h1>
              <p className="text-xs text-gray-500">Florianópolis · Sul da Ilha</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyFilters()}
                placeholder="Buscar por nome ou especialidade..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand bg-gray-50" />
            </div>
            <button onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${showFilters ? 'bg-brand text-white border-brand' : 'border-gray-200 text-gray-600 hover:border-brand'}`}>
              <Filter className="w-4 h-4" /> Filtros
            </button>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="mt-3 space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Especialidade</p>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setSpecialty('')}
                    className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${!specialty ? 'bg-brand text-white border-brand' : 'border-gray-200 text-gray-600'}`}>
                    Todas
                  </button>
                  {allSpecialties.map(s => (
                    <button key={s} onClick={() => setSpecialty(s === specialty ? '' : s)}
                      className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${specialty === s ? 'bg-brand text-white border-brand' : 'border-gray-200 text-gray-600'}`}>
                      {SPECIALTIES_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Bairro</p>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setNeighborhood('')}
                    className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer ${!neighborhood ? 'bg-brand text-white border-brand' : 'border-gray-200 text-gray-600'}`}>
                    Todos
                  </button>
                  {NEIGHBORHOODS.map(n => (
                    <button key={n} onClick={() => setNeighborhood(n === neighborhood ? '' : n)}
                      className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer ${neighborhood === n ? 'bg-brand text-white border-brand' : 'border-gray-200 text-gray-600'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={applyFilters}
                className="w-full py-2.5 bg-brand text-white text-sm font-semibold rounded-xl cursor-pointer hover:bg-brand-dark transition-colors">
                Aplicar filtros
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Resultados */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-48 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
          </div>
        ) : painters.length === 0 ? (
          <div className="text-center py-16">
            <Paintbrush className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Nenhum pintor encontrado</p>
            <p className="text-sm text-gray-400 mt-1">Tente ajustar os filtros</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              <span className="font-semibold text-gray-900">{painters.length}</span> pintor{painters.length !== 1 ? 'es' : ''} encontrado{painters.length !== 1 ? 's' : ''}
              {specialty && <> · <span className="text-brand">{SPECIALTIES_LABELS[specialty] || specialty}</span></>}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {painters.map(p => <PainterCard key={p.id} painter={p} />)}
            </div>
          </>
        )}

        {/* CTA para pintores */}
        <div className="mt-10 bg-gray-900 rounded-2xl p-6 text-center">
          <p className="text-white font-bold text-lg mb-1">Você é pintor?</p>
          <p className="text-white/60 text-sm mb-4">Receba leads qualificados com briefing técnico. Sem visita desnecessária.</p>
          <Link to="/seja-pintor"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-brand-dark transition-colors text-sm">
            Cadastrar como pintor <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
