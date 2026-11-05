-- Cambio de plan automático al empezar una fase (0065 solo era una línea de tiempo con aviso).
--
-- El nutricionista elige, fase a fase, si su plantilla se aplica sola el día que empieza (auto_apply). Cada mañana, un cron
-- aplica las fases que ya han empezado, siguen en curso y no se habían aplicado todavía. Aplicar una plantilla ES guardar el
-- plan del cliente con el contenido de la plantilla, así que se hace con save_diet_plan (una sola transacción, con su
-- versión del plan y su registro en el historial de cambios, con el motivo «Cambio de fase»): el plan anterior se puede
-- restaurar desde «Versiones del plan». Si algo falla (plantilla borrada, números mal escritos…) no se toca el plan y el
-- motivo queda en apply_error para que el nutricionista lo vea en la tarjeta de fases.
alter table public.plan_phases
  add column if not exists auto_apply boolean not null default false,
  add column if not exists applied_at timestamptz,
  add column if not exists apply_error text;

-- Convierte una plantilla (camelCase, tal como la guarda la app) al formato de save_diet_plan.
create or replace function private.template_to_save_payload(p_tpl jsonb, p_reason text)
returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'kcal_target', coalesce(nullif(p_tpl->>'kcalTarget', '')::numeric, 0),
    'protein_g', coalesce(nullif(p_tpl->>'proteinG', '')::numeric, 0),
    'carbs_g', coalesce(nullif(p_tpl->>'carbsG', '')::numeric, 0),
    'fat_g', coalesce(nullif(p_tpl->>'fatG', '')::numeric, 0),
    'fiber_g', coalesce(nullif(p_tpl->>'fiberG', '')::numeric, 0),
    'advice', coalesce(p_tpl->>'advice', ''),
    'change_reason', p_reason, 'note', p_reason,
    'meals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', coalesce(m->>'name', ''), 'time', coalesce(m->>'time', ''),
        'kcal_target', nullif(m->>'kcalTarget', '')::numeric,
        'day_of_week', nullif(m->>'dayOfWeek', '')::smallint,
        'option_group', nullif(m->>'optionGroup', ''), 'option_label', nullif(m->>'optionLabel', ''), 'day_type', nullif(m->>'dayType', ''),
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'food_name', coalesce(i->>'foodName', ''), 'quantity', coalesce(i->>'quantity', ''), 'unit', coalesce(i->>'unit', ''),
            'kcal', nullif(i->>'kcal', '')::numeric, 'protein_g', nullif(i->>'proteinG', '')::numeric,
            'carbs_g', nullif(i->>'carbsG', '')::numeric, 'fat_g', nullif(i->>'fatG', '')::numeric,
            'fiber_g', nullif(i->>'fiberG', '')::numeric, 'sugar_g', nullif(i->>'sugarG', '')::numeric,
            'sodium_mg', nullif(i->>'sodiumMg', '')::numeric, 'saturated_fat_g', nullif(i->>'saturatedFatG', '')::numeric,
            'calcium_mg', nullif(i->>'calciumMg', '')::numeric, 'iron_mg', nullif(i->>'ironMg', '')::numeric,
            'zinc_mg', nullif(i->>'zincMg', '')::numeric, 'recipe_id', nullif(i->>'recipeId', '')
          )) from jsonb_array_elements(coalesce(m->'items', '[]'::jsonb)) i
        ), '[]'::jsonb)
      )) from jsonb_array_elements(coalesce(p_tpl->'meals', '[]'::jsonb)) m
    ), '[]'::jsonb),
    'supplements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', coalesce(s->>'name', ''), 'dose', coalesce(s->>'dose', ''), 'timing', coalesce(s->>'timing', ''),
        'visible_to_client', coalesce((s->>'visibleToClient')::boolean, true)
      )) from jsonb_array_elements(coalesce(p_tpl->'supplements', '[]'::jsonb)) s
    ), '[]'::jsonb)
  );
$$;

-- Aplica la plantilla de UNA fase al plan activo de su cliente. Devuelve 'aplicada', 'omitida: …' o 'error: …'; nunca lanza.
create or replace function private.apply_phase_template(p_phase_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_phase public.plan_phases%rowtype;
  v_tpl jsonb;
  v_plan_id uuid;
  v_name text;
begin
  select * into v_phase from public.plan_phases where id = p_phase_id for update;
  if not found or not v_phase.auto_apply or v_phase.template_id is null or v_phase.applied_at is not null then
    return 'omitida: nada que aplicar';
  end if;

  begin
    select plan into v_tpl from public.diet_templates where id = v_phase.template_id and nutricionista_id = v_phase.nutricionista_id;
    if v_tpl is null then raise exception 'La plantilla de la fase ya no existe'; end if;
    select id into v_plan_id from public.diet_plans where client_id = v_phase.client_id and is_active order by created_at desc limit 1;
    if v_plan_id is null then raise exception 'El cliente todavía no tiene un plan: créalo y aplica la plantilla a mano'; end if;

    -- save_diet_plan comprueba que quien guarda es el nutricionista del cliente: se actúa como él dentro de esta transacción.
    perform set_config('request.jwt.claims', json_build_object('sub', v_phase.nutricionista_id, 'role', 'authenticated')::text, true);
    v_name := v_phase.name;
    perform public.save_diet_plan(v_plan_id, private.template_to_save_payload(v_tpl, 'Cambio de fase: «' || v_name || '» (automático)'));
    perform set_config('request.jwt.claims', '', true);

    update public.plan_phases set applied_at = now(), apply_error = null where id = p_phase_id;
    return 'aplicada';
  exception when others then
    perform set_config('request.jwt.claims', '', true);
    update public.plan_phases set apply_error = left(sqlerrm, 300) where id = p_phase_id;
    return 'error: ' || left(sqlerrm, 300);
  end;
end;
$$;

-- Las fases que ya han empezado (hoy en Madrid), siguen en curso y piden aplicarse solas. Devuelve cuántas se aplicaron.
create or replace function public.apply_due_phase_templates()
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_phase uuid;
  v_applied int := 0;
begin
  for v_phase in
    select id from public.plan_phases
    where auto_apply and template_id is not null and applied_at is null
      and start_date <= v_today and end_date >= v_today
    order by start_date, created_at
  loop
    if private.apply_phase_template(v_phase) = 'aplicada' then v_applied := v_applied + 1; end if;
  end loop;
  return v_applied;
end;
$$;

revoke all on function public.apply_due_phase_templates() from public, anon, authenticated;
revoke all on function private.apply_phase_template(uuid) from public, anon, authenticated;
grant execute on function public.apply_due_phase_templates() to service_role;

-- Cada mañana, antes del resumen de avisos (07:30 UTC). cron.schedule con el mismo nombre actualiza, no duplica.
select cron.schedule('nutrifit-apply-phase-templates', '0 5 * * *', 'select public.apply_due_phase_templates();');
