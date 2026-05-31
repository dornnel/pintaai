SET search_path TO pintae, public;

-- Campos de verificação de identidade e multi-role
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS document TEXT,
  ADD COLUMN IF NOT EXISTS document_type TEXT,
  ADD COLUMN IF NOT EXISTS document_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS secondary_role TEXT,
  ADD COLUMN IF NOT EXISTS registration_source TEXT DEFAULT 'web';

-- Índice para busca por document
CREATE INDEX IF NOT EXISTS idx_users_document ON users(document) WHERE document IS NOT NULL;
