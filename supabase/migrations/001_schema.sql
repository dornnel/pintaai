-- All objects below are created in the "pintae" schema
-- Uses gen_random_uuid() (native PG 13+, no extension needed)
SET search_path TO pintae, public;

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('admin', 'customer', 'painter', 'artist', 'partner');
CREATE TYPE user_status AS ENUM ('active', 'pending', 'blocked', 'archived');
CREATE TYPE customer_type AS ENUM ('residential', 'commercial', 'real_estate', 'condominium');
CREATE TYPE availability_status AS ENUM ('available', 'busy', 'paused');
CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified');
CREATE TYPE pro_plan_status AS ENUM ('none', 'trial', 'active', 'canceled');
CREATE TYPE request_type AS ENUM ('residential', 'commercial', 'facade', 'post_construction', 'artistic', 'mural', 'maintenance');
CREATE TYPE property_type AS ENUM ('house', 'apartment', 'store', 'restaurant', 'bar', 'studio', 'airbnb', 'condominium', 'other');
CREATE TYPE wall_condition AS ENUM ('good', 'stains', 'cracks', 'peeling', 'mold', 'post_work', 'unknown');
CREATE TYPE material_preference AS ENUM ('included', 'customer_buys', 'painter_suggests', 'unknown');
CREATE TYPE request_status AS ENUM ('draft', 'briefing_ready', 'sent_to_pros', 'quoting', 'options_sent', 'connected', 'in_progress', 'completed', 'canceled');
CREATE TYPE media_type AS ENUM ('photo', 'video', 'document');
CREATE TYPE before_after_stage AS ENUM ('before', 'during', 'after', 'reference');
CREATE TYPE quote_status AS ENUM ('invited', 'submitted', 'shortlisted', 'selected', 'rejected', 'expired', 'canceled');
CREATE TYPE ai_comparison_label AS ENUM ('best_value', 'fastest', 'best_rated', 'cheapest', 'premium', 'manual');
CREATE TYPE provider_type AS ENUM ('painter', 'artist');
CREATE TYPE sentiment_label AS ENUM ('positive', 'neutral', 'negative', 'mixed');
CREATE TYPE partner_type AS ENUM ('paint_store', 'material_store', 'brand', 'architect', 'real_estate', 'condominium', 'other');
CREATE TYPE product_category AS ENUM ('paint', 'primer', 'brush', 'roller', 'tape', 'sandpaper', 'accessory', 'other');
CREATE TYPE commission_source AS ENUM ('service_success_fee', 'product_sale', 'ad_package', 'pro_plan', 'artistic_project');
CREATE TYPE commission_status AS ENUM ('pending', 'confirmed', 'paid', 'canceled');
CREATE TYPE message_channel AS ENUM ('whatsapp', 'instagram', 'email', 'system', 'admin', 'web');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE moderation_flag_type AS ENUM ('offensive', 'bypass_attempt', 'ethics_violation', 'spam');
CREATE TYPE moderation_severity AS ENUM ('low', 'medium', 'high');
CREATE TYPE moderation_status AS ENUM ('pending', 'reviewed', 'dismissed', 'actioned');

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE neighborhoods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL DEFAULT 'Florianópolis',
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  active BOOLEAN DEFAULT TRUE,
  launch_priority INTEGER DEFAULT 1
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL DEFAULT 'customer',
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  auth_user_id UUID,
  status user_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  default_neighborhood_id UUID REFERENCES neighborhoods(id),
  address_reference TEXT,
  customer_type customer_type DEFAULT 'residential',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE painters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT DEFAULT '',
  years_experience INTEGER DEFAULT 0,
  specialties TEXT[] DEFAULT '{}',
  neighborhoods_ids UUID[] DEFAULT '{}',
  has_transport BOOLEAN DEFAULT FALSE,
  accepts_material_included BOOLEAN DEFAULT TRUE,
  average_response_minutes INTEGER DEFAULT 60,
  base_price_m2 NUMERIC,
  availability_status availability_status DEFAULT 'available',
  verification_status verification_status DEFAULT 'unverified',
  pro_plan_status pro_plan_status DEFAULT 'none',
  portfolio_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  styles TEXT[] DEFAULT '{}',
  portfolio_url TEXT,
  neighborhoods_ids UUID[] DEFAULT '{}',
  minimum_project_price NUMERIC,
  accepts_commercial_murals BOOLEAN DEFAULT TRUE,
  accepts_graffiti_authorized BOOLEAN DEFAULT FALSE,
  availability_status availability_status DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id),
  request_type request_type NOT NULL DEFAULT 'residential',
  property_type property_type NOT NULL DEFAULT 'apartment',
  surface_type TEXT[] DEFAULT '{}',
  wall_condition wall_condition DEFAULT 'unknown',
  estimated_area_m2 NUMERIC,
  ai_price_min NUMERIC,
  ai_price_max NUMERIC,
  desired_deadline DATE,
  material_preference material_preference DEFAULT 'unknown',
  finish_preference TEXT,
  ai_briefing TEXT DEFAULT '',
  ai_risk_notes TEXT,
  status request_status DEFAULT 'draft',
  selected_quote_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE service_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID REFERENCES users(id),
  media_type media_type DEFAULT 'photo',
  storage_path TEXT NOT NULL,
  public_url TEXT,
  ai_description TEXT,
  before_after_stage before_after_stage DEFAULT 'before',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  provider_type provider_type NOT NULL DEFAULT 'painter',
  provider_id UUID NOT NULL,
  total_price NUMERIC NOT NULL,
  price_min NUMERIC,
  price_max NUMERIC,
  estimated_duration_days INTEGER NOT NULL DEFAULT 1,
  earliest_start_date DATE,
  material_included BOOLEAN DEFAULT FALSE,
  payment_terms TEXT,
  warranty_days INTEGER,
  notes TEXT,
  status quote_status DEFAULT 'invited',
  ai_comparison_label ai_comparison_label,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FK added after quotes table exists
