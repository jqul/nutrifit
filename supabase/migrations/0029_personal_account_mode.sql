-- Modo personal: alguien que quiere llevar su propia dieta, sin ser
-- profesional ni tener clientes. En vez de crear un tipo de cuenta nuevo
-- desde cero, se modela como un nutricionista con un único cliente: él
-- mismo (misma fila en `clientes`, con nutricionista_id y auth_user_id
-- apuntando ambos a su propio uid) — así se reutilizan tal cual tanto el
-- editor de plan (PlanDietaTab) como el seguimiento diario (HoyTab,
-- DietaClienteTab, ProgresoClienteTab), sin duplicar nada.
alter table nutricionistas add column account_mode text not null default 'professional' check (account_mode in ('professional', 'personal'));

create or replace function public.handle_new_nutricionista() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_mode text;
  v_name text;
begin
  if new.raw_user_meta_data->>'signup_type' = 'nutricionista' then
    v_mode := coalesce(new.raw_user_meta_data->>'account_mode', 'professional');
    v_name := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1));

    -- Modo personal se aprueba solo (approved = true de entrada) — no hay
    -- nada clínico que vetar, a diferencia del modo profesional.
    insert into public.nutricionistas (uid, email, display_name, approved, role, account_mode, created_at)
    values (new.id, new.email, v_name, v_mode = 'personal', 'trainer', v_mode, now())
    on conflict (uid) do nothing;

    if v_mode = 'personal' then
      insert into public.clientes (nutricionista_id, token, auth_user_id, name, email)
      values (new.id, replace(gen_random_uuid()::text, '-', ''), new.id, v_name, new.email);
    end if;
  end if;
  return new;
end;
$$;
