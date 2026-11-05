-- Nombre propio de la app del cliente (idea de Fitai Labs, ver replica/recon-fitailabs.md, G6).
--
-- Hasta ahora, al instalar la app en el móvil el icono se llama «NutriFit». Con app_name, el nutricionista elige cómo se llama
-- la suya («Consulta Marta», «Nutri Lucía»): es el nombre que ve su cliente en el icono, en la pestaña y al instalarla.
-- El cliente lo recibe con el resto de la marca (get_nutricionista_branding_by_token, que ya llaman también los anónimos
-- con su enlace personal: no devuelve nada que no devolviera ya, salvo este nombre).
alter table public.nutricionistas add column if not exists app_name text
  check (app_name is null or char_length(btrim(app_name)) between 1 and 24);

drop function if exists public.get_nutricionista_branding_by_token(text);
create or replace function public.get_nutricionista_branding_by_token(p_token text)
returns table(display_name text, logo_url text, accent_color text, contact_phone text, consent_document_url text, app_name text)
language sql stable security definer set search_path = public as $$
  select n.display_name, n.logo_url, n.accent_color, n.contact_phone, n.consent_document_url, n.app_name
  from clientes c join nutricionistas n on n.uid = c.nutricionista_id
  where c.token = p_token
  limit 1;
$$;
