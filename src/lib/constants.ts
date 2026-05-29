export const NEIGHBORHOODS = [
  { id: 'campeche', name: 'Campeche', region: 'Sul da Ilha', priority: 1 },
  { id: 'rio-tavares', name: 'Rio Tavares', region: 'Sul da Ilha', priority: 1 },
  { id: 'morro-das-pedras', name: 'Morro das Pedras', region: 'Sul da Ilha', priority: 1 },
  { id: 'armacao', name: 'Armação', region: 'Sul da Ilha', priority: 1 },
  { id: 'pantano-do-sul', name: 'Pântano do Sul', region: 'Sul da Ilha', priority: 1 },
  { id: 'tapera', name: 'Tapera', region: 'Sul da Ilha', priority: 1 },
  { id: 'costeira', name: 'Costeira', region: 'Sul da Ilha', priority: 1 },
  { id: 'ribeirao-da-ilha', name: 'Ribeirão da Ilha', region: 'Sul da Ilha', priority: 2 },
  { id: 'carianos', name: 'Carianos', region: 'Sul da Ilha', priority: 2 },
] as const

export const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Apartamento' },
  { value: 'house', label: 'Casa' },
  { value: 'store', label: 'Loja / Comércio' },
  { value: 'restaurant', label: 'Restaurante / Bar' },
  { value: 'airbnb', label: 'Airbnb / Temporada' },
  { value: 'studio', label: 'Studio / Coworking' },
  { value: 'condominium', label: 'Condomínio' },
  { value: 'other', label: 'Outro' },
] as const

export const SERVICE_TYPES = [
  { value: 'residential', label: 'Pintura residencial' },
  { value: 'commercial', label: 'Pintura comercial' },
  { value: 'facade', label: 'Fachada' },
  { value: 'post_construction', label: 'Pós-obra' },
  { value: 'maintenance', label: 'Manutenção / Reparo' },
  { value: 'artistic', label: 'Arte / Mural' },
] as const

export const WALL_CONDITIONS = [
  { value: 'good', label: 'Bom estado' },
  { value: 'stains', label: 'Manchas' },
  { value: 'cracks', label: 'Rachaduras' },
  { value: 'peeling', label: 'Descascando' },
  { value: 'mold', label: 'Mofo' },
  { value: 'post_work', label: 'Pós-obra (reboco novo)' },
  { value: 'unknown', label: 'Não sei' },
] as const

export const REQUEST_STATUSES = {
  draft: { label: 'Rascunho', color: 'bg-gray-100 text-gray-600' },
  briefing_ready: { label: 'Briefing pronto', color: 'bg-blue-100 text-blue-700' },
  sent_to_pros: { label: 'Enviado aos pintores', color: 'bg-indigo-100 text-indigo-700' },
  quoting: { label: 'Cotando', color: 'bg-yellow-100 text-yellow-700' },
  options_sent: { label: 'Opções enviadas', color: 'bg-orange-100 text-orange-700' },
  connected: { label: 'Conectado', color: 'bg-green-100 text-green-700' },
  in_progress: { label: 'Em execução', color: 'bg-teal-100 text-teal-700' },
  completed: { label: 'Concluído', color: 'bg-emerald-100 text-emerald-700' },
  canceled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
} as const

export const WHATSAPP_NUMBER = '5548999999999'
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`

export const AGENT_INTRO = `Oi! Sou o assistente da **Pintai Floripa** 🎨

Vou te ajudar a receber até **3 orçamentos comparáveis** de pintores próximos ao seu bairro.

Para começar: você é **cliente** buscando pintura ou **pintor** querendo receber pedidos?`
