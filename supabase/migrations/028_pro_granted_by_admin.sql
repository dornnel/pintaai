-- Track when Pro plan is granted by admin (no payment required)
ALTER TABLE pintae.painters
  ADD COLUMN IF NOT EXISTS pro_granted_by_admin BOOLEAN NOT NULL DEFAULT false;
