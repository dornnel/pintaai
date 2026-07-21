import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  Calculator, Palette, Zap, Sparkles, ChevronRight, Lock,
  BarChart2, Upload, X, Loader2, ImageIcon, Crown,
} from 'lucide-react'
import { formatCurrency } from '../lib/utils'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

const BENCHMARK: Record<string, { m2Labor: [number, number]; m2Full: [number, number] }> = {
  'Pintura interna':   { m2Labor: [18, 32],  m2Full: [45, 80] },
  'Pintura externa':   { m2Labor: [22, 40],  m2Full: [50, 95] },
  'Fachada':           { m2Labor: [25, 50],  m2Full: [60, 110] },
  'Textura':           { m2Labor: [30, 60],  m2Full: [65, 120] },
  'Pós-obra':          { m2Labor: [25, 45],  m2Full: [55, 100] },
  'Arte / mural':      { m2Labor: [60, 150], m2Full: [80, 180] },
  'Impermeabilização': { m2Labor: [30, 65],  m2Full: [70, 130] },
}

const COMPLEXITY: Record<string, number> = {
  'Repintura simples': 1.0,
  'Pequenas manchas':  1.1,
  'Furos leves':       1.2,
  'Mofo ou umidade':   1.35,
  'Infiltração':       1.5,
}

