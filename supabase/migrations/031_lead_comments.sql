-- Tabela de comentários internos para leads (admins podem anotar observações)
CREATE TABLE IF NOT EXISTS pintae.lead_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES pintae.leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES pintae.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_comments_lead_id ON pintae.lead_comments(lead_id);

ALTER TABLE pintae.lead_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_comments_admin" ON pintae.lead_comments
  FOR ALL
  USING (pintae.is_admin());
