-- Guardado atómico del plan de dieta.
--
-- Hasta ahora la app guardaba un plan con unas 20-60 peticiones sueltas: actualizar los objetivos, borrar TODAS las
-- comidas y suplementos, y volver a crearlos uno a uno (sin mirar los errores). Si algo fallaba o se cortaba la red a
-- mitad, el plan se quedaba sin comidas o a medias, y el cliente lo veía así. Esta función hace todo el guardado en una
-- sola transacción: o queda guardado entero, o no cambia nada.
--
-- p_plan: {
--   kcal_target, protein_g, carbs_g, fat_g, fiber_g, advice, change_reason, note,
--   meals: [{ name, time, kcal_target, day_of_week, option_group, option_label, day_type,
--             items: [{ food_name, quantity, unit, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg,
--                       saturated_fat_g, calcium_mg, iron_mg, zinc_mg, recipe_id }] }],
--   supplements: [{ name, dose, timing, visible_to_client }]
-- }
-- Devuelve el número de la versión creada (NULL si no cambió nada desde la última).
create or replace function public.save_diet_plan(p_plan_id uuid, p_plan jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_client uuid;
  v_meal jsonb;
  v_item jsonb;
  v_sup jsonb;
  v_meal_id uuid;
  v_meals jsonb := coalesce(p_plan->'meals', '[]'::jsonb);
  v_sups jsonb := coalesce(p_plan->'supplements', '[]'::jsonb);
  v_meal_n int;
  v_item_n int;
  v_sup_n int;
begin
  select client_id into v_client from public.diet_plans where id = p_plan_id;
  if v_client is null then raise exception 'Plan no encontrado'; end if;
  if not (private.is_nutricionista_of_client(v_client) or private.is_super_admin()) then
    raise exception 'No autorizado';
  end if;

  -- Tamaños razonables: un plan real tiene decenas de comidas, no miles.
  if jsonb_typeof(v_meals) <> 'array' or jsonb_array_length(v_meals) > 200 then raise exception 'Comidas no válidas'; end if;
  if jsonb_typeof(v_sups) <> 'array' or jsonb_array_length(v_sups) > 100 then raise exception 'Suplementos no válidos'; end if;

  -- Objetivos y consejo. El trigger de diet_plan_changes registra el cambio y consume change_reason.
  update public.diet_plans set
    kcal_target = coalesce((p_plan->>'kcal_target')::numeric, 0),
    protein_g = coalesce((p_plan->>'protein_g')::numeric, 0),
    carbs_g = coalesce((p_plan->>'carbs_g')::numeric, 0),
    fat_g = coalesce((p_plan->>'fat_g')::numeric, 0),
    fiber_g = coalesce((p_plan->>'fiber_g')::numeric, 0),
    advice = coalesce(p_plan->>'advice', ''),
    updated_at = now(),
    change_reason = nullif(btrim(coalesce(p_plan->>'change_reason', '')), '')
  where id = p_plan_id;

  -- Comidas, alimentos (en cascada) y suplementos: fuera los actuales, dentro los nuevos.
  delete from public.diet_meals where plan_id = p_plan_id;
  delete from public.diet_supplements where plan_id = p_plan_id;

  v_meal_n := 0;
  for v_meal in select * from jsonb_array_elements(v_meals) loop
    if jsonb_typeof(coalesce(v_meal->'items', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(v_meal->'items', '[]'::jsonb)) > 200 then
      raise exception 'Alimentos no válidos';
    end if;
    insert into public.diet_meals (plan_id, name, time, kcal_target, day_of_week, option_group, option_label, day_type, sort_order)
    values (
      p_plan_id, coalesce(v_meal->>'name', ''), coalesce(v_meal->>'time', ''),
      (v_meal->>'kcal_target')::numeric, (v_meal->>'day_of_week')::smallint,
      (v_meal->>'option_group')::uuid, v_meal->>'option_label', v_meal->>'day_type', v_meal_n
    ) returning id into v_meal_id;
    v_meal_n := v_meal_n + 1;

    v_item_n := 0;
    for v_item in select * from jsonb_array_elements(coalesce(v_meal->'items', '[]'::jsonb)) loop
      insert into public.diet_meal_items (
        meal_id, food_name, quantity, unit, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg,
        saturated_fat_g, calcium_mg, iron_mg, zinc_mg, recipe_id, sort_order
      ) values (
        v_meal_id, coalesce(v_item->>'food_name', ''), coalesce(v_item->>'quantity', ''), coalesce(v_item->>'unit', ''),
        (v_item->>'kcal')::numeric, (v_item->>'protein_g')::numeric, (v_item->>'carbs_g')::numeric, (v_item->>'fat_g')::numeric,
        (v_item->>'fiber_g')::numeric, (v_item->>'sugar_g')::numeric, (v_item->>'sodium_mg')::numeric,
        (v_item->>'saturated_fat_g')::numeric, (v_item->>'calcium_mg')::numeric, (v_item->>'iron_mg')::numeric,
        (v_item->>'zinc_mg')::numeric,
        -- Si la receta enlazada ya no existe, el alimento se guarda sin enlace en vez de fallar todo el guardado.
        (select r.id from public.recipes r where r.id = nullif(v_item->>'recipe_id', '')::uuid),
        v_item_n
      );
      v_item_n := v_item_n + 1;
    end loop;
  end loop;

  v_sup_n := 0;
  for v_sup in select * from jsonb_array_elements(v_sups) loop
    insert into public.diet_supplements (plan_id, name, dose, timing, visible_to_client)
    values (
      p_plan_id, coalesce(v_sup->>'name', ''), coalesce(v_sup->>'dose', ''), coalesce(v_sup->>'timing', ''),
      coalesce((v_sup->>'visible_to_client')::boolean, true)
    );
    v_sup_n := v_sup_n + 1;
  end loop;

  -- Instantánea de lo que acaba de quedar guardado, en la misma transacción.
  return public.create_plan_version(p_plan_id, nullif(btrim(coalesce(p_plan->>'note', '')), ''));
end;
$$;

revoke all on function public.save_diet_plan(uuid, jsonb) from public, anon;
grant execute on function public.save_diet_plan(uuid, jsonb) to authenticated;
