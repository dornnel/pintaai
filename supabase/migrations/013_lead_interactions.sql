SET search_path TO pintae, public;

-- Rastreio individual pintor × lead (quem recebeu, abriu, enviou proposta, etc.)
CREATE TABLE IF NOT EXISTS lead_painter_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  painter_id UUID NOT NULL REFERENCES painters(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'notified',
  -- status: notified | email_opened | proposal_viewed | proposal_sent | replied | declined
  notified_at TIMESTAMPTZ DEFAULT NOW(),
  email_opened_at TIMESTAMPTZ,
  proposal_viewed_at TIMESTAMPTZ,
  proposal_sent_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  quote_id UUID REFERENCES quotes(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (lead_id, painter_id)
);

-- Agendamentos: visita técnica, início/fim de serviço, follow-up
CREATE TABLE IF NOT EXISTS visit_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  painter_id UUID REFERENCES painters(id),
  scheduled_by UUID REFERENCES users(id),
  type TEXT NOT NULL DEFAULT 'technical_visit',
  -- type: technical_visit | service_start | service_end | follow_up
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  location_notes TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  -- status: pending | confirmed | completed | canceled | rescheduled
  confirmed_by_painter BOOLEAN DEFAULT FALSE,
  confirmed_by_customer BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lead_painter_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lpi_admin" ON lead_painter_interactions FOR ALL USING (is_admin());
CREATE POLICY "vs_admin" ON visit_schedules FOR ALL USING (is_admin());

-- Pintores veem suas próprias interações
CREATE POLICY "lpi_painter_read" ON lead_painter_interactions FOR SELECT USING (
  painter_id IN (SELECT id FROM painters WHERE user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()))
);

CREATE INDEX IF NOT EXISTS idx_lpi_lead ON lead_painter_interactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_lpi_painter ON lead_painter_interactions(painter_id);
CREATE INDEX IF NOT EXISTS idx_vs_lead ON visit_schedules(lead_id);
CREATE INDEX IF NOT EXISTS idx_vs_scheduled ON visit_schedules(scheduled_at);
