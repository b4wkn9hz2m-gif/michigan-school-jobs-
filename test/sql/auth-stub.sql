-- Minimal stand-ins for Supabase's auth schema so the migration can be tested on plain Postgres.
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.role', true), '') $$;
create role authenticated;
