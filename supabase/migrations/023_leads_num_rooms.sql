SET search_path TO pintae, public;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS num_rooms INTEGER;

COMMENT ON COLUMN leads.num_rooms IS 'Número de cômodos (complementa area_m2 no motor de orçamento)';
