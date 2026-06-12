SET search_path TO pintae, public;

-- 2 pintores de teste para validação E2E (sul da ilha + centro/norte)
INSERT INTO users (role, roles, name, phone, email, status, registration_source) VALUES
  ('painter', ARRAY['painter'], 'Pintor Teste 1 (Sul da Ilha)', '+5548999990001', 'pintor.teste1@pintae.com.br', 'pending', 'admin'),
  ('painter', ARRAY['painter'], 'Pintor Teste 2 (Centro/Norte)', '+5548999990002', 'pintor.teste2@pintae.com.br', 'pending', 'admin')
ON CONFLICT (phone) DO NOTHING;

-- Pintor Teste 1: especialista em pintura interna/fachada, atende sul da ilha
INSERT INTO painters (user_id, bio, years_experience, specialties, neighborhoods_ids, has_transport, accepts_material_included, availability_status, verification_status, service_radius_km, registration_source)
SELECT u.id,
  'Pintor de teste para validação do fluxo de leads (sul da ilha).',
  6,
  ARRAY['Pintura interna', 'Fachada', 'Textura / massa corrida'],
  ARRAY(SELECT id FROM neighborhoods WHERE name IN ('Campeche', 'Rio Tavares', 'Morro das Pedras', 'Armação')),
  true, true, 'available', 'verified', 12, 'admin'
FROM users u
WHERE u.phone = '+5548999990001'
  AND NOT EXISTS (SELECT 1 FROM painters p WHERE p.user_id = u.id);

-- Pintor Teste 2: especialista em arte/mural e pós-obra, atende centro/norte
INSERT INTO painters (user_id, bio, years_experience, specialties, neighborhoods_ids, has_transport, accepts_material_included, availability_status, verification_status, service_radius_km, registration_source)
SELECT u.id,
  'Pintor de teste para validação do fluxo de leads (centro/norte).',
  4,
  ARRAY['Arte / Mural', 'Pós-obra', 'Impermeabilização'],
  ARRAY(SELECT id FROM neighborhoods WHERE name IN ('Centro', 'Trindade', 'Lagoa da Conceição')),
  true, true, 'available', 'verified', 8, 'admin'
FROM users u
WHERE u.phone = '+5548999990002'
  AND NOT EXISTS (SELECT 1 FROM painters p WHERE p.user_id = u.id);
