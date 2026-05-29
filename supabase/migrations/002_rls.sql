SET search_path TO pintae, public;

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE painters ENABLE ROW LEVEL SECURITY;
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE painter_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE neighborhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_flags ENABLE ROW LEVEL SECURITY;

-- ─── Helper function ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'admin'
  )
$$ LANGUAGE sql SECURITY DEFINER;

-- ─── Neighborhoods: public read ───────────────────────────────────────────────

CREATE POLICY "neighborhoods_public_read" ON neighborhoods FOR SELECT USING (active = true);
CREATE POLICY "neighborhoods_admin_all" ON neighborhoods FOR ALL USING (is_admin());

-- ─── Users ────────────────────────────────────────────────────────────────────

CREATE POLICY "users_own_read" ON users FOR SELECT USING (auth_user_id = auth.uid());
CREATE POLICY "users_admin_all" ON users FOR ALL USING (is_admin());
CREATE POLICY "users_anon_insert" ON users FOR INSERT WITH CHECK (true); -- allow self-registration

-- ─── Customers ───────────────────────────────────────────────────────────────

CREATE POLICY "customers_own" ON customers FOR ALL USING (
  user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
);
CREATE POLICY "customers_admin" ON customers FOR ALL USING (is_admin());

-- ─── Painters ────────────────────────────────────────────────────────────────

CREATE POLICY "painters_public_read" ON painters FOR SELECT USING (availability_status != 'paused');
CREATE POLICY "painters_own" ON painters FOR ALL USING (
  user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
);
CREATE POLICY "painters_admin" ON painters FOR ALL USING (is_admin());

-- ─── Painter Scores: public read ─────────────────────────────────────────────

CREATE POLICY "painter_scores_public_read" ON painter_scores FOR SELECT USING (true);
CREATE POLICY "painter_scores_admin" ON painter_scores FOR ALL USING (is_admin());

-- ─── Service Requests ────────────────────────────────────────────────────────

CREATE POLICY "requests_own_customer" ON service_requests FOR ALL USING (
  customer_id IN (
    SELECT c.id FROM customers c
    JOIN users u ON u.id = c.user_id
    WHERE u.auth_user_id = auth.uid()
  )
);
CREATE POLICY "requests_admin" ON service_requests FOR ALL USING (is_admin());
-- Painters can see requests sent to them (in matching bairros) — simplified for now
CREATE POLICY "requests_painter_read" ON service_requests FOR SELECT USING (
  status IN ('sent_to_pros', 'quoting', 'options_sent', 'connected', 'in_progress', 'completed')
  AND EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'painter')
);

-- ─── Service Media ───────────────────────────────────────────────────────────

CREATE POLICY "media_own" ON service_media FOR SELECT USING (
  service_request_id IN (
    SELECT sr.id FROM service_requests sr
    JOIN customers c ON c.id = sr.customer_id
    JOIN users u ON u.id = c.user_id
    WHERE u.auth_user_id = auth.uid()
  )
);
CREATE POLICY "media_anon_insert" ON service_media FOR INSERT WITH CHECK (true);
CREATE POLICY "media_admin" ON service_media FOR ALL USING (is_admin());

-- ─── Quotes ──────────────────────────────────────────────────────────────────

CREATE POLICY "quotes_customer_read" ON quotes FOR SELECT USING (
  status IN ('shortlisted', 'selected') AND
  service_request_id IN (
    SELECT sr.id FROM service_requests sr
    JOIN customers c ON c.id = sr.customer_id
    JOIN users u ON u.id = c.user_id
    WHERE u.auth_user_id = auth.uid()
  )
);
CREATE POLICY "quotes_painter_own" ON quotes FOR ALL USING (
  provider_id IN (
    SELECT p.id FROM painters p
    JOIN users u ON u.id = p.user_id
    WHERE u.auth_user_id = auth.uid()
  )
);
CREATE POLICY "quotes_admin" ON quotes FOR ALL USING (is_admin());

-- ─── Reviews ─────────────────────────────────────────────────────────────────

CREATE POLICY "reviews_public_read" ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_own_insert" ON reviews FOR INSERT WITH CHECK (
  customer_id IN (
    SELECT c.id FROM customers c
    JOIN users u ON u.id = c.user_id
    WHERE u.auth_user_id = auth.uid()
  )
);
CREATE POLICY "reviews_admin" ON reviews FOR ALL USING (is_admin());

-- ─── Messages ────────────────────────────────────────────────────────────────

CREATE POLICY "messages_anon_insert" ON messages FOR INSERT WITH CHECK (true);
CREATE POLICY "messages_own" ON messages FOR SELECT USING (
  sender_user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  OR service_request_id IN (
    SELECT sr.id FROM service_requests sr
    JOIN customers c ON c.id = sr.customer_id
    JOIN users u ON u.id = c.user_id
    WHERE u.auth_user_id = auth.uid()
  )
);
CREATE POLICY "messages_admin" ON messages FOR ALL USING (is_admin());

-- ─── Moderation Flags: admin only ────────────────────────────────────────────

CREATE POLICY "moderation_admin" ON moderation_flags FOR ALL USING (is_admin());
CREATE POLICY "moderation_service_insert" ON moderation_flags FOR INSERT WITH CHECK (true); -- edge functions insert

-- ─── Audit Logs: admin only ──────────────────────────────────────────────────

CREATE POLICY "audit_admin" ON audit_logs FOR ALL USING (is_admin());
CREATE POLICY "audit_service_insert" ON audit_logs FOR INSERT WITH CHECK (true);

-- ─── Conversation Sessions ───────────────────────────────────────────────────

CREATE POLICY "sessions_anon_all" ON conversation_sessions FOR ALL USING (true);

-- ─── Partners & Products: admin + public read ────────────────────────────────

CREATE POLICY "partners_public_read" ON partners FOR SELECT USING (status = 'active');
CREATE POLICY "partners_admin" ON partners FOR ALL USING (is_admin());
CREATE POLICY "products_public_read" ON products FOR SELECT USING (active = true);
CREATE POLICY "products_admin" ON products FOR ALL USING (is_admin());

-- ─── Commissions: admin only ─────────────────────────────────────────────────

CREATE POLICY "commissions_admin" ON commissions FOR ALL USING (is_admin());
