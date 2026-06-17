-- Add CPF field to users table for KYC / tax purposes
ALTER TABLE pintae.users ADD COLUMN IF NOT EXISTS cpf TEXT;

-- Index for CPF lookups (admin search / dedup)
CREATE INDEX IF NOT EXISTS users_cpf_idx ON pintae.users (cpf) WHERE cpf IS NOT NULL;
