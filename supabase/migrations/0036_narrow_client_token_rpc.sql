-- get_client_by_token (0001_init.sql) es SECURITY DEFINER y "returns setof
-- clientes" — devuelve la fila COMPLETA (teléfono, email, fecha de
-- nacimiento, género, altura, alergias, notas, precio mensual...) a
-- cualquiera que tenga el token, ANTES de autenticarse. Se llama desde
-- ClientView.tsx solo para decidir si hace falta registrarse, iniciar
-- sesión o firmar el consentimiento — no hace falta ni de lejos toda esa
-- información para eso, solo el nombre (para el saludo) y tres flags.
--
-- La sustituye una versión mínima. El resto del perfil se sigue leyendo
-- después, ya autenticado, con una consulta normal a `clientes` — la
-- política RLS que ya existe (nutricionista_or_client_owns_clientes,
-- 0001_init.sql) protege esa fila igual de bien sin necesitar ningún RPC.
create or replace function public.get_client_auth_status_by_token(p_token text)
returns table(id uuid, name text, surname text, auth_user_id uuid, consent_accepted_at timestamptz)
language sql stable security definer set search_path = public as $$
  select id, name, surname, auth_user_id, consent_accepted_at
  from clientes where token = p_token limit 1;
$$;

drop function if exists public.get_client_by_token(text);

-- Aplicada directamente a la base de datos real vía MCP en la misma sesión
-- en que se desplegó el frontend actualizado (ClientView.tsx ya no llama a
-- get_client_by_token), para evitar la ventana en la que clientes con la
-- versión vieja de la app en caché no podrían iniciar sesión.
