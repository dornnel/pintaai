SET search_path TO pintae, public;

ALTER TABLE painters ADD COLUMN IF NOT EXISTS service_radius_km NUMERIC DEFAULT 10;

INSERT INTO platform_settings (key, value, label, description) VALUES
  ('auto_assign_painters_geo', 'false', 'Distribuição automática por geolocalização', 'Quando ativo, novos leads do chat são automaticamente enviados aos pintores próximos ao bairro do cliente'),
  ('auto_assign_radius_km_default', '10', 'Raio padrão de distribuição (km)', 'Usado quando o pintor não define um raio próprio')
ON CONFLICT (key) DO NOTHING;
