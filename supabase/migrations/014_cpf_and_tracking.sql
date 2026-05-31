SET search_path TO pintae, public;

-- CPF e campos legais nos usuários
ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cookie_consent TEXT DEFAULT 'pending';
-- cookie_consent: pending | all | essential | rejected

-- Dados de rastreio capturados no lead (com consentimento LGPD)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tracking_data JSONB DEFAULT '{}';
-- tracking_data: {
--   ip, city, country, browser, os, device,
--   referrer, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
--   landing_page, first_visit_at
-- }

-- Índice único parcial no CPF (só para valores não nulos)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cpf ON users(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_cookie_consent ON users(cookie_consent);
