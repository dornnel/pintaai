SET search_path TO pintae, public;

-- ============================================================
-- Tabela de passos configuráveis da jornada do agente Koke
-- Substitui o objeto FLOW hardcoded em src/hooks/useChat.ts
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_flow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_key TEXT UNIQUE NOT NULL,
  branch TEXT NOT NULL DEFAULT 'client',
  order_index INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  editable BOOLEAN NOT NULL DEFAULT true,
  question_template TEXT NOT NULL,
  step_type TEXT NOT NULL DEFAULT 'text',
  quick_replies TEXT[],
  field_key TEXT NOT NULL,
  validation_type TEXT NOT NULL DEFAULT 'none',
  skippable BOOLEAN NOT NULL DEFAULT false,
  use_ai_transition BOOLEAN NOT NULL DEFAULT false,
  is_core_field BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_flow_steps_branch_order ON agent_flow_steps(branch, order_index) WHERE active = true;

ALTER TABLE agent_flow_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flow_steps_public_read" ON agent_flow_steps;
CREATE POLICY "flow_steps_public_read" ON agent_flow_steps FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "flow_steps_admin_all" ON agent_flow_steps;
CREATE POLICY "flow_steps_admin_all" ON agent_flow_steps FOR ALL USING (is_admin());

-- Permite perguntas custom adicionadas pelo admin sem precisar de nova coluna em `leads`
ALTER TABLE leads ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- ============================================================
-- Seed: jornada padrão (client + painter)
-- ============================================================

INSERT INTO agent_flow_steps
  (step_key, branch, order_index, active, editable, question_template, step_type, quick_replies, field_key, validation_type, skippable, use_ai_transition, is_core_field)
