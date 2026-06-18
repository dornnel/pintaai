-- Painter compliance: terms, privacy policy and LGPD consent timestamps
ALTER TABLE pintae.painters
  ADD COLUMN IF NOT EXISTS terms_accepted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lgpd_accepted_at     TIMESTAMPTZ;
