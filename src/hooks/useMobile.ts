import { useState, useEffect } from 'react'

export function useMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [isPWA, setIsPWA] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', check)
    setIsPWA(
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true
    )
    return () => window.removeEventListener('resize', check)
  }, [])

  return { isMobile, isPWA }
}
