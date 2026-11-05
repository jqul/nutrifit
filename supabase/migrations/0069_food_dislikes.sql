-- Lo que a un cliente no le gusta comer («pescado, coliflor, setas»), aparte de sus alergias.
--
-- Lo rellena el nutricionista en la ficha y también puede hacerlo el propio cliente desde su app (la tabla `clientes` solo
-- la escribe el nutricionista, 0044, así que el cliente lo hace con una función que solo toca ESTA columna de SU ficha).
-- «Proponer menú» y las sustituciones se saltan lo que no le gusta; al nutricionista se le avisa en el editor del plan.
alter table public.clientes add column if not exists food_dislikes text not null default '' check (char_length(food_dislikes) <= 500);

-- Mismo conjunto de columnas que 0061 más food_dislikes (cambiar lo que devuelve una función obliga a recrearla).
drop function if exists public.get_my_client_profile(uuid);

create function public.get_my_client_profile(p_client_id uuid)
returns table (
  id uuid, nutricionista_id uuid, token text, auth_user_id uuid,
  name text, surname text, phone text, email text,
  birth_date date, gender text, height_cm numeric, goal text, allergies text,
  created_at timestamptz, goal_weight_kg numeric,
  consent_accepted_at timestamptz, consent_signed_name text,
  hide_numbers boolean, food_dislikes text
)
language sql stable security definer set search_path = public as $$
  select c.id, c.nutricionista_id, c.token, c.auth_user_id,
         c.name, c.surname, c.phone, c.email,
         c.birth_date, c.gender, c.height_cm, c.goal, c.allergies,
         c.created_at, c.goal_weight_kg,
         c.consent_accepted_at, c.consent_signed_name,
         c.hide_numbers, c.food_dislikes
  from clientes c
  where c.id = p_client_id and c.auth_user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_client_profile(uuid) from public, anon;
grant execute on function public.get_my_client_profile(uuid) to authenticated;

-- El cliente cambia lo que no le gusta. Solo la suya y solo esa columna; devuelve el texto guardado.
create or replace function public.set_my_food_dislikes(p_client_id uuid, p_text text)
returns text
language plpgsql security definer set search_path = public as $$
declare v_text text := left(btrim(coalesce(p_text, '')), 500);
begin
  update public.clientes set food_dislikes = v_text where id = p_client_id and auth_user_id = auth.uid();
  if not found then raise exception 'No autorizado'; end if;
  return v_text;
end;
$$;

revoke all on function public.set_my_food_dislikes(uuid, text) from public, anon;
grant execute on function public.set_my_food_dislikes(uuid, text) to authenticated;
