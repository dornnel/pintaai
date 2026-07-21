import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface Props {
  title?: string
  subtitle?: string
  showBack?: boolean
  showLogo?: boolean
  rightAction?: React.ReactNode
  transparent?: boolean
}

export function MobileHeader({ title, subtitle, showBack, showLogo, rightAction, transparent }: Props) {
  const navigate = useNavigate()

  return (
    <header
      className={`shrink-0 border-b ${transparent ? 'bg-transparent border-transparent' : 'bg-white/95 backdrop-blur-sm border-gray-100'}`}
      style={{ zIndex: 20 }}
    >
      <div
        className="flex items-center gap-3 px-4"
        style={{
          height: 52,
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center text-gray-600 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        {showLogo && (
          <span className="text-base font-bold text-brand shrink-0">Pinte Rápido</span>
        )}

        {title && (
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm leading-none truncate">{title}</p>
            {subtitle && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        )}

        {!title && !showLogo && <div className="flex-1" />}

        {rightAction && <div className="shrink-0">{rightAction}</div>}
      </div>
    </header>
  )
}
