-- 048: RPC helpers for atomic operations
-- Fixes:
--   - active_leads_count race condition (read-modify-write in app layer → atomic SQL)
--   - collected_data overwrite in whatsapp-webhook (merge instead of replace)

SET search_path TO pintae, public;

-- Atomic increment of painter lead count + update last received timestamp
CREATE OR REPLACE FUNCTION pintae.increment_painter_lead_count(
  painter_id UUID,
  received_at TIMESTAMPTZ
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE pintae.painters
  SET
    active_leads_count = COALESCE(active_leads_count, 0) + 1,
    last_lead_received_at = received_at
  WHERE id = painter_id;
$$;

-- JSONB merge patch for conversation_sessions.collected_data
-- Upserts the session row if not exists, then merges the patch (does not overwrite existing keys)
CREATE OR REPLACE FUNCTION pintae.merge_session_collected_data(
  p_session_id TEXT,
  p_patch JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO pintae.conversation_sessions (session_id, collected_data, updated_at)
  VALUES (p_session_id, p_patch, now())
  ON CONFLICT (session_id) DO UPDATE
    SET collected_data = COALESCE(pintae.conversation_sessions.collected_data, '{}'::jsonb) || p_patch,
        updated_at = now();
END;
$$;
