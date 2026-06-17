-- Fix: garante role_select como primeiro step do branch client com opção de pintor
-- e ativa use_ai_transition nos steps do branch painter para respostas humanizadas.
-- Também adiciona coluna lead_type à tabela leads para distinguir leads de clientes vs pintores.

-- 1. Empurra todos os steps existentes do branch client para índices maiores (libera slot 0)
UPDATE pintae.agent_flow_steps
SET order_index = order_index + 10
WHERE branch = 'client' AND step_key != 'role_select' AND order_index < 10;

-- 2. Upsert do role_select como primeiro step do branch client
INSERT INTO pintae.agent_flow_steps (
  step_key, branch, order_index, active, editable,
  question_template, step_type, quick_replies, field_key,
  validation_type, skippable, use_ai_transition, is_core_field
) VALUES (
  'role_select', 'client', 0, true, false,
  'Oi! 👋 Como posso te ajudar hoje?',
  'quick_reply',
  ARRAY[
    '🏠 Pintura interna',
    '🏚️ Fachada externa',
    '🔨 Pós-obra',
    '🎨 Textura / massa corrida',
    '💧 Impermeabilização',
    '🖼️ Arte / mural',
    '🖌️ Quero me cadastrar como pintor'
  ],
  'role', 'none', false, false, true
)
ON CONFLICT (step_key) DO UPDATE SET
  quick_replies = EXCLUDED.quick_replies,
  question_template = EXCLUDED.question_template,
  active = true,
  order_index = 0;

-- 3. Ativa use_ai_transition em todos os steps do branch painter para respostas humanizadas
UPDATE pintae.agent_flow_steps
SET use_ai_transition = true
WHERE branch = 'painter';

-- 4. Adiciona coluna lead_type à tabela leads para distinguir clientes de pintores no CRM
ALTER TABLE pintae.leads
  ADD COLUMN IF NOT EXISTS lead_type TEXT NOT NULL DEFAULT 'customer'
  CHECK (lead_type IN ('customer', 'painter'));
