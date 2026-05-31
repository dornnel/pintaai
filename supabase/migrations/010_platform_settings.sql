SET search_path TO pintae, public;

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  label TEXT,
  description TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_settings" ON platform_settings FOR ALL USING (is_admin());
CREATE POLICY "public_read_settings" ON platform_settings FOR SELECT USING (true);

INSERT INTO platform_settings (key, value, label, description) VALUES
  ('whatsapp_number',        '"5548991813090"',        'WhatsApp da plataforma',         'Número para contato via WhatsApp'),
  ('admin_email',            '"andre@agenscia.com"',   'E-mail do admin',                'Recebe notificações do sistema'),
  ('platform_fee_rate',      '0.08',                   'Taxa da plataforma (%)',          'Percentual sobre o valor do serviço'),
  ('minimum_job_price',      '350',                    'Preço mínimo por job (R$)',       'Valor mínimo aceito para um serviço'),
  ('registration_open',      'true',                   'Registro aberto',                'Permitir novos cadastros'),
  ('marketplace_active',     'true',                   'Marketplace ativo',              'Exibir produtos no marketplace'),
  ('chat_public',            'true',                   'Chat público ativo',             'Permitir chat sem login'),
  ('budget_engine_enabled',  'false',                  'Motor de orçamento IA',          'Ativar estimativas automáticas')
ON CONFLICT (key) DO NOTHING;
