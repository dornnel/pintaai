import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Paintbrush, X } from 'lucide-react'

const PUBLIC_PATHS = ['/', '/chat', '/marketplace', '/seja-pintor', '/login']

export function ColorVisualizerFAB() {
  const location = useLocation()
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const isPublicPage = PUBLIC_PATHS.includes(location.pathname) ||
    location.pathname.startsWith('/pintura/') ||
    location.pathname === '/visualizar-cor'

  const shouldShow = isPublicPage && !dismissed && location.pathname !== '/visualizar-cor'

  useEffect(() => {
    if (!shouldShow) return
    const timer = setTimeout(() => setVisible(true), 2000)
    return () => clearTimeout(timer)
  }, [shouldShow])

  return (
    <AnimatePresence>
      {visible && shouldShow && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2"
        >
          {/* Dismiss button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            onClick={() => { setVisible(false); setDismissed(true) }}
            className="w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer shadow-sm"
          >
            <X className="w-3 h-3" />
          </motion.button>

          {/* FAB */}
          <Link to="/visualizar-cor">
            <motion.div
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2.5 px-4 py-3 rounded-2xl text-white cursor-pointer shadow-xl shadow-brand/30"
              style={{ background: 'linear-gradient(135deg, #FF7A30 0%, #E35A1A 100%)' }}
            >
              <motion.div animate={{ rotate: [0, -10, 10, -5, 0] }} transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}>
                <Paintbrush className="w-4 h-4" />
              </motion.div>
              <span className="text-sm font-semibold hidden sm:block">Simular cor</span>
            </motion.div>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