// ── Estimativa IA Tool ──────────────────────────────────────────────────────
function EstimativaIA() {
  const [service, setService] = useState('Pintura interna')
  const [area, setArea] = useState('')
  const [withMaterial, setWithMaterial] = useState(false)
  const [condition, setCondition] = useState('Repintura simples')

  const ref = BENCHMARK[service]
  const mult = COMPLEXITY[condition] ?? 1
  const areaNum = parseFloat(area) || 0
  const base = withMaterial ? ref.m2Full : ref.m2Labor
  const min = areaNum > 0 ? Math.round(areaNum * base[0] * mult) : null
  const max = areaNum > 0 ? Math.round(areaNum * base[1] * mult) : null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Tipo de serviço</label>
          <select value={service} onChange={e => setService(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand bg-white">
            {Object.keys(BENCHMARK).map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Condição das paredes</label>
          <select value={condition} onChange={e => setCondition(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand bg-white">
            {Object.keys(COMPLEXITY).map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Área total (m²)</label>
        <input type="number" value={area} onChange={e => setArea(e.target.value)} placeholder="ex: 80"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
      </div>

      <label className="flex items-center gap-2 cursor-pointer py-1">
        <input type="checkbox" checked={withMaterial} onChange={e => setWithMaterial(e.target.checked)} className="w-4 h-4 accent-brand" />
        <span className="text-sm text-gray-700">Incluir material (tinta + massa)</span>
      </label>

      <AnimatePresence mode="wait">
        {min && max ? (
          <motion.div key="result" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
            <p className="text-xs text-orange-700 font-medium mb-1">Estimativa calculada</p>
            <p className="text-2xl font-bold text-brand">{formatCurrency(min)} – {formatCurrency(max)}</p>
            <div className="flex flex-wrap gap-x-3 mt-2 text-[11px] text-gray-500">
              <span>{areaNum} m²</span><span>·</span>
              <span>R${base[0]}–{base[1]}/m²</span>
              {mult > 1 && <><span>·</span><span>×{mult.toFixed(2)} complexidade</span></>}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Referência SINDUSCON-SC. Valor final é definido pelo pintor.</p>
          </motion.div>
        ) : (
          <motion.div key="empty" className="bg-gray-50 rounded-xl p-4 text-center">
            <BarChart2 className="w-6 h-6 text-gray-300 mx-auto mb-1" />
            <p className="text-xs text-gray-400">Informe a área para calcular</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── AI Preview Tool (Club only) ─────────────────────────────────────────────
function AIPreviewTool({ credits }: { credits: number }) {
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((f: File) => {
    setPhoto(f)
    setPhotoUrl(URL.createObjectURL(f))
    setResultUrl(null)
  }, [])

  async function generate() {
    if (!photo || !prompt.trim() || credits < 1) return
    setGenerating(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const formData = new FormData()
      formData.append('image', photo)
      formData.append('prompt', prompt)
      const { data, error: fnErr } = await supabase.functions.invoke('ai-room-preview', {
        body: formData,
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (fnErr || !data?.image_url) throw new Error('Erro ao gerar prévia. Tente novamente.')
      setResultUrl(data.image_url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado')
    }
    setGenerating(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Créditos disponíveis:</p>
        <span className="text-xs font-bold text-brand bg-orange-50 px-2.5 py-1 rounded-full">{credits} crédito{credits !== 1 ? 's' : ''}</span>
      </div>

      {/* Upload zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center cursor-pointer hover:border-brand/40 hover:bg-orange-50/30 transition-colors">
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        {photoUrl ? (
          <div className="relative">
            <img src={photoUrl} alt="Foto do ambiente" className="w-full h-36 object-cover rounded-xl" />
            <button onClick={e => { e.stopPropagation(); setPhoto(null); setPhotoUrl(null); setResultUrl(null) }}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-0.5 cursor-pointer">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 font-medium">Toque para enviar foto do ambiente</p>
            <p className="text-xs text-gray-400 mt-0.5">JPG, PNG — até 10MB</p>
          </>
        )}
      </div>

      {/* Prompt */}
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Descreva a pintura desejada</label>
        <input value={prompt} onChange={e => setPrompt(e.target.value)}
          placeholder="ex: paredes brancas fosco, teto cinza claro..."
          className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand" />
      </div>

      {error && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

      <button onClick={generate} disabled={!photo || !prompt.trim() || generating || credits < 1}
        className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl text-sm disabled:opacity-40 cursor-pointer hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
        {generating
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando prévia... (20–40s)</>
          : <><Sparkles className="w-4 h-4" /> Gerar prévia com IA — 1 crédito</>}
      </button>

      <AnimatePresence>
        {resultUrl && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <p className="text-xs font-semibold text-gray-700">Resultado:</p>
            <img src={resultUrl} alt="Prévia gerada por IA" className="w-full rounded-2xl" />
            <a href={resultUrl} download="previa-pinte-rapido.jpg"
              className="block text-center text-xs text-brand font-medium py-2 hover:underline">
              Baixar imagem
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────
interface UserProfile { is_club_member: boolean; club_credits: number }

export function FerramentasPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [expandedTool, setExpandedTool] = useState<string | null>('estimativa')

  // Fetch club status
  useState(() => {
    if (!user) { setProfileLoaded(true); return }
    supabase.from('users').select('is_club_member, club_credits')
      .eq('auth_user_id', user.id).maybeSingle()
      .then(({ data }) => { setProfile(data); setProfileLoaded(true) })
  })

  const isClub = profile?.is_club_member === true

  const FREE_TOOLS = [
    {
      id: 'estimativa',
      icon: Zap,
      iconColor: 'text-brand',
      iconBg: 'bg-orange-50',
      label: 'Estimativa de Orçamento IA',
      desc: 'Calcule o valor estimado do serviço em segundos com base em m², tipo e condição das paredes.',
      tag: 'Gratuito',
      tagColor: 'text-green-700 bg-green-50',
      inline: true,
    },
    {
      id: 'calculadora',
      icon: Calculator,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
      label: 'Calculadora de Tinta',
      desc: 'Descubra quantos litros de tinta comprar, quantas demãos aplicar e o custo por m².',
      tag: 'Gratuito',
      tagColor: 'text-green-700 bg-green-50',
      to: '/calculadora',
    },
    {
      id: 'visualizador',
      icon: Palette,
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-50',
      label: 'Visualizador de Cores',
      desc: 'Experimente centenas de cores nas suas paredes antes de decidir — sem precisar pintar.',
      tag: 'Gratuito',
      tagColor: 'text-green-700 bg-green-50',
      to: '/visualizar-cor',
    },
  ]

  function toggle(id: string) {
    setExpandedTool(prev => prev === id ? null : id)
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ferramentas</h1>
          <p className="text-gray-500 text-sm mt-0.5">Recursos gratuitos e exclusivos para sua pintura.</p>
        </div>
        {isClub && (
          <div className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
            <Crown className="w-3.5 h-3.5" /> CLUBE
          </div>
        )}
      </div>

      {/* Free tools */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Ferramentas gratuitas</p>
        {FREE_TOOLS.map(({ id, icon: Icon, iconColor, iconBg, label, desc, tag, tagColor, to, inline }) => (
          <motion.div key={id} layout className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <button
              onClick={() => inline ? toggle(id) : undefined}
              className={`w-full flex items-center gap-3 p-4 text-left ${inline ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-gray-900 text-sm">{label}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tagColor}`}>{tag}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{desc}</p>
              </div>
              {to ? (
                <Link to={to} className={`text-xs font-semibold ${iconColor} flex items-center gap-1 shrink-0 hover:underline`}>
                  Abrir <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <ChevronRight className={`w-4 h-4 text-gray-300 shrink-0 transition-transform ${expandedTool === id ? 'rotate-90' : ''}`} />
              )}
            </button>

            <AnimatePresence>
              {inline && expandedTool === id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden">
                  <div className="px-4 pb-4 border-t border-gray-50 pt-4">
                    <EstimativaIA />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Club tool */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Clube Pinte Rápido</p>
        <motion.div layout className="rounded-2xl border-2 overflow-hidden"
          style={{ borderColor: isClub ? '#7C3AED' : '#E5E7EB' }}>
          <button onClick={() => isClub ? toggle('ia-preview') : undefined}
            className={`w-full flex items-center gap-3 p-4 text-left ${isClub ? 'cursor-pointer' : 'cursor-default'}`}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-semibold text-gray-900 text-sm">Prévia com IA</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-purple-700 bg-purple-50">Clube</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Envie uma foto do ambiente e veja como ficará pintado antes mesmo de contratar.
              </p>
            </div>
            {isClub
              ? <ChevronRight className={`w-4 h-4 text-gray-300 shrink-0 transition-transform ${expandedTool === 'ia-preview' ? 'rotate-90' : ''}`} />
              : <Lock className="w-4 h-4 text-gray-300 shrink-0" />}
          </button>

          <AnimatePresence>
            {isClub && expandedTool === 'ia-preview' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                <div className="px-4 pb-4 border-t border-purple-100 pt-4">
                  <AIPreviewTool credits={profile?.club_credits ?? 0} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!isClub && profileLoaded && (
            <div className="px-4 pb-4 border-t border-gray-50 pt-4 bg-gray-50/50">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Transforme fotos em visualizações realistas com IA. Disponível para membros do Clube.
                  </p>
                </div>
                <Link to="/clube"
                  className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity cursor-pointer">
                  <Crown className="w-3.5 h-3.5" /> Assinar Clube
                </Link>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Club upsell banner for non-members */}
      {profileLoaded && !isClub && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 text-white">
          <div className="flex items-start gap-3 mb-3">
            <Crown className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-base mb-0.5">Clube Pinte Rápido</p>
              <p className="text-gray-400 text-xs leading-relaxed">
                Prévia com IA, pintores parceiros certificados, descontos em materiais e acompanhamento exclusivo da equipe.
                <strong className="text-white"> R$49/mês — 10 créditos de IA inclusos.</strong>
              </p>
            </div>
          </div>
          <Link to="/clube"
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-indigo-500 text-white font-semibold rounded-xl text-sm hover:opacity-90 transition-opacity cursor-pointer">
            <Sparkles className="w-4 h-4" /> Conhecer o Clube
          </Link>
        </motion.div>
      )}

      {/* AI Preview placeholder preview mockup */}
      {!isClub && (
        <div className="relative rounded-2xl overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1586105251261-72a756497a11?w=600&q=60"
            alt="Exemplo de prévia com IA"
            className="w-full h-40 object-cover blur-sm scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-gray-900/30 flex flex-col items-center justify-center gap-2">
            <ImageIcon className="w-6 h-6 text-white/60" />
            <p className="text-white text-xs font-semibold text-center px-4">
              Exemplo de prévia gerada por IA<br />
              <span className="text-white/60 font-normal">Exclusivo para membros do Clube</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
