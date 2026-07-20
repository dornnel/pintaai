// ─── Database types mirroring Supabase schema ────────────────────────────────

export type UserRole = 'admin' | 'customer' | 'painter' | 'artist' | 'partner'
export type UserStatus = 'active' | 'pending' | 'blocked' | 'archived'

export interface User {
  id: string
  role: UserRole
  roles?: string[]
  name: string
  phone: string
  email?: string
  cpf?: string
  auth_user_id?: string
  status: UserStatus
  created_at: string
  updated_at: string
}

export type CustomerType = 'residential' | 'commercial' | 'real_estate' | 'condominium'

export interface Customer {
  id: string
  user_id: string
  default_neighborhood_id?: string
  address_reference?: string
  customer_type: CustomerType
  notes?: string
  created_at: string
  user?: User
}

export type AvailabilityStatus = 'available' | 'busy' | 'paused'
export type VerificationStatus = 'unverified' | 'pending' | 'verified'
export type ProPlanStatus = 'none' | 'trial' | 'active' | 'canceled'

export interface Painter {
  id: string
  user_id: string
  bio: string
  years_experience: number
  specialties: string[]
  neighborhoods_ids: string[]
  has_transport: boolean
  accepts_material_included: boolean
  average_response_minutes: number
  base_price_m2?: number
  service_radius_km?: number
  availability_status: AvailabilityStatus
  verification_status: VerificationStatus
  pro_plan_status: ProPlanStatus
  pro_granted_by_admin: boolean
  portfolio_url?: string
  cpf?: string
  profile_photo_url?: string
  document_photo_url?: string
  selfie_with_doc_url?: string
  kyc_status: string
  kyc_reviewed_at?: string
  kyc_rejection_reason?: string
  registration_source?: string
  terms_accepted_at?: string
  privacy_accepted_at?: string
  lgpd_accepted_at?: string
  notify_by_email: boolean
  notify_by_whatsapp: boolean
  created_at: string
  last_seen_at?: string
  last_lead_received_at?: string
  active_leads_count?: number
  updated_at: string
  user?: User
  score?: PainterScore
}

export type RequestType = 'residential' | 'commercial' | 'facade' | 'post_construction' | 'artistic' | 'mural' | 'maintenance'
export type PropertyType = 'house' | 'apartment' | 'store' | 'restaurant' | 'bar' | 'studio' | 'airbnb' | 'condominium' | 'other'
export type WallCondition = 'good' | 'stains' | 'cracks' | 'peeling' | 'mold' | 'post_work' | 'unknown'
export type MaterialPreference = 'included' | 'customer_buys' | 'painter_suggests' | 'unknown'
export type RequestStatus =
  | 'draft'
  | 'briefing_ready'
  | 'sent_to_pros'
  | 'quoting'
  | 'options_sent'
  | 'connected'
  | 'in_progress'
  | 'completed'
  | 'canceled'

export interface ServiceRequest {
  id: string
  customer_id: string
  neighborhood_id: string
  request_type: RequestType
  property_type: PropertyType
  surface_type: string[]
  wall_condition: WallCondition
  estimated_area_m2?: number
  ai_price_min?: number
  ai_price_max?: number
  desired_deadline?: string
  material_preference: MaterialPreference
  finish_preference?: string
  ai_briefing: string
  ai_risk_notes?: string
  status: RequestStatus
  selected_quote_id?: string
  created_at: string
  updated_at: string
  customer?: Customer
  neighborhood?: Neighborhood
  media?: ServiceMedia[]
  quotes?: Quote[]
}

export type MediaType = 'photo' | 'video' | 'document'
export type BeforeAfterStage = 'before' | 'during' | 'after' | 'reference'

export interface ServiceMedia {
  id: string
  service_request_id: string
  uploaded_by_user_id: string
  media_type: MediaType
  storage_path: string
  public_url?: string
  ai_description?: string
  before_after_stage: BeforeAfterStage
  created_at: string
}

export type QuoteStatus = 'invited' | 'submitted' | 'shortlisted' | 'selected' | 'rejected' | 'expired' | 'canceled'
export type AIComparisonLabel = 'best_value' | 'fastest' | 'best_rated' | 'cheapest' | 'premium' | 'manual'

export interface Quote {
  id: string
  service_request_id: string
  provider_type: 'painter' | 'artist'
  provider_id: string
  total_price: number
  price_min?: number
  price_max?: number
  estimated_duration_days: number
  earliest_start_date?: string
  material_included: boolean
  payment_terms?: string
  warranty_days?: number
  notes?: string
  status: QuoteStatus
  ai_comparison_label?: AIComparisonLabel
  valid_until?: string
  created_at: string
  updated_at: string
  items?: QuoteItem[]
  painter?: Painter
}

export interface QuoteItem {
  id: string
  quote_id: string
  item_type: string
  description: string
  quantity?: number
  unit?: string
  unit_price?: number
  total_price?: number
  created_at: string
}

export interface Review {
  id: string
  service_request_id: string
  customer_id: string
  provider_type: 'painter' | 'artist'
  provider_id: string
  rating_overall: number
  rating_quality?: number
  rating_punctuality?: number
  rating_cleanliness?: number
  rating_communication?: number
  comment?: string
  sentiment_score?: number
  sentiment_label?: 'positive' | 'neutral' | 'negative' | 'mixed'
  ai_summary?: string
  created_at: string
}

