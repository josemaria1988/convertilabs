-- DESTRUCTIVE RESET FOR NON-PRODUCTION CONVERTILABS 2.0 DATABASES ONLY.
-- This drops every table, view, function, trigger, policy and type in schema public.
-- It intentionally does not drop Supabase managed schemas such as auth, storage or extensions.

drop schema if exists public cascade;
create schema public;

grant usage on schema public to postgres;
grant usage on schema public to anon;
grant usage on schema public to authenticated;
grant usage on schema public to service_role;

grant all on schema public to postgres;
grant all on schema public to service_role;

alter default privileges in schema public
  grant all on tables to postgres, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

alter default privileges in schema public
  grant all on sequences to postgres, service_role;

alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;

alter default privileges in schema public
  grant all on functions to postgres, service_role;

alter default privileges in schema public
  grant execute on functions to anon, authenticated;

create extension if not exists pgcrypto with schema public;
