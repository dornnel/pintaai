import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ChevronDown, ChevronUp, MapPin, CheckCircle, Clock,
  MessageSquare, User, Phone, Paintbrush, Plus,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCustomerContext, type CustomerLead } from './CustomerLayout'
import { cn, formatDate, formatCurrency } from '../../lib/utils'

type Interaction = CustomerLead['lead_painter_interactions'][number]

function ProposalCard({
  interaction,
  onSelect,
}: {
  interaction: Interaction
  onSelect: (id: string) => void
}) {
  const painter = interaction.painter
  const quote = interaction.metadata?.quote
  const isAccepted = interaction.status === 'accepted'

  if (interaction.status !== 'proposal_sent' && !isAccepted) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4',
        isAccepted ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-white',
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm truncate">
            {isAccepted ? painter?.user?.name ?? 'Pintor' : `Pintor ${painter?.specialties?.[0] ?? 'Qualificado'}`}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {painter?.years_experience ? (
              <span className="text-xs text-gray-400">{painter.years_experience} anos de exp.</span>
            ) : null}
            {painter?.kyc_status === 'approved' && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">Verificado</span>
            )}
          </div>
        </div>
        {isAccepted && (
          <span className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-medium shrink-0 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Contratado
          </span>
        )}
      </div>

      {painter?.specialties && painter.specialties.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {painter.specialties.slice(0, 3).map(s => (
            <span key={s} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{s}</span>
          ))}
        </div>
      )}

      {quote && (
        <div className="space-y-1.5 mb-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Preço total</span>
            <span className="font-bold text-gray-900">{formatCurrency(quote.total_price)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-400">Material</span>
            <span className="text-xs text-gray-700">{quote.includes_material ? 'Incluso' : 'Não incluso'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-400">Prazo de execução</span>
            <span className="text-xs text-gray-700">{quote.duration_days} dias</span>
          </div>
          {quote.payment_terms && (
            <div className="flex justify-between">
              <span className="text-xs text-gray-400">Pagamento</span>
              <span className="text-xs text-gray-700 text-right max-w-[60%]">{quote.payment_terms}</span>
            </div>
          )}
          {quote.notes && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-0.5">Obs. do pintor</p>
              <p className="text-xs text-gray-600">{quote.notes}</p>
            </div>
          )}
        </div>
      )}

      {isAccepted && painter?.user?.phone ? (
        <a
          href={`https://wa.me/55${painter.user.phone.replace(/\D/g, '')}?text=Olá! Vi sua proposta no Pintai e gostaria de agendar o serviço.`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors"
        >
          <Phone className="w-3.5 h-3.5" /> Abrir conversa no WhatsApp
        </a>
      ) : !isAccepted ? (
        <motion.button
          onClick={() => onSelect(interaction.id)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-2.5 bg-brand text-white text-sm font-semibold rounded-xl cursor-pointer"
        >
          Selecionar esta proposta
        </motion.button>
      ) : null}
    </motion.div>
  )
}

function LeadCard({ lead }: { lead: CustomerLead }) {
  const { selectProposal } = useCustomerContext()
  const [open, setOpen] = useState(false)
  const proposals = lead.lead_painter_interactions.filter(
    i => i.status === 'proposal_sent' || i.status === 'accepted'
  )
  const accepted = lead.lead_painter_interactions.find(i => i.status === 'accepted')

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start justify-between gap-3 p-5 cursor-pointer hover:bg-gray-50/50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-xs font-mono text-gray-400">{lead.protocol}</span>
            {accepted ? (
              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Contratado</span>
            ) : proposals.length > 0 ? (
              <span className="text-xs px-2 py-0.5 bg-brand/10 text-brand rounded-full font-medium">
                {proposals.length} proposta{proposals.length > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" /> Aguardando pintores
              </span>
            )}
          </div>
          <p className="font-medium text-gray-800 text-sm">
            {lead.service_interest ?? 'Pintura'}
            {lead.neighborhood ? ` · ${lead.neighborhood}` : ''}
          </p>
          {(lead.area_m2 || lead.num_rooms) && (
            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {lead.area_m2 ? `${lead.area_m2} m²` : ''}
              {lead.area_m2 && lead.num_rooms ? ' · ' : ''}
              {lead.num_rooms ? `${lead.num_rooms} cômodos` : ''}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-400">{formatDate(lead.created_at)}</p>
          <div className="mt-1">
            {open
              ? <ChevronUp className="w-4 h-4 text-gray-400 ml-auto" />
              : <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sua solicitação</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {lead.property_type && <><span className="text-gray-400">Imóvel</span><span className="text-gray-700">{lead.property_type}</span></>}
                  {lead.deadline && <><span className="text-gray-400">Prazo</span><span className="text-gray-700">{lead.deadline}</span></>}
                  {lead.material && <><span className="text-gray-400">Material</span><span className="text-gray-700">{lead.material}</span></>}
                  {lead.calc_price_min && lead.calc_price_max && (
                    <><span className="text-gray-400">Estimativa</span>
                    <span className="text-gray-700 font-medium">
                      {formatCurrency(lead.calc_price_min)} – {formatCurrency(lead.calc_price_max)}
                    </span></>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Propostas dos pintores ({proposals.length})
                </p>
                {proposals.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    Nenhuma proposta ainda. Os pintores estão avaliando sua solicitação.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lead.lead_painter_interactions.map(interaction => (
                      <ProposalCard
                        key={interaction.id}
                        interaction={interaction}
                        onSelect={(iId) => selectProposal(lead.id, iId)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function CustomerPedidos() {
  const { leads, loading } = useCustomerContext()

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Meus Pedidos</h1>
            <p className="text-gray-500 text-sm mt-1">Todos os seus pedidos de pintura.</p>
          </div>
          {leads.length > 0 && (
            <span className="text-xs text-gray-400">{leads.length} pedido{leads.length > 1 ? 's' : ''}</span>
          )}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        whileHover={{ scale: 1.01 }}>
        <Link to="/chat"
          className="flex items-center justify-between bg-brand rounded-2xl p-4 mb-6 group">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Plus className="w-4 h-4 text-white" />
            </div>
            <p className="font-semibold text-white text-sm">Fazer novo pedido</p>
          </div>
          <span className="text-white/70 text-xs group-hover:text-white transition-colors">Via chat com Koke →</span>
        </Link>
      </motion.div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Paintbrush className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Nenhum pedido ainda.</p>
          <p className="text-gray-400 text-xs mt-1">Use o chat para solicitar um orçamento grátis!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map(lead => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </div>
  )
}
