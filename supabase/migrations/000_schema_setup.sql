-- Create isolated schema for Pintaê inside the Agenscia Supabase project.
-- All Pintaê tables live in "pintae"; Agenscia tables in "public" are untouched.

CREATE SCHEMA IF NOT EXISTS pintae;

GRANT USAGE ON SCHEMA pintae TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA pintae
  GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA pintae
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA pintae
  GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA pintae
  GRANT ALL ON SEQUENCES TO service_role, authenticated;
