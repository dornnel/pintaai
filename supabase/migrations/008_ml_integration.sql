SET search_path TO pintae, public;

-- ─── Mercado Livre partner accounts ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ml_partner_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
  ml_seller_id TEXT UNIQUE NOT NULL,
  ml_seller_nickname TEXT,
  ml_site_id TEXT DEFAULT 'MLB',
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ml_partner_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ml_admin" ON ml_partner_accounts FOR ALL USING (is_admin());

-- ─── ML product fields ────────────────────────────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS ml_item_id TEXT UNIQUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ml_permalink TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ml_thumbnail TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ml_seller_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ml_last_synced TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ml_available_quantity INTEGER;

-- ─── Affiliate click tracking ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT,
  utm_source TEXT DEFAULT 'pintai',
  utm_campaign TEXT,
  click_url TEXT,
  referrer TEXT,
  converted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ac_admin" ON affiliate_clicks FOR ALL USING (is_admin());
CREATE POLICY "ac_insert_anon" ON affiliate_clicks FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_affiliate_product ON affiliate_clicks(product_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_partner ON affiliate_clicks(partner_id);