export interface PainterScore {
  id: string
  painter_id: string
  overall_score: number
  quality_score: number
  punctuality_score: number
  response_score: number
  conversion_score: number
  sentiment_score: number
  cancellation_penalty: number
  completed_jobs_count: number
  reviews_count: number
  last_calculated_at: string
}

export interface Neighborhood {
  id: string
  city: string
  name: string
  region: string
  latitude?: number
  longitude?: number
  active: boolean
  launch_priority: number
}

export type MessageChannel = 'whatsapp' | 'instagram' | 'email' | 'system' | 'admin' | 'web'
export type MessageDirection = 'inbound' | 'outbound'

export interface Message {
  id: string
  service_request_id?: string
  session_id?: string
  sender_user_id?: string
  recipient_user_id?: string
  channel: MessageChannel
  direction: MessageDirection
  body: string
  media_url?: string
  ai_intent?: string
  metadata: Record<string, unknown>
  created_at: string
}

export type ModerationFlagType = 'offensive' | 'bypass_attempt' | 'ethics_violation' | 'spam'
export type ModerationSeverity = 'low' | 'medium' | 'high'
export type ModerationStatus = 'pending' | 'reviewed' | 'dismissed' | 'actioned'

export interface ModerationFlag {
  id: string
  message_id: string
  flag_type: ModerationFlagType
  severity: ModerationSeverity
  ai_explanation: string
  status: ModerationStatus
  reviewed_by?: string
  created_at: string
  message?: Message
}

// ─── Chat UI types ────────────────────────────────────────────────────────────

export type ChatRole = 'user' | 'client' | 'painter'

export interface ChatMessage {
  id: string
  role: 'agent' | 'user'
  content: string
  quickReplies?: string[]
  multiSelect?: boolean
  briefing?: BriefingData
  quotes?: Quote[]
  mediaUrls?: string[]
  cta?: { label: string; href: string }
  timestamp: Date
}

export interface BriefingData {
  resumo_cliente: string
  briefing_tecnico: string
  tipo_servico: string
  superficies: string[]
  estado_parede: string
  metragem_estimada_m2?: number
  confianca_metragem: 'baixa' | 'media' | 'alta'
  preco_min_estimado?: number
  preco_max_estimado?: number
  confianca_preco: 'baixa' | 'media' | 'alta'
  materiais_recomendados: string[]
  perguntas_faltantes: string[]
  riscos: string[]
  observacoes_para_pintor: string
}

export interface Product {
  id: string
  partner_id: string
  name: string
  description?: string
  category: string
  brand?: string
  sku?: string
  price?: number
  commission_rate?: number
  active: boolean
  featured: boolean
  origin: 'pintai' | 'partner'
  approval_status: 'pending' | 'approved' | 'rejected'
  images: string[]
  stock_quantity: number
  unit: string
  tags: string[]
  sort_order: number
  // ML fields
  ml_item_id?: string
  ml_permalink?: string
  ml_thumbnail?: string
  created_at: string
}

export interface Partner {
  id: string
  user_id?: string
  partner_type: string
  trade_name: string
  legal_name?: string
  cnpj?: string
  description?: string
  logo_url?: string
  website?: string
  neighborhood_id?: string
  contact_phone: string
  commission_rate?: number
  coupon_code?: string
  status: string
  accepts_online_orders: boolean
  delivery_radius_km: number
  min_order_value?: number
  verified_at?: string
  created_at: string
}

export interface ProductCombo {
  id: string
  partner_id?: string
  name: string
  description?: string
  image_url?: string
  original_price: number
  combo_price: number
  discount_pct?: number
  active: boolean
  featured: boolean
  valid_from: string
  valid_until?: string
  created_at: string
  items?: ProductComboItem[]
}

export interface ProductComboItem {
  id: string
  combo_id: string
  product_id: string
  quantity: number
  unit_price?: number
  product?: Product
}

export interface Promotion {
  id: string
  partner_id?: string
  name: string
  description?: string
  promo_type: 'percent_off' | 'fixed_off' | 'free_shipping' | 'buy_x_get_y' | 'coupon'
  discount_value?: number
  coupon_code?: string
  min_order_value?: number
  max_uses?: number
  uses_count: number
  applies_to: string
  applies_to_ids: string[]
  active: boolean
  valid_from: string
  valid_until?: string
  created_at: string
}

export interface ConversationSession {
  id: string
  session_id: string
  user_identifier: string
  channel: MessageChannel
  role_detected?: ChatRole
  current_state: string
  service_request_id?: string
  collected_data: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ─── Motor de Orçamento IA ────────────────────────────────────────────────────

export interface BudgetPricingRule {
  id: string
  service_type: string
  label: string
  min_price_m2: number
  max_price_m2: number
  active: boolean
  sort_order: number
}

export interface BudgetComplexityRule {
  id: string
  key: string
  label: string
  multiplier: number
  active: boolean
  sort_order: number
}

export interface BudgetAiAdjustment {
  id: string
  lead_id: string
  field_adjusted: string
  ai_value?: string
  painter_value?: string
  difference_percent?: number
  error_category?: string
  reason?: string
  created_by: string
  created_at: string
}

export interface AgentKnowledgeEntry {
  id: string
  title: string
  content: string
  source_type: string
  related_lead_id?: string
  active: boolean
  created_at: string
}
