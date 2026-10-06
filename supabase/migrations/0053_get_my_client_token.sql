-- Un cliente que entra por la página principal ("/") en vez de por su enlace personal
-- no tiene cuenta de nutricionista, así que la app le CERRABA la sesión y le obligaba a
-- volver a escribir correo y contraseña cada vez. Con esta función la app sabe cuál es
-- su enlace (token) y lo lleva a su app con la sesión intacta.
--
-- Solo devuelve el token de la ficha del propio usuario (auth.uid()): nadie puede pedir el
-- de otro, y sin sesión no se puede llamar.
create or replace function public.get_my_client_token()
returns text language sql stable security definer set search_path = public as $$
  select c.token from public.clientes c where c.auth_user_id = auth.uid() order by c.created_at desc limit 1;
$$;

revoke all on function public.get_my_client_token() from public, anon;
grant execute on function public.get_my_client_token() to authenticated;
