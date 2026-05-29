SET search_path TO pintae, public;

-- ─── Workspaces (pintor solo ou loja com equipe) ──────────────────────────────
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'solo',
  owner_user_id UUID NOT NULL REFERENCES users(id),
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  can_view_all_leads BOOLEAN DEFAULT FALSE,
  can_edit_leads BOOLEAN DEFAULT TRUE,
  can_manage_members BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workspace_id, user_id)
);

-- ─── Admin permissions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  can_manage_users BOOLEAN DEFAULT FALSE,
  can_manage_painters BOOLEAN DEFAULT TRUE,
  can_approve_kyc BOOLEAN DEFAULT FALSE,
  can_view_payments BOOLEAN DEFAULT FALSE,
  can_manage_products BOOLEAN DEFAULT FALSE,
  can_view_all_crm BOOLEAN DEFAULT FALSE,
  can_ban_users BOOLEAN DEFAULT FALSE,
  can_manage_admins BOOLEAN DEFAULT FALSE,
  granted_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Superadmin gets all permissions
INSERT INTO admin_permissions (user_id, can_manage_users, can_manage_painters, can_approve_kyc,
  can_view_payments, can_manage_products, can_view_all_crm, can_ban_users, can_manage_admins)
SELECT id, true, true, true, true, true, true, true, true
FROM users WHERE email = 'admin@pintai.com.br'
ON CONFLICT (user_id) DO UPDATE SET
  can_manage_users = true, can_manage_painters = true, can_approve_kyc = true,
  can_view_payments = true, can_manage_products = true, can_view_all_crm = true,
  can_ban_users = true, can_manage_admins = true;

-- ─── CRM Leads ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  assigned_to UUID REFERENCES users(id),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source TEXT DEFAULT 'web',
  service_interest TEXT,
  neighborhood TEXT,
  estimated_value NUMERIC,
  stage TEXT NOT NULL DEFAULT 'new',
  stage_updated_at TIMESTAMPTZ DEFAULT NOW(),
  lost_reason TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  service_request_id UUID REFERENCES service_requests(id),
  converted_to_client_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CRM Clients ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  assigned_to UUID REFERENCES users(id),
  user_id UUID REFERENCES users(id),
  lead_id UUID REFERENCES leads(id),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  neighborhood TEXT,
  client_type TEXT DEFAULT 'residential',
  lifetime_value NUMERIC DEFAULT 0,
  jobs_count INTEGER DEFAULT 0,
  last_service_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,
  rating_avg NUMERIC,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CRM Activities ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id),
  client_id UUID REFERENCES crm_clients(id),
  workspace_id UUID REFERENCES workspaces(id),
  user_id UUID REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT,
  body TEXT,
  old_stage TEXT,
  new_stage TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CMS Blocks ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cms_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_key TEXT UNIQUE NOT NULL,
  block_type TEXT NOT NULL,
  content JSONB NOT NULL,
  label TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default CMS content
INSERT INTO cms_blocks (block_key, block_type, label, content) VALUES
  ('hero_title',     'text',       'Título principal do hero',    '"O pintor certo para o seu espaço."'),
  ('hero_subtitle',  'text',       'Subtítulo do hero',           '"Pare de contratar às cegas. IA analisa seu projeto, profissionais verificados respondem."'),
  ('cta_primary',    'text',       'Texto do CTA principal',      '"Encontrar meu pintor"'),
  ('cta_secondary',  'text',       'Texto do CTA secundário',     '"Ver como funciona"'),
  ('before_after_1', 'image_pair', 'Antes/Depois — bloco 1',      '{"before":"https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=600&q=80","after":"https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80","label":"Sala · Campeche"}'),
  ('before_after_2', 'image_pair', 'Antes/Depois — bloco 2',      '{"before":"https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600&q=80","after":"https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80","label":"Fachada · Rio Tavares"}'),
  ('before_after_3', 'image_pair', 'Antes/Depois — bloco 3',      '{"before":"https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&q=80","after":"https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=600&q=80","label":"Apartamento · Armação"}'),
  ('stats',          'json_array', 'Estatísticas da plataforma',  '[{"value":"200+","label":"pintores ativos"},{"value":"1.200+","label":"serviços concluídos"},{"value":"4.8★","label":"avaliação média real"}]'),
  ('pain_points',    'json_array', 'Pain points (pills vermelhos)', '[{"text":"Pintor sem histórico verificado"},{"text":"Preço sem nenhuma base técnica"},{"text":"Você no escuro sem referência"}]')
ON CONFLICT (block_key) DO NOTHING;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_admin" ON workspaces FOR ALL USING (is_admin());
CREATE POLICY "ws_owner" ON workspaces FOR ALL USING (owner_user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));
CREATE POLICY "ws_member_read" ON workspaces FOR SELECT USING (
  id IN (SELECT workspace_id FROM workspace_members wm JOIN users u ON u.id = wm.user_id WHERE u.auth_user_id = auth.uid())
);

CREATE POLICY "wsm_admin" ON workspace_members FOR ALL USING (is_admin());
CREATE POLICY "wsm_own" ON workspace_members FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "ap_admin_all" ON admin_permissions FOR ALL USING (is_admin());
CREATE POLICY "ap_own_read" ON admin_permissions FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "leads_admin" ON leads FOR ALL USING (is_admin());
CREATE POLICY "leads_assigned" ON leads FOR ALL USING (
  assigned_to IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
);
CREATE POLICY "leads_workspace" ON leads FOR SELECT USING (
  workspace_id IN (SELECT wm.workspace_id FROM workspace_members wm JOIN users u ON u.id = wm.user_id WHERE u.auth_user_id = auth.uid() AND wm.can_view_all_leads = true)
);

CREATE POLICY "cc_admin" ON crm_clients FOR ALL USING (is_admin());
CREATE POLICY "cc_assigned" ON crm_clients FOR ALL USING (
  assigned_to IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "ca_admin" ON crm_activities FOR ALL USING (is_admin());
CREATE POLICY "ca_own" ON crm_activities FOR ALL USING (
  user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "cms_public_read" ON cms_blocks FOR SELECT USING (true);
CREATE POLICY "cms_admin_write" ON cms_blocks FOR ALL USING (is_admin());

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_workspace ON leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_clients_workspace ON crm_clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_lead ON crm_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members ON workspace_members(workspace_id, user_id);
