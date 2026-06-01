SET search_path TO pintae, public;

-- ─── Products: add missing fields ────────────────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'un';
ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'partner';
ALTER TABLE products ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved';
  -- 'pending' | 'approved' | 'rejected' (partner-submitted products need approval)

-- ─── Partners: add missing fields ────────────────────────────────────────────
ALTER TABLE partners ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS delivery_radius_km INTEGER DEFAULT 20;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS min_order_value NUMERIC;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS accepts_online_orders BOOLEAN DEFAULT FALSE;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS partner_type_detail TEXT;

-- ─── Product combos ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_combos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  original_price NUMERIC NOT NULL DEFAULT 0,
  combo_price NUMERIC NOT NULL DEFAULT 0,
  discount_pct NUMERIC GENERATED ALWAYS AS (
    CASE WHEN original_price > 0
    THEN ROUND(((original_price - combo_price) / original_price) * 100, 1)
    ELSE 0 END
  ) STORED,
  active BOOLEAN DEFAULT TRUE,
  featured BOOLEAN DEFAULT FALSE,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_combo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id UUID NOT NULL REFERENCES product_combos(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC
);

-- ─── Promotions ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  promo_type TEXT NOT NULL DEFAULT 'percent_off',
  discount_value NUMERIC,
  coupon_code TEXT UNIQUE,
  min_order_value NUMERIC,
  max_uses INTEGER,
  uses_count INTEGER DEFAULT 0,
  applies_to TEXT DEFAULT 'all',
  applies_to_ids TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE product_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- Public read for active combos/promotions
CREATE POLICY "combos_public_read" ON product_combos FOR SELECT USING (active = true);
CREATE POLICY "promos_public_read" ON promotions FOR SELECT USING (active = true);
CREATE POLICY "combo_items_public_read" ON product_combo_items FOR SELECT USING (true);

-- Admin full access
CREATE POLICY "combos_admin" ON product_combos FOR ALL USING (is_admin());
CREATE POLICY "combo_items_admin" ON product_combo_items FOR ALL USING (is_admin());
CREATE POLICY "promos_admin" ON promotions FOR ALL USING (is_admin());

-- Partner access to own combos/promotions
CREATE POLICY "combos_partner" ON product_combos FOR ALL USING (
  partner_id IN (SELECT p.id FROM partners p JOIN users u ON u.id = p.user_id WHERE u.auth_user_id = auth.uid())
);
CREATE POLICY "promos_partner" ON promotions FOR ALL USING (
  partner_id IN (SELECT p.id FROM partners p JOIN users u ON u.id = p.user_id WHERE u.auth_user_id = auth.uid())
);

