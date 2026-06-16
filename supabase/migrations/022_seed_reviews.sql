SET search_path TO pintae, public;

-- Make FK columns nullable so reviews can exist without service_request/customer records
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_service_request_id_fkey;
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_customer_id_fkey;
ALTER TABLE reviews ALTER COLUMN service_request_id DROP NOT NULL;
ALTER TABLE reviews ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE reviews ADD CONSTRAINT reviews_service_request_id_fkey
  FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE SET NULL;
ALTER TABLE reviews ADD CONSTRAINT reviews_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- Seed 5 reviews per painter (first 5 painters by created_at)
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN SELECT id FROM painters ORDER BY created_at LIMIT 5 LOOP
    INSERT INTO reviews (id, service_request_id, customer_id, provider_type, provider_id,
      rating_overall, rating_quality, rating_punctuality, rating_cleanliness, rating_communication,
      comment, sentiment_label, sentiment_score, ai_summary, created_at)
    VALUES
      (gen_random_uuid(), NULL, NULL, 'painter', p.id, 5, 5, 5, 5, 5,
       'Trabalho impecável! O pintor chegou no horário, protegeu todos os móveis e a pintura ficou perfeita.',
       'positive', 0.95, 'Cliente muito satisfeito com qualidade e pontualidade.', now() - interval '3 days'),
      (gen_random_uuid(), NULL, NULL, 'painter', p.id, 5, 5, 4, 5, 5,
       'Melhor pintor que já contratei em Floripa. Acabamento perfeito, sem respingos, limpou tudo após o serviço.',
       'positive', 0.92, 'Elogio ao acabamento e limpeza do local.', now() - interval '8 days'),
      (gen_random_uuid(), NULL, NULL, 'painter', p.id, 4, 4, 5, 4, 4,
       'Bom profissional, cumpriu o prazo. Poderia ter comunicado melhor sobre os materiais.',
       'positive', 0.72, 'Satisfeito com o serviço, pequena ressalva na comunicação.', now() - interval '15 days'),
      (gen_random_uuid(), NULL, NULL, 'painter', p.id, 4, 4, 4, 4, 5,
       'Gostei muito do resultado. O pintor foi super atencioso e respondeu todas as dúvidas rapidamente.',
       'positive', 0.81, 'Boa comunicação e resultado satisfatório.', now() - interval '22 days'),
      (gen_random_uuid(), NULL, NULL, 'painter', p.id, 3, 3, 4, 3, 3,
       'Serviço ok, mas demorou um dia a mais do previsto. Resultado final ficou bom.',
       'neutral', 0.55, 'Serviço concluído com atraso, qualidade adequada.', now() - interval '30 days');
  END LOOP;
END $$;
