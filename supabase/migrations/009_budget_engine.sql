SET search_path TO pintae, public;

-- Campos de motor de orçamento no agent_configs
ALTER TABLE agent_configs
  ADD COLUMN IF NOT EXISTS budget_engine_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS budget_mode TEXT DEFAULT 'internal_only',
  ADD COLUMN IF NOT EXISTS budget_warning_text TEXT DEFAULT 'Esta é uma pré-análise assistida por IA. O valor final será validado por um pintor profissional.',
  ADD COLUMN IF NOT EXISTS minimum_job_price NUMERIC DEFAULT 350;

-- Faixas base de preço por tipo de serviço (R$/m²)
CREATE TABLE IF NOT EXISTS budget_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT NOT NULL,
  label TEXT NOT NULL,
  min_price_m2 NUMERIC NOT NULL,
  max_price_m2 NUMERIC NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Multiplicadores de complexidade
CREATE TABLE IF NOT EXISTS budget_complexity_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  multiplier NUMERIC NOT NULL DEFAULT 1.0,
  active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Divergências registradas (estimativa IA vs validação do pintor)
CREATE TABLE IF NOT EXISTS budget_ai_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  field_adjusted TEXT NOT NULL,
  ai_value TEXT,
  painter_value TEXT,
  difference_percent NUMERIC,
  error_category TEXT,
  reason TEXT,
  created_by TEXT DEFAULT 'painter',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Base de conhecimento do agente gerada a partir de revisões
CREATE TABLE IF NOT EXISTS agent_knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_type TEXT DEFAULT 'manual',
  related_lead_id UUID REFERENCES leads(id),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_budget_adjustments_lead ON budget_ai_adjustments(lead_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_active ON agent_knowledge_entries(active, created_at DESC);

-- Seed: faixas base por m²
INSERT INTO budget_pricing_rules (service_type, label, min_price_m2, max_price_m2, sort_order) VALUES
  ('residential_simple',   'Pintura interna simples',           18, 28, 1),
  ('residential_massa',    'Pintura interna com massa/selador', 28, 42, 2),
  ('residential_premium',  'Pintura premium',                   42, 65, 3),
  ('external',             'Pintura externa',                   35, 70, 4),
  ('facade_wall',          'Pintura de muro/fachada',           30, 65, 5)
ON CONFLICT DO NOTHING;

-- Seed: multiplicadores de complexidade
INSERT INTO budget_complexity_rules (key, label, multiplier, sort_order) VALUES
  ('good_condition',       'Parede boa / repintura simples',    1.00, 1),
  ('small_marks',          'Pequenas marcas',                   1.10, 2),
  ('light_holes',          'Furos leves',                       1.20, 3),
  ('mold_moisture',        'Mofo ou umidade',                   1.35, 4),
  ('peeling',              'Descascamento',                     1.40, 5),
  ('cracks',               'Trincas',                           1.50, 6),
  ('furnished',            'Casa mobiliada',                    1.15, 7),
  ('people_living',        'Pessoas morando no local',          1.10, 8),
  ('external_area',        'Área externa',                      1.25, 9),
  ('height_above_3m',      'Altura acima de 3m',                1.35, 10),
  ('urgency',              'Urgência',                          1.30, 11),
  ('weekend_holiday',      'Final de semana / feriado',         1.40, 12),
  ('dark_color',           'Cor escura / intensa',              1.15, 13),
  ('radical_color_change', 'Mudança radical de cor',            1.20, 14),
  ('humid_climate',        'Clima úmido / chuvoso',             1.15, 15)
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE budget_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_complexity_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_ai_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_knowledge_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_budget_pricing" ON budget_pricing_rules FOR ALL USING (is_admin());
CREATE POLICY "admin_budget_complexity" ON budget_complexity_rules FOR ALL USING (is_admin());
CREATE POLICY "admin_budget_adjustments" ON budget_ai_adjustments FOR ALL USING (is_admin());
CREATE POLICY "admin_knowledge" ON agent_knowledge_entries FOR ALL USING (is_admin());

-- Leitura pública das regras (para o motor funcionar no frontend)
CREATE POLICY "public_read_pricing" ON budget_pricing_rules FOR SELECT USING (active = true);
CREATE POLICY "public_read_complexity" ON budget_complexity_rules FOR SELECT USING (active = true);
