SET search_path TO pintae, public;

-- Seed: Bairros iniciais (Sul da Ilha - Florianópolis)

INSERT INTO neighborhoods (name, region, city, latitude, longitude, active, launch_priority) VALUES
  ('Campeche',          'Sul da Ilha', 'Florianópolis', -27.6879, -48.4850, true, 1),
  ('Rio Tavares',       'Sul da Ilha', 'Florianópolis', -27.6568, -48.4717, true, 1),
  ('Morro das Pedras',  'Sul da Ilha', 'Florianópolis', -27.7097, -48.5089, true, 1),
  ('Armação',           'Sul da Ilha', 'Florianópolis', -27.7372, -48.5108, true, 1),
  ('Pântano do Sul',    'Sul da Ilha', 'Florianópolis', -27.7806, -48.5117, true, 1),
  ('Tapera',            'Sul da Ilha', 'Florianópolis', -27.6711, -48.5186, true, 1),
  ('Costeira do Pirajubaé', 'Sul da Ilha', 'Florianópolis', -27.6397, -48.5364, true, 1),
  ('Ribeirão da Ilha',  'Sul da Ilha', 'Florianópolis', -27.7497, -48.5522, true, 2),
  ('Carianos',          'Sul da Ilha', 'Florianópolis', -27.6619, -48.5394, true, 2),
  ('Lagoa da Conceição','Lagoa',       'Florianópolis', -27.6003, -48.4581, true, 3),
  ('Centro',            'Centro',      'Florianópolis', -27.5969, -48.5495, true, 4),
  ('Trindade',          'Centro',      'Florianópolis', -27.5872, -48.5192, true, 4);
