SET search_path TO pintae, public;

-- ============================================================
-- Rastreio de conversas incompletas/abandonadas
-- ============================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_partial BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS abandoned_step TEXT;

-- Backfill a partir do que já está em notes (save-lead grava {partial:true, step:...} hoje)
-- notes é TEXT; o regex garante que só tentamos o cast para jsonb em valores
-- que de fato parecem JSON com partial:true (evita erro de cast em notes manuais em texto livre)
UPDATE leads SET
  is_partial = true,
  abandoned_step = (notes::jsonb)->>'step'
WHERE is_partial IS DISTINCT FROM true
  AND notes ~ '^\s*\{.*"partial"\s*:\s*true'
  AND (notes::jsonb)->>'partial' = 'true';

CREATE INDEX IF NOT EXISTS idx_leads_is_partial ON leads(is_partial) WHERE is_partial = true;
