SET search_path TO pintae, public;

-- RPC chamada pelo frontend após insert de review customer→painter
CREATE OR REPLACE FUNCTION recalculate_painter_scores(p_painter_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count       INT;
  v_overall     NUMERIC;
  v_quality     NUMERIC;
  v_punct       NUMERIC;
  v_clean       NUMERIC;
  v_comm        NUMERIC;
BEGIN
  SELECT
    COUNT(*),
    AVG(rating_overall),
    AVG(rating_quality),
    AVG(rating_punctuality),
    AVG(rating_cleanliness),
    AVG(rating_communication)
  INTO v_count, v_overall, v_quality, v_punct, v_clean, v_comm
  FROM reviews
  WHERE provider_id    = p_painter_id
    AND direction      = 'customer_to_painter'
    AND provider_type  = 'painter';

  INSERT INTO painter_scores (
    painter_id, overall_score, quality_score, punctuality_score,
    reviews_count, last_calculated_at
  )
  VALUES (
    p_painter_id,
    COALESCE(v_overall, 0),
    COALESCE(v_quality, 0),
    COALESCE(v_punct,   0),
    COALESCE(v_count,   0),
    NOW()
  )
  ON CONFLICT (painter_id) DO UPDATE SET
    overall_score      = COALESCE(v_overall, 0),
    quality_score      = COALESCE(v_quality, 0),
    punctuality_score  = COALESCE(v_punct,   0),
    reviews_count      = COALESCE(v_count,   0),
    last_calculated_at = NOW();
END;
$$;

-- Fix FK: permitir exclusão de pintor mesmo com histórico de pagamentos
ALTER TABLE payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_painter_id_fkey;

ALTER TABLE payment_transactions
  ADD CONSTRAINT payment_transactions_painter_id_fkey
  FOREIGN KEY (painter_id) REFERENCES painters(id) ON DELETE SET NULL;
