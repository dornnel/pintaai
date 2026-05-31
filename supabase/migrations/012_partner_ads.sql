SET search_path TO pintae, public;

CREATE TABLE IF NOT EXISTS partner_ad_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  placement TEXT NOT NULL UNIQUE,
  description TEXT,
  width INTEGER,
  height INTEGER,
  price_monthly NUMERIC NOT NULL DEFAULT 0,
  max_ads INTEGER DEFAULT 1,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES partner_ad_slots(id),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  click_url TEXT,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  partner_id UUID REFERENCES partners(id),
  items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  coupon_code TEXT,
  total NUMERIC NOT NULL DEFAULT 0,
  delivery_address JSONB,
  payment_method TEXT,
  asaas_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_ads_slot ON partner_ads(slot_id, status);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_user ON marketplace_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status ON marketplace_orders(status);

ALTER TABLE partner_ad_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_slots" ON partner_ad_slots FOR SELECT USING (active = true);
CREATE POLICY "admin_slots" ON partner_ad_slots FOR ALL USING (is_admin());
CREATE POLICY "public_read_active_ads" ON partner_ads FOR SELECT USING (status = 'active');
CREATE POLICY "admin_ads" ON partner_ads FOR ALL USING (is_admin());
CREATE POLICY "partner_own_ads" ON partner_ads FOR ALL USING (
  partner_id IN (SELECT id FROM partners WHERE user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()))
);
CREATE POLICY "admin_orders" ON marketplace_orders FOR ALL USING (is_admin());
CREATE POLICY "own_orders" ON marketplace_orders FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
);

-- Seed: slots de anúncio
INSERT INTO partner_ad_slots (name, placement, description, width, height, price_monthly, max_ads) VALUES
  ('Banner Hero Home',    'home_hero',       'Banner principal na página inicial',     1200, 300, 890, 1),
  ('Card Marketplace',    'marketplace_top', 'Destaque no topo do marketplace',        400,  200, 490, 2),
  ('Banner Lateral Chat', 'chat_sidebar',    'Banner na sidebar do chat (desktop)',    300,  250, 390, 1)
ON CONFLICT (placement) DO NOTHING;
