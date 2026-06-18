-- Painter ↔ customer in-app conversation messages
CREATE TABLE IF NOT EXISTS pintae.lead_conversation_messages (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id UUID        NOT NULL REFERENCES pintae.lead_painter_interactions(id) ON DELETE CASCADE,
  sender_role    TEXT        NOT NULL CHECK (sender_role IN ('customer', 'painter')),
  body           TEXT        NOT NULL,
  read_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lcm_interaction
  ON pintae.lead_conversation_messages(interaction_id);

ALTER TABLE pintae.lead_conversation_messages ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY lcm_admin ON pintae.lead_conversation_messages
  FOR ALL USING (pintae.is_admin());

-- Painter: access messages in their own interactions
CREATE POLICY lcm_painter ON pintae.lead_conversation_messages
  FOR ALL USING (
    interaction_id IN (
      SELECT lpi.id
      FROM pintae.lead_painter_interactions lpi
      JOIN pintae.painters p ON p.id = lpi.painter_id
      JOIN pintae.users u     ON u.id = p.user_id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- Customer: access messages in interactions linked to their leads
CREATE POLICY lcm_customer ON pintae.lead_conversation_messages
  FOR ALL USING (
    interaction_id IN (
      SELECT id FROM pintae.lead_painter_interactions
      WHERE lead_id IN (SELECT pintae.leads_for_current_user())
    )
  );
