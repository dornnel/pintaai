SET search_path TO pintae, public;

-- ─── User management fields ───────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_source TEXT DEFAULT 'web';
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notes TEXT;

-- ─── Painter KYC fields ───────────────────────────────────────────────────────
ALTER TABLE painters ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE painters ADD COLUMN IF NOT EXISTS full_address JSONB;
ALTER TABLE painters ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE painters ADD COLUMN IF NOT EXISTS document_photo_url TEXT;
ALTER TABLE painters ADD COLUMN IF NOT EXISTS selfie_with_doc_url TEXT;
ALTER TABLE painters ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'not_started';
ALTER TABLE painters ADD COLUMN IF NOT EXISTS kyc_reviewed_by UUID REFERENCES users(id);
ALTER TABLE painters ADD COLUMN IF NOT EXISTS kyc_reviewed_at TIMESTAMPTZ;
ALTER TABLE painters ADD COLUMN IF NOT EXISTS kyc_rejection_reason TEXT;
ALTER TABLE painters ADD COLUMN IF NOT EXISTS portfolio_photos TEXT[] DEFAULT '{}';
ALTER TABLE painters ADD COLUMN IF NOT EXISTS registration_source TEXT DEFAULT 'web';

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_painters_kyc ON painters(kyc_status);
