-- El cliente autenticado debe ver SU ficha, pero no los campos internos del
-- nutricionista (notas privadas, notas del informe, precio mensual, etiquetas,
-- mensajes personalizados, fecha de revisión). Hasta ahora la leía con un
-- `select *` a `clientes` amparado por RLS, que le entregaba la fila entera.
--
-- Esta función devuelve solo las columnas que el cliente necesita para su
-- panel. Es SECURITY DEFINER y solo devuelve la fila cuyo auth_user_id es el
-- usuario que llama. La 0044 cierra después el acceso directo a la tabla.
create or replace function public.get_my_client_profile(p_client_id uuid)
returns table (
  id uuid, nutricionista_id uuid, token text, auth_user_id uuid,
  name text, surname text, phone text, email text,
  birth_date date, gender text, height_cm numeric, goal text, allergies text,
  created_at timestamptz, goal_weight_kg numeric,
  consent_accepted_at timestamptz, consent_signed_name text
)
language sql stable security definer set search_path = public as $$
  select c.id, c.nutricionista_id, c.token, c.auth_user_id,
         c.name, c.surname, c.phone, c.email,
         c.birth_date, c.gender, c.height_cm, c.goal, c.allergies,
         c.created_at, c.goal_weight_kg,
         c.consent_accepted_at, c.consent_signed_name
  from clientes c
  where c.id = p_client_id and c.auth_user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_client_profile(uuid) from public, anon;
grant execute on function public.get_my_client_profile(uuid) to authenticated;
