-- 049: Add is_super_admin flag to users table
-- Replaces hardcoded email check in auth.tsx with a DB-driven flag.
-- Super admins can: promote other admins, edit chat flow steps, access all admin areas.

SET search_path TO pintae, public;

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Seed: mark the founding superadmin
UPDATE users SET is_super_admin = TRUE WHERE email = 'andre@agenscia.com';

-- Only super admins can update this column (RLS)
CREATE POLICY "super_admin_self_manage" ON users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid()::text::uuid AND u.is_super_admin = TRUE
    )
  )
  WITH CHECK (TRUE);