ALTER TABLE service_requests ADD CONSTRAINT fk_selected_quote FOREIGN KEY (selected_quote_id) REFERENCES quotes(id);

CREATE TABLE quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL DEFAULT 'labor',
  description TEXT NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  unit_price NUMERIC,
  total_price NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES service_requests(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  provider_type provider_type NOT NULL,
  provider_id UUID NOT NULL,
  rating_overall INTEGER NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
  rating_quality INTEGER CHECK (rating_quality BETWEEN 1 AND 5),
  rating_punctuality INTEGER CHECK (rating_punctuality BETWEEN 1 AND 5),
  rating_cleanliness INTEGER CHECK (rating_cleanliness BETWEEN 1 AND 5),
  rating_communication INTEGER CHECK (rating_communication BETWEEN 1 AND 5),
  comment TEXT,
  sentiment_score NUMERIC,
  sentiment_label sentiment_label,
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE painter_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  painter_id UUID NOT NULL REFERENCES painters(id) ON DELETE CASCADE UNIQUE,
  overall_score NUMERIC DEFAULT 0,
  quality_score NUMERIC DEFAULT 0,
  punctuality_score NUMERIC DEFAULT 0,
  response_score NUMERIC DEFAULT 0,
  conversion_score NUMERIC DEFAULT 0,
  sentiment_score NUMERIC DEFAULT 0,
  cancellation_penalty NUMERIC DEFAULT 0,
  completed_jobs_count INTEGER DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  partner_type partner_type DEFAULT 'paint_store',
  trade_name TEXT NOT NULL,
  legal_name TEXT,
  neighborhood_id UUID REFERENCES neighborhoods(id),
  contact_phone TEXT NOT NULL,
  commission_rate NUMERIC,
  coupon_code TEXT,
  status TEXT DEFAULT 'prospect',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category product_category DEFAULT 'paint',
  brand TEXT,
  sku TEXT,
  price NUMERIC,
  commission_rate NUMERIC,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type commission_source NOT NULL,
  service_request_id UUID REFERENCES service_requests(id),
  quote_id UUID REFERENCES quotes(id),
  partner_id UUID REFERENCES partners(id),
  provider_user_id UUID REFERENCES users(id),
  gross_amount NUMERIC NOT NULL,
  commission_rate NUMERIC NOT NULL,
  commission_amount NUMERIC NOT NULL,
  status commission_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID REFERENCES service_requests(id),
  session_id TEXT,
  sender_user_id UUID REFERENCES users(id),
  recipient_user_id UUID REFERENCES users(id),
  channel message_channel DEFAULT 'web',
  direction message_direction DEFAULT 'inbound',
  body TEXT NOT NULL,
  media_url TEXT,
  ai_intent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Additional tables (beyond PRD) ──────────────────────────────────────────

CREATE TABLE conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  user_identifier TEXT NOT NULL,
  channel message_channel DEFAULT 'web',
  role_detected TEXT,
  current_state TEXT DEFAULT 'greeting',
  service_request_id UUID REFERENCES service_requests(id),
  collected_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE moderation_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  flag_type moderation_flag_type NOT NULL,
  severity moderation_severity NOT NULL,
  ai_explanation TEXT NOT NULL,
  status moderation_status DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_service_requests_status ON service_requests(status);
CREATE INDEX idx_service_requests_neighborhood ON service_requests(neighborhood_id);
CREATE INDEX idx_service_requests_customer ON service_requests(customer_id);
CREATE INDEX idx_messages_service_request ON messages(service_request_id);
CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_quotes_service_request ON quotes(service_request_id);
CREATE INDEX idx_moderation_flags_status ON moderation_flags(status);
CREATE INDEX idx_painters_availability ON painters(availability_status);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
