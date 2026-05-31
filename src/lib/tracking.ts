export interface TrackingData {
  ip?: string
  city?: string
  country?: string
  browser?: string
  os?: string
  device?: string
  referrer?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  landing_page?: string
  first_visit_at?: string
}

const STORAGE_KEY = 'pintae_tracking'

function detectDevice(): string {
  const ua = navigator.userAgent
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile'
  return 'desktop'
}

function detectOS(): string {
  const ua = navigator.userAgent
  if (/windows/i.test(ua)) return 'Windows'
  if (/mac os/i.test(ua)) return 'macOS'
  if (/android/i.test(ua)) return 'Android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS'
  if (/linux/i.test(ua)) return 'Linux'
  return 'Unknown'
}

export async function captureTracking(): Promise<TrackingData> {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try { return JSON.parse(stored) } catch { /* re-capture */ }
  }

  const params = new URLSearchParams(window.location.search)
  const consent = localStorage.getItem('pintae_cookie_consent')

  const base: TrackingData = {
    referrer: document.referrer || undefined,
    utm_source: params.get('utm_source') || undefined,
    utm_medium: params.get('utm_medium') || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
    utm_term: params.get('utm_term') || undefined,
    utm_content: params.get('utm_content') || undefined,
    landing_page: window.location.pathname + window.location.search,
    browser: navigator.userAgent.slice(0, 150),
    os: detectOS(),
    device: detectDevice(),
    first_visit_at: new Date().toISOString(),
  }

  if (consent === 'all') {
    try {
      const r = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) })
      const geo = await r.json()
      base.ip = geo.ip
      base.city = geo.city
      base.country = geo.country_name
    } catch { /* silencioso */ }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(base))
  return base
}

export function getStoredTracking(): TrackingData | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return null
  try { return JSON.parse(stored) } catch { return null }
}

export function clearTracking() {
  localStorage.removeItem(STORAGE_KEY)
}
