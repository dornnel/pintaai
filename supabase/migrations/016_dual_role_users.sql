SET search_path TO pintae, public;

-- Suporte a perfil duplo (cliente + pintor, estilo Uber)
ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT[];
UPDATE users SET roles = ARRAY[role::TEXT] WHERE roles IS NULL;
ALTER TABLE users ALTER COLUMN roles SET DEFAULT ARRAY['customer'];

CREATE INDEX IF NOT EXISTS idx_users_roles ON users USING GIN (roles);

-- Necessário para o usuário logado conseguir virar pintor (atualizar seu próprio roles)
CREATE POLICY "users_own_update_roles" ON users FOR UPDATE
  USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());
