-- El cliente necesita ver el nombre de su nutricionista en la pantalla de
-- registro/login, antes de tener sesión — un cliente anónimo no puede leer
-- la tabla nutricionistas por RLS, así que se expone solo el display_name
-- vía RPC SECURITY DEFINER, igual que get_client_by_token.

create or replace function public.get_nutricionista_name_by_token(p_token text) returns text
language sql stable security definer set search_path = public as $$
  select n.display_name
  from clientes c join nutricionistas n on n.uid = c.nutricionista_id
  where c.token = p_token
  limit 1;
$$;
