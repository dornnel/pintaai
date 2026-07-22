-- 044: Fix admin RLS (roles array) + preserve customer data on user deletion

SET search_path TO pintae, public;

-- ── 1. Fix is_admin(): check roles[] array, not just primary role ───────────
-- Multi-role users (e.g. role='painter', roles=['admin','painter']) were failing
-- the admin check because only `role = 'admin'` was checked.
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_user_id = auth.uid()
    AND (role = 'admin' OR 'admin' = ANY(COALESCE(roles, ARRAY[role]::text[])))
  )
$$ LANGUAGE sql SECURITY DEFINER;

-- ── 2. Preserve customer records + service history on user deletion ──────────
-- Previously: users(id) ON DELETE CASCADE → customers → DELETE all child rows
-- Now: customers.user_id becomes nullable ON DELETE SET NULL
-- Effect: deleting a user nullifies their customer record (audit preserved)
-- but the customer record and its service_requests/proposals remain for logs.

-- Make customers.user_id nullable
ALTER TABLE customers ALTER COLUMN user_id DROP NOT NULL;

-- Replace CASCADE with SET NULL on customers.user_id FK
ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_user_id_fkey;
ALTER TABLE customers
  ADD CONSTRAINT customers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Allow service_requests.customer_id to be null (preserve orphaned requests)
ALTER TABLE service_requests ALTER COLUMN customer_id DROP NOT NULL;
