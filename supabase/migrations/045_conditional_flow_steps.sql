-- 045: Add conditional columns to agent_flow_steps + insert synthetic steps as DB records
-- Makes property_scope and visit_preference visible in the admin agent flow builder.

SET search_path TO pintae, public;

-- ── 1. Add condition columns ───────────────────────────────────────────────────
ALTER TABLE agent_flow_steps
  ADD COLUMN IF NOT EXISTS condition_key  TEXT,
  ADD COLUMN IF NOT EXISTS condition_value TEXT;

-- ── 2. Upgrade order_index to NUMERIC(6,2) to allow fractional positioning ────
ALTER TABLE agent_flow_steps
  ALTER COLUMN order_index TYPE NUMERIC(6,2) USING order_index::NUMERIC(6,2);

-- ── 3. Insert property_scope (Casa → interna / externa / ambas) ───────────────
-- Triggered when property_type contains "Casa" (case-insensitive match in useChat)
INSERT INTO agent_flow_steps (
  step_key, branch, order_index, active, enabled, editable,
  question_template, step_type, quick_replies,
  field_key, validation_type, skippable,
  use_ai_transition, is_core_field, multi_select,
  condition_key, condition_value
)
SELECT
  'property_scope', 'client',
  COALESCE(
    (SELECT order_index FROM agent_flow_steps WHERE step_key = 'property_type' AND branch = 'client' LIMIT 1),
    4
  ) + 0.50,
  true, true, false,
  'É uma **casa**! A pintura será interna, externa ou ambas? 🏡',
  'quick_reply',
  ARRAY['🛋️ Apenas interna', '🏗️ Apenas externa (fachada, muros)', '✅ Ambas (interna + externa)'],
  'property_scope', 'none', false, false, true, false,
  'property_type', 'Casa'
WHERE NOT EXISTS (SELECT 1 FROM agent_flow_steps WHERE step_key = 'property_scope');

-- ── 4. Insert visit_preference (Sala / Loja / Outro → visita ou distância) ────
-- Triggered when property_type is NOT Apartamento and NOT Casa
INSERT INTO agent_flow_steps (
  step_key, branch, order_index, active, enabled, editable,
  question_template, step_type, quick_replies,
  field_key, validation_type, skippable,
  use_ai_transition, is_core_field, multi_select,
  condition_key, condition_value
)
SELECT
  'visit_preference', 'client',
  COALESCE(
    (SELECT order_index FROM agent_flow_steps WHERE step_key = 'property_type' AND branch = 'client' LIMIT 1),
    4
  ) + 0.70,
  true, true, false,
  'Para **{{property_type}}**, uma visita técnica rápida permite um orçamento muito mais preciso. 📋' || chr(10) || chr(10) || 'Como prefere prosseguir?',
  'quick_reply',
  ARRAY['📅 Quero agendar uma visita', '💻 Orçamento a distância por agora'],
  'site_visit_preference', 'none', false, false, true, false,
  'property_type', '!Apartamento,!Casa'
WHERE NOT EXISTS (SELECT 1 FROM agent_flow_steps WHERE step_key = 'visit_preference');
