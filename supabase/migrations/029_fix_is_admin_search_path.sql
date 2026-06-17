-- Fix is_admin() SECURITY DEFINER function missing search_path
-- Without explicit search_path, 'FROM users' resolves to public.users (not pintae.users)
-- causing admins to see 0 leads in the admin panel
CREATE OR REPLACE FUNCTION pintae.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pintae, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pintae.users WHERE auth_user_id = auth.uid() AND role = 'admin'
  )
$$;
