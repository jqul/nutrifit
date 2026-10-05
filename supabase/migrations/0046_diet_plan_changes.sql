-- Historial de cambios del plan (UX/roadmap): cada vez que el nutricionista
-- cambia los OBJETIVOS de un plan (kcal, macros, fibra) o su consejo, queda
-- registrado qué cambió (antes → después), cuándo, quién y, si lo indicó, por
-- qué. Sirve para ver qué ha pasado con un cliente y qué ajustes funcionan.
--
-- Lo escribe un trigger, no el frontend: así es fiable (diff real contra la fila
-- anterior) y no depende de que una pantalla se acuerde de registrarlo. El
-- historial es inmutable (no hay políticas de insert/update/delete) y es
-- INTERNO: solo lo lee el nutricionista del cliente o un super-admin.
--
-- Las comidas y alimentos se reescriben enteros en cada guardado, así que no se
-- versionan aquí: el historial cubre las decisiones de estrategia (objetivos).

-- Columna transitoria: el frontend escribe aquí el motivo en la misma
-- actualización y el trigger lo consume y lo deja en NULL. En reposo siempre es NULL.
alter table public.diet_plans add column if not exists change_reason text;

create table public.diet_plan_changes (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.diet_plans(id) on delete cascade,
  client_id uuid not null references public.clientes(id) on delete cascade,
  changed_at timestamptz not null default now(),
  changed_by uuid default auth.uid(),
  -- [{ "field": "kcal_target", "from": 2100, "to": 1950 }, ...]
  changes jsonb not null,
  reason text
);

create index idx_diet_plan_changes_client on public.diet_plan_changes(client_id, changed_at desc);

alter table public.diet_plan_changes enable row level security;

create policy nutricionista_reads_diet_plan_changes on public.diet_plan_changes
  for select using (private.is_nutricionista_of_client(client_id) or private.is_super_admin());

create or replace function private.log_diet_plan_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  changes jsonb := '[]'::jsonb;
begin
  -- Un plan recién creado (todo a 0) todavía no tiene objetivos: la primera
  -- definición no es un "cambio".
  if coalesce(old.kcal_target, 0) = 0 and coalesce(old.protein_g, 0) = 0 and coalesce(old.carbs_g, 0) = 0
     and coalesce(old.fat_g, 0) = 0 and coalesce(old.fiber_g, 0) = 0 then
    new.change_reason := null;
    return new;
  end if;

  if new.kcal_target is distinct from old.kcal_target then
    changes := changes || jsonb_build_object('field', 'kcal_target', 'from', old.kcal_target, 'to', new.kcal_target);
  end if;
  if new.protein_g is distinct from old.protein_g then
    changes := changes || jsonb_build_object('field', 'protein_g', 'from', old.protein_g, 'to', new.protein_g);
  end if;
  if new.carbs_g is distinct from old.carbs_g then
    changes := changes || jsonb_build_object('field', 'carbs_g', 'from', old.carbs_g, 'to', new.carbs_g);
  end if;
  if new.fat_g is distinct from old.fat_g then
    changes := changes || jsonb_build_object('field', 'fat_g', 'from', old.fat_g, 'to', new.fat_g);
  end if;
  if new.fiber_g is distinct from old.fiber_g then
    changes := changes || jsonb_build_object('field', 'fiber_g', 'from', old.fiber_g, 'to', new.fiber_g);
  end if;
  if new.advice is distinct from old.advice then
    changes := changes || jsonb_build_object('field', 'advice', 'from', old.advice, 'to', new.advice);
  end if;

  if jsonb_array_length(changes) > 0 then
    insert into public.diet_plan_changes (plan_id, client_id, changed_by, changes, reason)
    values (new.id, new.client_id, auth.uid(), changes, nullif(btrim(coalesce(new.change_reason, '')), ''));
  end if;

  new.change_reason := null;
  return new;
end;
$$;

drop trigger if exists diet_plans_log_changes on public.diet_plans;
create trigger diet_plans_log_changes
  before update on public.diet_plans
  for each row execute function private.log_diet_plan_changes();
