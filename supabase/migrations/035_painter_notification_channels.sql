-- Painter notification channel preferences
ALTER TABLE pintae.painters
  ADD COLUMN IF NOT EXISTS notify_by_email    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_by_whatsapp BOOLEAN NOT NULL DEFAULT false;
