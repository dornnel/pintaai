import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Cookie, X } from 'lucide-react'
import { Link } from 'react-router-dom'

const CONSENT_KEY = 'pintae_cookie_consent'

export type CookieConsent = 'all' | 'essential' | null

export function getCookieConsent(): CookieConsent {
  return (localStorage.getItem(CONSENT_KEY) as CookieConsent) || null
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY)
    if (!stored) setVisible(true)
  }, [])

  function accept(type: 'all' | 'essential') {
    localStorage.setItem(CONSENT_KEY, type)
    setVisible(false)
    // Disparar evento para que tracking.ts possa inicializar se consent='all'
    window.dispatchEvent(new CustomEvent('pintae:consent', { detail: type }))
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-20 sm:bottom-6 left-0 right-0 z-40 px-4 pointer-events-none"
        >
          <div className="max-w-2xl mx-auto bg-gray-900 text-white rounded-2xl shadow-2xl p-4 sm:p-5 pointer-events-auto border border-white/10">
            <div className="flex items-start gap-3">
              <Cookie className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold mb-1">Usamos cookies 🍪</p>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Utilizamos cookies para melhorar sua experiência, analisar o uso da plataforma e personalizar conteúdo.
                  Seus dados são protegidos pela{' '}
                  <Link to="/privacidade" className="text-amber-400 hover:underline">Política de Privacidade</Link>
                  {' '}e pela LGPD.
                </p>
              </div>
              <button onClick={() => accept('essential')} className="text-gray-400 hover:text-white cursor-pointer shrink-0 -mt-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 mt-3 ml-8">
              <button
                onClick={() => accept('essential')}
                className="px-4 py-2 text-xs font-medium border border-white/20 rounded-xl text-gray-300 hover:bg-white/10 cursor-pointer transition-colors"
              >
                Só essenciais
              </button>
              <button
                onClick={() => accept('all')}
                className="px-4 py-2 text-xs font-semibold bg-amber-400 text-gray-900 rounded-xl hover:bg-amber-300 cursor-pointer transition-colors"
              >
                Aceitar tudo
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
