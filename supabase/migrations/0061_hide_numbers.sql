-- Ocultar las calorías y los macros a un cliente.
--
-- A algunas personas (sobre todo con antecedentes de trastornos de la conducta alimentaria, o que se obsesionan con la
-- cifra) les sienta mal ver kcal y macros; el nutricionista sí los necesita para hacer el plan. Con este ajuste por
-- cliente, su app muestra el plan (comidas, alimentos y cantidades) sin ninguna cifra de energía o nutrientes, y esconde
-- lo que solo sirve para contar (escáner de productos, extras, balance del día). El nutricionista lo ve todo igual.
--
-- La columna es de `clientes` (que solo lee y escribe el nutricionista, 0044); el cliente la recibe por
-- get_my_client_profile, que lista sus columnas una a una, así que se añade ahí. Cambiar la forma que devuelve una
-- función obliga a borrarla y crearla de nuevo, con los mismos permisos que tenía (solo usuarios con sesión).
alter table public.clientes add column if not exists hide_numbers boolean not null default false;

drop function if exists public.get_my_client_profile(uuid);

create function public.get_my_client_profile(p_client_id uuid)
returns table (
  id uuid, nutricionista_id uuid, token text, auth_user_id uuid,
  name text, surname text, phone text, email text,
  birth_date date, gender text, height_cm numeric, goal text, allergies text,
  created_at timestamptz, goal_weight_kg numeric,
  consent_accepted_at timestamptz, consent_signed_name text,
  hide_numbers boolean
)
language sql stable security definer set search_path = public as $$
  select c.id, c.nutricionista_id, c.token, c.auth_user_id,
         c.name, c.surname, c.phone, c.email,
         c.birth_date, c.gender, c.height_cm, c.goal, c.allergies,
         c.created_at, c.goal_weight_kg,
         c.consent_accepted_at, c.consent_signed_name,
         c.hide_numbers
  from clientes c
  where c.id = p_client_id and c.auth_user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_client_profile(uuid) from public, anon;
grant execute on function public.get_my_client_profile(uuid) to authenticated;
