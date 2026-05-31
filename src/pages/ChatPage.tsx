import { ChatInterface } from '../components/chat/ChatInterface'

export function ChatPage() {
  return (
    <div
      className="h-full"
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
