import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { ChatInterface } from '../components/chat/ChatInterface'
import { useAuth } from '../lib/auth'
import { usePlatformSettings } from '../lib/usePlatformSettings'
import { Lock } from 'lucide-react'

export function ChatPage() {
  const { user } = useAuth()
  const { settings, loading } = usePlatformSettings()
  const navigate = useNavigate()

  const blocked = !loading && !settings.chat_public && !user

  useEffect(() => {
    if (blocked) navigate('/login', { replace: true })
  }, [blocked, navigate])

  if (loading) return null

  if (blocked) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Lock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Chat disponível apenas para usuários logados.</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex-1 min-h-0 flex flex-col overflow-hidden"
      style={{
        background: [
          'radial-gradient(ellipse at 88% 8%, rgba(227,90,26,0.07) 0%, transparent 50%)',
          'radial-gradient(ellipse at 12% 92%, rgba(255,160,80,0.05) 0%, transparent 50%)',
          '#f9f7f5',
        ].join(', '),
      }}
    >
      <ChatInterface />
    </div>
  )
}
