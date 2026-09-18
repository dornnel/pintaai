-- 050: merge_session_collected_data must satisfy conversation_sessions.user_identifier
-- NOT NULL when inserting a brand-new row (WhatsApp sessions never go through
-- useChat's saveSessionState, which is what used to create the row first on web).
-- Defaults user_identifier to the session_id, same fallback already used elsewhere
-- in the app (collected.whatsapp || collected.email || collected.name || sessionId).

SET search_path TO pintae, public;

CREATE OR REPLACE FUNCTION pintae.merge_session_collected_data(
  p_session_id TEXT,
  p_patch JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO pintae.conversation_sessions (session_id, user_identifier, collected_data, updated_at)
  VALUES (p_session_id, p_session_id, p_patch, now())
  ON CONFLICT (session_id) DO UPDATE
    SET collected_data = COALESCE(pintae.conversation_sessions.collected_data, '{}'::jsonb) || p_patch,
        updated_at = now();
END;
$$;
