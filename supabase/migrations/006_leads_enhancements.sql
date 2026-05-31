SET search_path TO pintae, public;

-- Campos adicionais na tabela leads para suportar o fluxo ponta-a-ponta
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS final_notes TEXT,
  ADD COLUMN IF NOT EXISTS notes_media_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_briefing TEXT,
  ADD COLUMN IF NOT EXISTS ai_price_min NUMERIC,
  ADD COLUMN IF NOT EXISTS ai_price_max NUMERIC,
  ADD COLUMN IF NOT EXISTS ai_sentiment TEXT,
  ADD COLUMN IF NOT EXISTS ai_client_profile TEXT,
  ADD COLUMN IF NOT EXISTS property_type TEXT,
  ADD COLUMN IF NOT EXISTS wall_condition TEXT,
  ADD COLUMN IF NOT EXISTS deadline TEXT,
  ADD COLUMN IF NOT EXISTS material TEXT,
  ADD COLUMN IF NOT EXISTS sent_to_painters_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS painter_ids_notified UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS email_confirmation_sent BOOLEAN DEFAULT FALSE;

-- Índices para busca eficiente
CREATE INDEX IF NOT EXISTS idx_leads_protocol ON leads(protocol);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_stage_created ON leads(stage, created_at DESC);
