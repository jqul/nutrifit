-- Los helpers de ownership usados en las políticas RLS no deben ser API pública
-- (PostgREST expone todo lo que hay en el schema "public" como RPC). Se mueven
-- a un schema "private" no expuesto — Postgres resuelve las políticas RLS por
-- OID de función, así que moverlas de schema no rompe las políticas existentes.

create schema if not exists private;

alter function public.is_super_admin() set schema private;
alter function public.is_nutricionista_of_client(uuid) set schema private;
alter function public.is_owner_client(uuid) set schema private;
alter function public.is_client_of_nutricionista(uuid) set schema private;
alter function public.is_nutricionista_of_plan(uuid) set schema private;
alter function public.is_owner_of_plan(uuid) set schema private;
alter function public.is_nutricionista_of_meal(uuid) set schema private;
alter function public.is_owner_of_meal(uuid) set schema private;

grant usage on schema private to anon, authenticated;
grant execute on all functions in schema private to anon, authenticated;
