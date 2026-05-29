SET search_path TO pintae, public;

-- ─── Payment transactions (Asaas escrow) ──────────────────────────────────────

CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID REFERENCES service_requests(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id),
  painter_id UUID REFERENCES painters(id),
  asaas_payment_id TEXT UNIQUE,
  asaas_customer_id TEXT,
  gross_amount NUMERIC NOT NULL,
  platform_fee_rate NUMERIC NOT NULL DEFAULT 0.08,
  platform_fee NUMERIC NOT NULL,
  painter_amount NUMERIC NOT NULL,
  payment_method TEXT, -- pix | boleto | credit_card
  status TEXT NOT NULL DEFAULT 'pending',
    -- pending | awaiting_payment | paid | held | partially_released | released | refunded | disputed
  pix_qr_code TEXT,
  pix_copy_paste TEXT,
  pix_expiry TIMESTAMPTZ,
  boleto_url TEXT,
  boleto_barcode TEXT,
  payment_url TEXT,
  paid_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Payment milestones (release schedule) ────────────────────────────────────

CREATE TABLE payment_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_transaction_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
    -- booking_confirmed | work_started | work_in_progress | completed
  label TEXT NOT NULL,
  percentage NUMERIC NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
    -- pending | approved | released
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  evidence_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Service appointments (Cal.com) ───────────────────────────────────────────

CREATE TABLE service_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID REFERENCES service_requests(id) ON DELETE SET NULL,
  payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
  calcom_booking_uid TEXT UNIQUE,
  calcom_event_type_id TEXT,
  painter_calcom_username TEXT,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
    -- pending | confirmed | rescheduled | cancelled | completed
  cancellation_reason TEXT,
  meeting_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_appointments ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "pt_admin" ON payment_transactions FOR ALL USING (is_admin());
CREATE POLICY "pm_admin" ON payment_milestones FOR ALL USING (is_admin());
CREATE POLICY "sa_admin" ON service_appointments FOR ALL USING (is_admin());

-- Customers see their own transactions
CREATE POLICY "pt_customer" ON payment_transactions FOR SELECT USING (
  customer_id IN (
    SELECT c.id FROM customers c JOIN users u ON u.id = c.user_id WHERE u.auth_user_id = auth.uid()
  )
);

-- Painters see transactions for their jobs
CREATE POLICY "pt_painter" ON payment_transactions FOR SELECT USING (
  painter_id IN (
    SELECT p.id FROM painters p JOIN users u ON u.id = p.user_id WHERE u.auth_user_id = auth.uid()
  )
);

-- Service functions insert (webhooks)
CREATE POLICY "pt_service_insert" ON payment_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "pm_service_insert" ON payment_milestones FOR INSERT WITH CHECK (true);
CREATE POLICY "sa_service_insert" ON service_appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "pt_service_update" ON payment_transactions FOR UPDATE USING (true);
CREATE POLICY "sa_service_update" ON service_appointments FOR UPDATE USING (true);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_pt_service_request ON payment_transactions(service_request_id);
CREATE INDEX idx_pt_status ON payment_transactions(status);
CREATE INDEX idx_pt_asaas_id ON payment_transactions(asaas_payment_id);
CREATE INDEX idx_pm_transaction ON payment_milestones(payment_transaction_id);
CREATE INDEX idx_sa_service_request ON service_appointments(service_request_id);
CREATE INDEX idx_sa_calcom ON service_appointments(calcom_booking_uid);
