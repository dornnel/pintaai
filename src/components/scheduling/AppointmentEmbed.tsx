import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Calendar, CheckCircle, Loader2 } from 'lucide-react'

interface Props {
  painterCalcomUsername: string
  serviceRequestId: string
  onBooked?: (bookingUid: string) => void
}

const CALCOM_BASE = import.meta.env.VITE_CALCOM_BASE_URL || 'https://cal.com'

export function AppointmentEmbed({ painterCalcomUsername, serviceRequestId, onBooked }: Props) {
  const [loading, setLoading] = useState(true)
  const [booked, setBooked] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const calUrl = `${CALCOM_BASE}/${painterCalcomUsername}?metadata[service_request_id]=${serviceRequestId}&embed=true&theme=light&brandColor=E35A1A&hideEventTypeDetails=true`

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      // Cal.com sends booking confirmation via postMessage
      if (e.data?.type === 'bookingSuccessful' || e.data?.type === 'BOOKING_SUCCESSFUL') {
        const uid = e.data?.data?.booking?.uid || e.data?.uid
        setBooked(true)
        if (uid) onBooked?.(uid)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onBooked])

  if (booked) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white border border-gray-100 rounded-2xl p-6 text-center max-w-sm">
        <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
        <p className="font-semibold text-gray-900 mb-1">Agendado!</p>
        <p className="text-xs text-gray-400">O pintor recebeu a confirmação. Você será notificado no dia do serviço.</p>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-100 rounded-2xl overflow-hidden max-w-sm w-full shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Calendar className="w-4 h-4 text-brand" />
        <p className="text-sm font-semibold text-gray-900">Agendar a pintura</p>
      </div>
      {loading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={calUrl}
        onLoad={() => setLoading(false)}
        className={`w-full border-0 transition-opacity ${loading ? 'opacity-0 h-0' : 'opacity-100'}`}
        style={{ height: loading ? 0 : 480 }}
        title="Agendar pintura"
      />
    </motion.div>
  )
}
