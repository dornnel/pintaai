-- Enable full row replica identity so Supabase Realtime can broadcast changes
ALTER TABLE pintae.lead_conversation_messages REPLICA IDENTITY FULL;

-- Add to the realtime publication (idempotent — error is safe to ignore)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE pintae.lead_conversation_messages;
EXCEPTION WHEN OTHERS THEN
  -- Already in publication or publication doesn't exist
  NULL;
END;
$$;
