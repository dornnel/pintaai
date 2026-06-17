-- Allow customers to read lead_painter_interactions for their own leads
CREATE POLICY "lpi_customer_read" ON pintae.lead_painter_interactions
FOR SELECT
USING (
  lead_id IN (
    SELECT id FROM pintae.leads
    WHERE email = (
      SELECT email FROM pintae.users WHERE auth_user_id = auth.uid()
    )
  )
);

-- Prevent duplicate painter records per user (protects maybeSingle() from failing)
ALTER TABLE pintae.painters
  ADD CONSTRAINT painters_user_id_unique UNIQUE (user_id);
