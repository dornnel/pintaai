-- Separates "enabled in flow" from "not soft-deleted" (active).
-- enabled=false → step is skipped by the flow engine but remains visible in admin.
ALTER TABLE pintae.agent_flow_steps
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true;
