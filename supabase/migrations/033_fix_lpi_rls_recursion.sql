-- Fix infinite RLS recursion between pintae.leads and pintae.lead_painter_interactions
--
-- Root cause:
--   leads_painter_notified policy on leads  → queries lead_painter_interactions
--   lpi_customer_read policy on lpi         → queries leads
--   → circular dependency → "infinite recursion detected in policy for relation leads"
--
-- Fix: replace the subquery in lpi_customer_read with a SECURITY DEFINER function
-- that queries leads without triggering RLS, breaking the cycle.

CREATE OR REPLACE FUNCTION pintae.leads_for_current_user()
  RETURNS SETOF UUID
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = pintae, public
AS $$
  SELECT id FROM pintae.leads
  WHERE email = (
    SELECT email FROM pintae.users WHERE auth_user_id = auth.uid()
  )
$$;

-- Rebuild lpi_customer_read using the SECURITY DEFINER function
DROP POLICY IF EXISTS lpi_customer_read ON pintae.lead_painter_interactions;
CREATE POLICY lpi_customer_read ON pintae.lead_painter_interactions
  FOR SELECT
  USING (lead_id IN (SELECT pintae.leads_for_current_user()));
