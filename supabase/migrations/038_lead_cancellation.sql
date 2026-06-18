-- Cancellation fields on leads
ALTER TABLE pintae.leads
  ADD COLUMN IF NOT EXISTS cancelled_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- Partial index — keeps RLS/filter queries fast for non-cancelled leads
CREATE INDEX IF NOT EXISTS idx_leads_not_cancelled
  ON pintae.leads (created_at DESC)
  WHERE cancelled_at IS NULL;
