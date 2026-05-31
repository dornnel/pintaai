SET search_path TO pintae, public;

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  price_monthly NUMERIC NOT NULL,
  price_yearly NUMERIC,
  description TEXT,
  features JSONB DEFAULT '[]',
  asaas_plan_id TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  asaas_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_plans" ON subscription_plans FOR SELECT USING (active = true);
CREATE POLICY "admin_plans" ON subscription_plans FOR ALL USING (is_admin());
CREATE POLICY "admin_subs" ON user_subscriptions FOR ALL USING (is_admin());
CREATE POLICY "own_sub" ON user_subscriptions FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
);

INSERT INTO subscription_plans (name, slug, price_monthly, price_yearly, description, features) VALUES
  ('Pintaê Pro', 'pintae-pro', 49.90, 499.00,
   'Acesso completo à plataforma com benefícios exclusivos',
   '["Acesso à comunidade exclusiva","Dicas e tutoriais premium","Blog com conteúdo especializado","10% de desconto na loja","Orçamentos prioritários","Badge de usuário verificado","Suporte prioritário"]')
ON CONFLICT (slug) DO NOTHING;
