-- Versiones del plan: cada vez que se guarda un plan queda una instantánea
-- COMPLETA (objetivos, consejo, comidas con sus alimentos y suplementos) con
-- número de versión, y el nutricionista puede restaurar una anterior. Complementa
-- diet_plan_changes (0046), que solo registra los cambios de objetivos.
--
-- Todo se hace en la base de datos, no en la pantalla: la instantánea sale de lo
-- que de verdad está guardado y restaurar es UNA operación atómica (o se restaura
-- todo o nada) — a diferencia del guardado normal, que reescribe comidas con
-- varias llamadas. Restaurar NUNCA borra nada del historial: guarda antes el plan
-- actual como versión y deja la restauración como una versión nueva.
--
-- Son datos internos del nutricionista: sin política de lectura para clientes y
-- sin políticas de escritura (solo se escribe a través de las dos funciones).

create table public.diet_plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.diet_plans(id) on delete cascade,
  client_id uuid not null references public.clientes(id) on delete cascade,
  version_number int not null,
  -- { name, kcal_target, protein_g, carbs_g, fat_g, fiber_g, advice,
  --   meals: [{ ...columnas de diet_meals sin id/plan_id, items: [{ ...diet_meal_items sin id/meal_id }] }],
  --   supplements: [{ ...diet_supplements sin id/plan_id }] }
  snapshot jsonb not null,
  note text,
  -- Si esta versión nació de restaurar otra, el número de la restaurada.
  restored_from int,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (plan_id, version_number)
);

create index idx_diet_plan_versions_client on public.diet_plan_versions(client_id, created_at desc);

alter table public.diet_plan_versions enable row level security;

create policy nutricionista_reads_diet_plan_versions on public.diet_plan_versions
  for select using (private.is_nutricionista_of_client(client_id) or private.is_super_admin());

-- Instantánea determinista del plan tal y como está guardado ahora.
create or replace function private.plan_snapshot(p_plan_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', p.name,
    'kcal_target', p.kcal_target, 'protein_g', p.protein_g, 'carbs_g', p.carbs_g, 'fat_g', p.fat_g, 'fiber_g', p.fiber_g,
    'advice', p.advice,
    'meals', coalesce((
      select jsonb_agg(
        (to_jsonb(m) - 'id' - 'plan_id') || jsonb_build_object('items', coalesce((
          select jsonb_agg(to_jsonb(i) - 'id' - 'meal_id' order by i.sort_order, i.food_name, i.quantity)
          from public.diet_meal_items i where i.meal_id = m.id
        ), '[]'::jsonb))
        order by m.sort_order, m.name, m."time")
      from public.diet_meals m where m.plan_id = p.id
    ), '[]'::jsonb),
    'supplements', coalesce((
      select jsonb_agg(to_jsonb(s) - 'id' - 'plan_id' order by s.name, s.dose, s.timing)
      from public.diet_supplements s where s.plan_id = p.id
    ), '[]'::jsonb)
  )
  from public.diet_plans p where p.id = p_plan_id;
$$;

