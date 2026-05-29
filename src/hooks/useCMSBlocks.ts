import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Default fallback values (same as hardcoded in LandingPage)
const DEFAULTS: Record<string, unknown> = {
  hero_title: 'O pintor certo para o seu espaço.',
  hero_subtitle: 'Pare de contratar às cegas. IA analisa seu projeto, profissionais verificados respondem.',
  cta_primary: 'Encontrar meu pintor',
  cta_secondary: 'Ver como funciona',
  before_after_1: {
    before: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=600&q=80',
    after: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80',
    label: 'Sala · Campeche',
  },
  before_after_2: {
    before: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600&q=80',
    after: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80',
    label: 'Fachada · Rio Tavares',
  },
  before_after_3: {
    before: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&q=80',
    after: 'https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=600&q=80',
    label: 'Apartamento · Armação',
  },
  stats: [
    { value: '200+', label: 'pintores ativos' },
    { value: '1.200+', label: 'serviços concluídos' },
    { value: '4.8★', label: 'avaliação média real' },
  ],
  pain_points: [
    { text: 'Pintor sem histórico verificado' },
    { text: 'Preço sem nenhuma base técnica' },
    { text: 'Você no escuro sem referência' },
  ],
}

const CACHE_KEY = 'pintai_cms_blocks'
const CACHE_TTL = 3600 * 1000 // 1 hour

type CMSBlocks = Record<string, unknown>

export function useCMSBlocks() {
  const [blocks, setBlocks] = useState<CMSBlocks>(DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Try localStorage cache first
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const { data, ts } = JSON.parse(cached)
        if (Date.now() - ts < CACHE_TTL) {
          setBlocks({ ...DEFAULTS, ...data })
          setLoading(false)
          return
        }
      }
    } catch { /* ignore */ }

    // Fetch from DB
    supabase.from('cms_blocks').select('block_key, content').then(({ data }) => {
      if (data && data.length > 0) {
        const fromDB: CMSBlocks = {}
        data.forEach((row: { block_key: string; content: unknown }) => {
          // Unwrap JSON strings (text blocks are stored as "\"value\"")
          const val = row.content
          fromDB[row.block_key] = typeof val === 'string' && val.startsWith('"') ? JSON.parse(val) : val
        })
        const merged = { ...DEFAULTS, ...fromDB }
        setBlocks(merged)
        // Cache
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: fromDB, ts: Date.now() }))
        } catch { /* ignore */ }
      }
      setLoading(false)
    })
  }, [])

  function get<T>(key: string): T {
    return (blocks[key] ?? DEFAULTS[key]) as T
  }

  return { blocks, loading, get }
}