-- Partner access to own products
CREATE POLICY "products_partner_own" ON products FOR ALL USING (
  partner_id IN (SELECT p.id FROM partners p JOIN users u ON u.id = p.user_id WHERE u.auth_user_id = auth.uid())
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_combos_active ON product_combos(active);
CREATE INDEX IF NOT EXISTS idx_combos_partner ON product_combos(partner_id);
CREATE INDEX IF NOT EXISTS idx_promos_active ON promotions(active);
CREATE INDEX IF NOT EXISTS idx_promos_coupon ON promotions(coupon_code);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
CREATE INDEX IF NOT EXISTS idx_products_origin ON products(origin);
CREATE INDEX IF NOT EXISTS idx_products_approval ON products(approval_status);

-- ─── Seed 2 demo partners ─────────────────────────────────────────────────────
DO $$
DECLARE uid1 UUID; uid2 UUID;
BEGIN
  -- Create partner users
  INSERT INTO users (role, name, phone, email, status, registration_source) VALUES
    ('partner', 'Tintas Campeche', '+5548993001001', 'contato@tintascampeche.com.br', 'active', 'admin'),
    ('partner', 'Casa das Tintas Floripa', '+5548993001002', 'contato@casatintasfloripa.com.br', 'active', 'admin')
  ON CONFLICT (phone) DO NOTHING;

  SELECT id INTO uid1 FROM users WHERE phone = '+5548993001001';
  SELECT id INTO uid2 FROM users WHERE phone = '+5548993001002';

  INSERT INTO partners (user_id, trade_name, legal_name, contact_phone, status, partner_type, commission_rate, coupon_code, accepts_online_orders, description)
  SELECT uid1, 'Tintas Campeche', 'Tintas Campeche LTDA', '+5548993001001', 'active', 'paint_store', 8, 'CAMPECHE10', true,
    'Loja especializada em tintas e materiais de pintura no Campeche. Entrega no Sul da Ilha.'
  WHERE uid1 IS NOT NULL
  ON CONFLICT DO NOTHING;

  INSERT INTO partners (user_id, trade_name, legal_name, contact_phone, status, partner_type, commission_rate, coupon_code, accepts_online_orders, description)
  SELECT uid2, 'Casa das Tintas Floripa', 'Casa das Tintas SC LTDA', '+5548993001002', 'active', 'material_store', 6, 'FLORIPA5', true,
    'Grande variedade de tintas, primers e materiais para pintura em Florianópolis.'
  WHERE uid2 IS NOT NULL
  ON CONFLICT DO NOTHING;
END $$;

-- Seed demo products linked to partners
INSERT INTO products (partner_id, name, category, brand, price, commission_rate, active, origin, description, stock_quantity, unit, featured)
SELECT p.id, 'Tinta Suvinil Fosco Premium 18L', 'paint', 'Suvinil', 289.90, 8, true, 'partner',
  'Tinta fosca de alta qualidade para interiores. Rendimento de 9-11m²/L. Secagem em 1h.',
  42, 'un', true
FROM partners p WHERE p.trade_name = 'Tintas Campeche' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO products (partner_id, name, category, brand, price, commission_rate, active, origin, description, stock_quantity, unit, featured)
SELECT p.id, 'Tinta Coral Acrílico 18L Branco', 'paint', 'Coral', 249.90, 8, true, 'partner',
  'Tinta acrílica para ambientes internos e externos. Resistente à umidade.',
  28, 'un', true
FROM partners p WHERE p.trade_name = 'Tintas Campeche' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO products (partner_id, name, category, brand, price, commission_rate, active, origin, description, stock_quantity, unit, false)
SELECT p.id, 'Massa Corrida PVA 25kg', 'primer', 'Eucatex', 89.90, 6, true, 'partner',
  'Massa corrida PVA para regularização de paredes internas.',
  61, 'un', false
FROM partners p WHERE p.trade_name = 'Casa das Tintas Floripa' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO products (partner_id, name, category, brand, price, commission_rate, active, origin, description, stock_quantity, unit, featured)
SELECT p.id, 'Kit Pincéis Profissional (5 peças)', 'brush', 'Atlas', 38.90, 6, true, 'partner',
  'Kit com 5 pincéis de diferentes tamanhos para pintura profissional.',
  85, 'un', false
FROM partners p WHERE p.trade_name = 'Casa das Tintas Floripa' LIMIT 1
ON CONFLICT DO NOTHING;

-- Seed 1 demo combo
INSERT INTO product_combos (name, description, original_price, combo_price, active, featured)
VALUES (
  'Kit Pintura Completo — Sala até 20m²',
  'Tudo que você precisa para pintar uma sala média: tinta premium, massa corrida e materiais de aplicação. Economize comprando junto.',
  418.70, 359.90, true, true
) ON CONFLICT DO NOTHING;

-- Seed 1 demo promotion
INSERT INTO promotions (name, description, promo_type, discount_value, coupon_code, active, valid_until, applies_to)
VALUES (
  'Primeira compra com desconto',
  '10% de desconto na sua primeira compra de materiais de pintura na plataforma.',
  'percent_off', 10, 'PINTAI10', true,
  NOW() + INTERVAL '90 days', 'all'
) ON CONFLICT (coupon_code) DO NOTHING;
