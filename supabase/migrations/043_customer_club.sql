SET search_path TO pintae, public;

-- Columns needed by create-subscription edge fn (may already exist in prod from edge fn upsert)
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS next_billing_date DATE;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

-- Club membership on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_club_member BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS club_credits INT DEFAULT 0;

-- Customer club subscription plan
INSERT INTO subscription_plans (name, slug, price_monthly, description, features) VALUES
  ('Clube Pinte Rápido', 'customer-club', 49.00,
   'Acesso premium para clientes com créditos de IA e pintores parceiros certificados',
   '["10 créditos/mês para ferramentas de IA","Pintores parceiros certificados com prioridade","Descontos em materiais com fornecedores parceiros","Acompanhamento exclusivo da equipe Pinte Rápido","Suporte via WhatsApp dedicado","Retenção de pagamento pela plataforma"]')
ON CONFLICT (slug) DO NOTHING;

-- Rename old pintae-pro plan slug to pinte-rapido-pro
UPDATE subscription_plans SET slug = 'pinte-rapido-pro' WHERE slug = 'pintae-pro';