-- Guarda una versión con el estado actual del plan. Devuelve el número de la
-- versión creada, o NULL si no ha cambiado nada desde la última (guardar sin
-- tocar nada no genera versiones repetidas).
create or replace function public.create_plan_version(p_plan_id uuid, p_note text default null, p_restored_from int default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_client uuid;
  v_snapshot jsonb;
  v_last jsonb;
  v_last_n int;
begin
  select client_id into v_client from public.diet_plans where id = p_plan_id;
  if v_client is null then raise exception 'Plan no encontrado'; end if;
  if not (private.is_nutricionista_of_client(v_client) or private.is_super_admin()) then
    raise exception 'No autorizado';
  end if;

  v_snapshot := private.plan_snapshot(p_plan_id);
  select snapshot, version_number into v_last, v_last_n
    from public.diet_plan_versions where plan_id = p_plan_id order by version_number desc limit 1;
  if v_last is not null and v_last = v_snapshot then return null; end if;

  insert into public.diet_plan_versions (plan_id, client_id, version_number, snapshot, note, restored_from)
  values (p_plan_id, v_client, coalesce(v_last_n, 0) + 1, v_snapshot, nullif(btrim(coalesce(p_note, '')), ''), p_restored_from);
  return coalesce(v_last_n, 0) + 1;
end;
$$;

-- Restaura una versión: guarda antes el plan actual (si difiere de la última
-- versión), sustituye objetivos, consejo, comidas, alimentos y suplementos por los
-- de la versión elegida y deja la restauración como versión nueva. Todo en una
-- sola transacción. Devuelve el número de la versión nueva (NULL si el plan ya era
-- idéntico a esa versión).
create or replace function public.restore_plan_version(p_version_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v public.diet_plan_versions;
  v_meal jsonb;
  v_item jsonb;
  v_sup jsonb;
  v_meal_id uuid;
begin
  select * into v from public.diet_plan_versions where id = p_version_id;
  if not found then raise exception 'Versión no encontrada'; end if;
  if not (private.is_nutricionista_of_client(v.client_id) or private.is_super_admin()) then
    raise exception 'No autorizado';
  end if;

  -- 1) Que no se pierda lo que hay ahora.
  perform public.create_plan_version(v.plan_id, 'Estado antes de restaurar la versión ' || v.version_number);

  -- 2) Objetivos y consejo. El trigger de diet_plan_changes registra el cambio con este motivo.
  update public.diet_plans set
    kcal_target = (v.snapshot->>'kcal_target')::numeric,
    protein_g = (v.snapshot->>'protein_g')::numeric,
    carbs_g = (v.snapshot->>'carbs_g')::numeric,
    fat_g = (v.snapshot->>'fat_g')::numeric,
    fiber_g = (v.snapshot->>'fiber_g')::numeric,
    advice = coalesce(v.snapshot->>'advice', ''),
    updated_at = now(),
    change_reason = 'Restaurado a la versión ' || v.version_number
  where id = v.plan_id;

  -- 3) Comidas, alimentos y suplementos: fuera los actuales, dentro los de la versión.
  delete from public.diet_meals where plan_id = v.plan_id;        -- los alimentos caen en cascada
  delete from public.diet_supplements where plan_id = v.plan_id;

  for v_meal in select * from jsonb_array_elements(coalesce(v.snapshot->'meals', '[]'::jsonb)) loop
    v_meal_id := gen_random_uuid();
    insert into public.diet_meals
      select * from jsonb_populate_record(null::public.diet_meals, (v_meal - 'items') || jsonb_build_object('id', v_meal_id, 'plan_id', v.plan_id));

    for v_item in select * from jsonb_array_elements(coalesce(v_meal->'items', '[]'::jsonb)) loop
      v_item := v_item || jsonb_build_object('id', gen_random_uuid(), 'meal_id', v_meal_id);
      -- Si la receta enlazada se borró desde entonces, el alimento se conserva sin enlace.
      if v_item->>'recipe_id' is not null and not exists (select 1 from public.recipes r where r.id = (v_item->>'recipe_id')::uuid) then
        v_item := v_item || jsonb_build_object('recipe_id', null);
      end if;
      insert into public.diet_meal_items select * from jsonb_populate_record(null::public.diet_meal_items, v_item);
    end loop;
  end loop;

  for v_sup in select * from jsonb_array_elements(coalesce(v.snapshot->'supplements', '[]'::jsonb)) loop
    insert into public.diet_supplements
      select * from jsonb_populate_record(null::public.diet_supplements, v_sup || jsonb_build_object('id', gen_random_uuid(), 'plan_id', v.plan_id));
  end loop;

  -- 4) La restauración queda como versión nueva.
  return public.create_plan_version(v.plan_id, 'Restaurada desde la versión ' || v.version_number, v.version_number);
end;
$$;

revoke all on function public.create_plan_version(uuid, text, int) from public, anon;
revoke all on function public.restore_plan_version(uuid) from public, anon;
grant execute on function public.create_plan_version(uuid, text, int) to authenticated;
grant execute on function public.restore_plan_version(uuid) to authenticated;

-- Versión 1 de los planes que ya existen: su estado actual, para que haya algo
-- a lo que volver desde el primer cambio.
insert into public.diet_plan_versions (plan_id, client_id, version_number, snapshot, note, created_by)
select p.id, p.client_id, 1, private.plan_snapshot(p.id), 'Versión inicial (estado al activar las versiones)', null
from public.diet_plans p
where p.kcal_target > 0 or exists (select 1 from public.diet_meals m where m.plan_id = p.id);
