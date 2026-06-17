import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export interface PlatformSettings {
  registration_open: boolean
  marketplace_active: boolean
  chat_public: boolean
  budget_engine_enabled: boolean
  auto_assign_painters_geo: boolean
  auto_assign_radius_km_default: number
  platform_fee_rate: number
  minimum_job_price: number
  whatsapp_number: string
  admin_email: string
}

const DEFAULTS: PlatformSettings = {
  registration_open: true,
  marketplace_active: true,
  chat_public: true,
  budget_engine_enabled: false,
  auto_assign_painters_geo: false,
  auto_assign_radius_km_default: 10,
  platform_fee_rate: 0.08,
  minimum_job_price: 350,
  whatsapp_number: '5548991813090',
  admin_email: 'andre@agenscia.com',
}

let _cache: PlatformSettings | null = null
let _cacheAt = 0
const CACHE_TTL = 5 * 60 * 1000

function parse(rows: { key: string; value: unknown }[]): PlatformSettings {
  const map: Record<string, unknown> = {}
  for (const row of rows) {
    let v = row.value
    if (typeof v === 'string') {
      try { v = JSON.parse(v) } catch { /* keep as string */ }
    }
    map[row.key] = v
  }
  return { ...DEFAULTS, ...map } as PlatformSettings
}

export async function loadPlatformSettings(): Promise<PlatformSettings> {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL) return _cache
  const { data } = await supabase.from('platform_settings').select('key, value')
  const settings = parse(data ?? [])
  _cache = settings
  _cacheAt = Date.now()
  return settings
}

export function invalidatePlatformSettingsCache() {
  _cache = null
  _cacheAt = 0
}

export function usePlatformSettings(): { settings: PlatformSettings; loading: boolean } {
  const [settings, setSettings] = useState<PlatformSettings>(_cache ?? DEFAULTS)
  const [loading, setLoading] = useState(!_cache)

  useEffect(() => {
    loadPlatformSettings().then(s => { setSettings(s); setLoading(false) })
  }, [])

  return { settings, loading }
}
