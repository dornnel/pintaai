-- Fix client flow step ordering
-- Previous migration (030) caused duplicate order_index values by shifting
-- only steps < 10, leaving the higher-indexed steps colliding.
-- Correct order: service_type(1) → neighborhood(2) → property_type(3) →
--   lead_name(4) → lead_email(5) → lead_whatsapp(6) → media_upload(7) →
--   wall_condition(8) → num_rooms(9) → area_m2(10) → deadline(11) →
--   material(12) → preferred_professional(13) → estimated_budget(14) →
--   current_color(15) → final_notes(16) → confirmation(17)

UPDATE pintae.agent_flow_steps SET order_index = 1  WHERE step_key = 'service_type';
UPDATE pintae.agent_flow_steps SET order_index = 2  WHERE step_key = 'neighborhood';
UPDATE pintae.agent_flow_steps SET order_index = 3  WHERE step_key = 'property_type';
UPDATE pintae.agent_flow_steps SET order_index = 4  WHERE step_key = 'lead_name';
UPDATE pintae.agent_flow_steps SET order_index = 5  WHERE step_key = 'lead_email';
UPDATE pintae.agent_flow_steps SET order_index = 6  WHERE step_key = 'lead_whatsapp';
UPDATE pintae.agent_flow_steps SET order_index = 7  WHERE step_key = 'media_upload';
UPDATE pintae.agent_flow_steps SET order_index = 8  WHERE step_key = 'wall_condition';
UPDATE pintae.agent_flow_steps SET order_index = 9  WHERE step_key = 'num_rooms';
UPDATE pintae.agent_flow_steps SET order_index = 10 WHERE step_key = 'area_m2';
UPDATE pintae.agent_flow_steps SET order_index = 11 WHERE step_key = 'deadline';
UPDATE pintae.agent_flow_steps SET order_index = 12 WHERE step_key = 'material';
UPDATE pintae.agent_flow_steps SET order_index = 13 WHERE step_key = 'preferred_professional';
UPDATE pintae.agent_flow_steps SET order_index = 14 WHERE step_key = 'estimated_budget';
UPDATE pintae.agent_flow_steps SET order_index = 15 WHERE step_key = 'current_color';
UPDATE pintae.agent_flow_steps SET order_index = 16 WHERE step_key = 'final_notes';
UPDATE pintae.agent_flow_steps SET order_index = 17 WHERE step_key = 'confirmation';
