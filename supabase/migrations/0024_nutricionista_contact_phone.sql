-- Teléfono de contacto del nutricionista para el botón de WhatsApp directo
-- en la cabecera del modo cliente ("cualquier duda urgente sobre el menú").
alter table nutricionistas add column contact_phone text;

drop function if exists public.get_nutricionista_branding_by_token(text);

create or replace function public.get_nutricionista_branding_by_token(p_token text)
returns table(display_name text, logo_url text, accent_color text, contact_phone text)
language sql stable security definer set search_path = public as $$
  select n.display_name, n.logo_url, n.accent_color, n.contact_phone
  from clientes c join nutricionistas n on n.uid = c.nutricionista_id
  where c.token = p_token
  limit 1;
$$;
