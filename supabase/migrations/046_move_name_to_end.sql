-- 046: Move lead_name step to end of journey (after service questions, before email)
-- Reduces funnel abandonment by asking for name only after user is engaged.
-- New order: service → neighborhood → property → [conditionals] → surfaces → ... → final_notes → name → email → whatsapp → confirmation

SET search_path TO pintae, public;

UPDATE agent_flow_steps
   SET order_index = 12.50
 WHERE step_key = 'lead_name'
   AND branch = 'client';
