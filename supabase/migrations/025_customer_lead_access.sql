SET search_path TO pintae, public;

-- Clientes podem ler seus próprios leads pelo email
CREATE POLICY "leads_own_email" ON leads FOR SELECT USING (
  email = (SELECT email FROM users WHERE auth_user_id = auth.uid())
);

-- Clientes podem atualizar seus próprios leads (editar detalhes)
CREATE POLICY "leads_own_email_update" ON leads FOR UPDATE
  USING (email = (SELECT email FROM users WHERE auth_user_id = auth.uid()))
  WITH CHECK (email = (SELECT email FROM users WHERE auth_user_id = auth.uid()));

-- Histórico de versões de leads (para auditoria de edições do cliente)
CREATE TABLE IF NOT EXISTS lead_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  changed_by  UUID REFERENCES users(id),
  old_values  JSONB NOT NULL DEFAULT '{}',
  new_values  JSONB NOT NULL DEFAULT '{}',
  change_note TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lead_history ENABLE ROW LEVEL SECURITY;

-- Admin lê tudo
CREATE POLICY "lead_history_admin" ON lead_history FOR ALL USING (is_admin());

-- Clientes leem histórico dos próprios leads
CREATE POLICY "lead_history_own_read" ON lead_history FOR SELECT USING (
  lead_id IN (
    SELECT id FROM leads
    WHERE email = (SELECT email FROM users WHERE auth_user_id = auth.uid())
  )
);

-- Qualquer autenticado pode inserir (sistema insere ao salvar)
CREATE POLICY "lead_history_insert" ON lead_history FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_lead_history_lead ON lead_history(lead_id);
