SET search_path TO pintae, public;

-- Leads de exemplo em diferentes estágios
-- (ON CONFLICT DO NOTHING garante idempotência)
INSERT INTO leads (name, phone, email, source, source_detail, service_interest, neighborhood, stage, protocol, stage_updated_at, tags, estimated_value, created_at)
VALUES
  ('Maria Silva',     '48991234001', 'maria.silva@gmail.com',    'chat',      'web_chat', 'Pintura interna',  'Campeche',      'new',           'PT-20260531-A1B2', NOW()-INTERVAL '2 hours',  ARRAY['web_chat','Pintura interna','Campeche'],      1800, NOW()-INTERVAL '2 hours'),
  ('João Pereira',    '48991234002', 'joao.pereira@gmail.com',   'chat',      'web_chat', 'Fachada externa',  'Rio Tavares',   'contacted',     'PT-20260530-C3D4', NOW()-INTERVAL '1 day',   ARRAY['web_chat','Fachada externa','Rio Tavares'],   3500, NOW()-INTERVAL '1 day'),
  ('Ana Costa',       '48991234003', 'ana.costa@gmail.com',      'whatsapp',  'web_chat', 'Pós-obra',         'Armação',       'qualified',     'PT-20260529-E5F6', NOW()-INTERVAL '2 days',  ARRAY['web_chat','Pós-obra','Armação'],              2200, NOW()-INTERVAL '2 days'),
  ('Carlos Lima',     '48991234004', 'carlos.lima@gmail.com',    'chat',      'web_chat', 'Pintura interna',  'Campeche',      'proposal_sent', 'PT-20260528-G7H8', NOW()-INTERVAL '3 days',  ARRAY['web_chat','Pintura interna','Campeche'],      2800, NOW()-INTERVAL '3 days'),
  ('Paula Ramos',     '48991234005', 'paula.ramos@gmail.com',    'web',       'web_chat', 'Textura',          'Pântano do Sul','won',           'PT-20260525-I9J0', NOW()-INTERVAL '6 days',  ARRAY['web','Textura','Pântano do Sul'],             4200, NOW()-INTERVAL '6 days'),
  ('Roberto Santos',  '48991234006', 'roberto@gmail.com',        'chat',      'web_chat', 'Impermeabilização','Morro das Pedras','contacted',   'PT-20260524-K1L2', NOW()-INTERVAL '7 days',  ARRAY['web_chat','Impermeabilização','Morro das Pedras'],5000,NOW()-INTERVAL '7 days'),
  ('Fernanda Alves',  '48991234007', 'fernanda@gmail.com',       'whatsapp',  'web_chat', 'Arte / mural',     'Campeche',      'qualified',     'PT-20260523-M3N4', NOW()-INTERVAL '8 days',  ARRAY['whatsapp','Arte / mural','Campeche'],         6500, NOW()-INTERVAL '8 days'),
  ('Lucas Oliveira',  '48991234008', 'lucas@gmail.com',          'chat',      'web_chat', 'Pintura interna',  'Rio Tavares',   'won',           'PT-20260520-O5P6', NOW()-INTERVAL '11 days', ARRAY['web_chat','Pintura interna','Rio Tavares'],   3100, NOW()-INTERVAL '11 days')
ON CONFLICT DO NOTHING;

-- Atividades de CRM para simular histórico
INSERT INTO crm_activities (type, title, created_at)
VALUES
  ('lead_created',  'Novo lead: Maria Silva via chat',        NOW()-INTERVAL '2 hours'),
  ('lead_created',  'Novo lead: João Pereira via chat',       NOW()-INTERVAL '1 day'),
  ('stage_change',  'João Pereira → Contatado',               NOW()-INTERVAL '22 hours'),
  ('lead_created',  'Novo lead: Ana Costa via WhatsApp',      NOW()-INTERVAL '2 days'),
  ('stage_change',  'Ana Costa → Qualificado',                NOW()-INTERVAL '1 day 20 hours'),
  ('stage_change',  'Carlos Lima → Proposta Enviada',         NOW()-INTERVAL '3 days'),
  ('stage_change',  'Paula Ramos → Confirmado (Won)!',        NOW()-INTERVAL '6 days'),
  ('stage_change',  'Lucas Oliveira → Confirmado (Won)!',     NOW()-INTERVAL '11 days')
ON CONFLICT DO NOTHING;
