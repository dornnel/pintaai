-- Add multi_select flag to agent_flow_steps
-- When true, the chat UI renders toggle chips + confirm button (multiple values joined with " + ")
ALTER TABLE agent_flow_steps ADD COLUMN IF NOT EXISTS multi_select BOOLEAN NOT NULL DEFAULT false;

-- wall_condition is the canonical multi-select step
UPDATE agent_flow_steps SET multi_select = true WHERE field_key = 'wall_condition';
