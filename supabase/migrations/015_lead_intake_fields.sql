SET search_path TO pintae, public;

-- Defensivo: garantir coluna protocol + índice único (pode já existir)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS protocol TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_protocol_unique ON leads(protocol) WHERE protocol IS NOT NULL;

-- Metragem do espaço, coletada no chat para alimentar o motor de orçamento
ALTER TABLE leads ADD COLUMN IF NOT EXISTS area_m2 NUMERIC;

-- Campos coletados no chat que hoje só ficam dentro de notes (JSON)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferred_professional TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS current_color TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS estimated_budget TEXT; -- faixa que o cliente espera pagar (informativo)

-- Estimativa real calculada pelo motor de regras (budgetEngine), distinta do
-- ai_price_min/max usado para tracking de divergência IA x pintor
ALTER TABLE leads ADD COLUMN IF NOT EXISTS calc_price_min NUMERIC;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS calc_price_max NUMERIC;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS calc_confidence TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS calc_explanation TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_area_m2 ON leads(area_m2);