VALUES
  -- ---------------- CLIENT BRANCH ----------------
  ('role_select', 'client', 1, true, false,
    E'Oi! 👋 Eu sou o Koke, vou te ajudar a encontrar o pintor ideal pro seu projeto.\n\nPra começar: você é **cliente** procurando um pintor, ou **pintor** querendo receber pedidos?',
    'quick_reply', ARRAY['Sou cliente','Sou pintor'], 'role', 'none', false, false, true),

  ('service_type', 'client', 2, true, true,
    'Que tipo de serviço você precisa?',
    'quick_reply', ARRAY['Pintura interna','Fachada externa','Pós-obra','Textura / massa corrida','Impermeabilização','Arte / mural'], 'service_type', 'none', false, true, true),

  ('property_type', 'client', 3, true, true,
    'Que tipo de **imóvel** é?',
    'quick_reply', ARRAY['Apartamento','Casa','Loja / Comércio','Airbnb / Temporada','Outro'], 'property_type', 'none', false, true, true),

  ('lead_name', 'client', 4, true, true,
    'Para continuarmos, me diz o seu nome por favor! 😊',
    'text', NULL, 'name', 'name', false, false, true),

  ('lead_email', 'client', 5, true, true,
    E'Prazer, {{name}}! Qual é o seu **e-mail**?',
    'text', NULL, 'email', 'email', false, false, true),

  ('lead_whatsapp', 'client', 6, true, true,
    'E o seu **WhatsApp** com DDD? Ex: (48) 9 9999-9999',
    'text', NULL, 'whatsapp', 'phone', false, false, true),

  ('neighborhood', 'client', 7, true, true,
    'Em qual **bairro** fica o local a ser pintado?',
    'quick_reply', ARRAY['Campeche','Rio Tavares','Armação','Morro das Pedras','Pântano do Sul','Outro bairro'], 'neighborhood', 'none', false, false, true),

  ('area_m2', 'client', 8, true, true,
    E'Você tem uma ideia da **metragem do espaço** (em m²)? Isso ajuda a calcular uma estimativa mais precisa.\n\nEx: 45 (ou "não sei" se preferir pular)',
    'text', ARRAY['Não sei estimar'], 'area_m2', 'area_m2', true, false, true),

  ('media_upload', 'client', 9, true, true,
    E'Agora me manda **fotos ou um vídeo** do local (até 1 minuto). Isso me ajuda a estimar a metragem com mais precisão.\n\nUse o clipe aqui embaixo ou clique em "Pular por agora".',
    'media', ARRAY['Pular por agora'], 'media_urls', 'none', true, false, true),

  ('wall_condition', 'client', 10, true, true,
    'Como está o **estado atual das paredes**?',
    'quick_reply', ARRAY['Bom estado','Manchas / sujeira','Descascando','Rachaduras','Mofo','Pós-obra (reboco novo)'], 'wall_condition', 'none', false, false, true),

  ('deadline', 'client', 11, true, true,
    'Qual o **prazo** que você tem em mente?',
    'quick_reply', ARRAY['O mais rápido possível','Próximas 2 semanas','Próximo mês','Sem prazo definido'], 'deadline', 'none', false, false, true),

  ('material', 'client', 12, true, true,
    'O **material** (tinta, primer) vai ser incluso no serviço?',
    'quick_reply', ARRAY['Incluso no serviço','Vou comprar separado','O pintor que indique'], 'material', 'none', false, false, true),

  ('preferred_professional', 'client', 13, true, true,
    'Tem algum **pintor de preferência** ou já trabalhou com alguém antes? (pode pular)',
    'text', ARRAY['Pular'], 'preferred_professional', 'none', true, false, true),

  ('estimated_budget', 'client', 14, true, true,
    'Tem alguma **faixa de orçamento** em mente para o projeto?',
    'quick_reply', ARRAY['Até R$500','R$500 – R$2.000','R$2.000 – R$5.000','Acima de R$5.000','Sem preferência'], 'estimated_budget', 'none', false, false, true),

  ('current_color', 'client', 15, true, true,
    'Qual a **cor atual** das paredes? Isso ajuda o pintor a planejar a cobertura. (pode pular)',
    'text', ARRAY['Pular'], 'current_color', 'none', true, false, true),

  ('final_notes', 'client', 16, true, true,
    E'Alguma **observação adicional** que possa ajudar o pintor?\n\nEx: "Tem móveis pesados", "Acesso difícil", "Obra em andamento"...\n\nPode escrever aqui, enviar uma foto/vídeo extra, ou clique em "Pular".',
    'media', ARRAY['Pular por agora'], 'final_notes', 'none', true, false, true),

  ('confirmation', 'client', 17, true, false,
    E'**Resumo do pedido:**\n\n{{summary}}\n\nAo confirmar, você declara que as informações são verídicas e concorda com nossa [Política de Privacidade](/privacidade) (LGPD). **Podemos enviar para os pintores?**',
    'quick_reply', ARRAY['✅ Confirmar e enviar','✏️ Corrigir algum dado'], 'confirmed', 'none', false, false, true),

  -- ---------------- PAINTER BRANCH ----------------
  -- role_select é compartilhado (branch='client', order 1); ao escolher "Sou pintor"
  -- o motor troca para branch='painter' a partir do order_index=1 abaixo.
  ('painter_name', 'painter', 1, true, true,
    'Você quer receber pedidos de clientes! 🎨 Pra começar, me diz o seu nome?',
    'text', NULL, 'name', 'name', false, false, true),

  ('painter_email', 'painter', 2, true, true,
    E'Prazer, {{name}}! Qual é o seu **e-mail**?',
    'text', NULL, 'email', 'email', false, false, true),

  ('painter_whatsapp', 'painter', 3, true, true,
    'E o seu **WhatsApp** com DDD? Ex: (48) 9 9999-9999',
    'text', NULL, 'whatsapp', 'phone', false, false, true),

  ('painter_neighborhoods', 'painter', 4, true, true,
    E'Legal, {{name}}! Em quais **bairros** você atua? (ex: Campeche, Rio Tavares)',
    'text', NULL, 'painter_neighborhoods', 'min3', false, false, true),

  ('painter_specialties', 'painter', 5, true, true,
    'Quais são suas **especialidades**?',
    'quick_reply', ARRAY['Pintura interna','Fachada','Textura / massa corrida','Impermeabilização','Arte / mural','Geral (todos)'], 'painter_specialties', 'none', false, false, true),

  ('painter_experience', 'painter', 6, true, true,
    'Quantos **anos de experiência** você tem?',
    'quick_reply', ARRAY['Menos de 1 ano','1 a 3 anos','3 a 5 anos','Mais de 5 anos'], 'painter_experience', 'none', false, false, true)

ON CONFLICT (step_key) DO NOTHING;
