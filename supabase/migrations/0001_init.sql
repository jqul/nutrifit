-- NutriFit — esquema inicial: nutricionistas, clientes, plan de dieta, seguimiento.

-- ── Tablas ──────────────────────────────────────────────────

create table nutricionistas (
  uid uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  approved boolean not null default false,
  role text not null default 'trainer' check (role in ('trainer', 'super_admin')),
  created_at timestamptz not null default now()
);

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nutricionista_id uuid not null references nutricionistas(uid) on delete cascade,
  token text not null unique,
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  surname text not null default '',
  phone text not null default '',
  email text,
  birth_date date,
  gender text,
  height_cm numeric,
  goal text check (goal in ('perder_peso', 'ganar_masa', 'mantenimiento', 'rendimiento', 'salud')),
  allergies text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table diet_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clientes(id) on delete cascade,
  nutricionista_id uuid not null references nutricionistas(uid) on delete cascade,
  name text not null default 'Plan de dieta',
  kcal_target numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  advice text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table diet_meals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references diet_plans(id) on delete cascade,
  name text not null default '',
  time text not null default '',
  kcal_target numeric,
  sort_order integer not null default 0
);

create table diet_meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references diet_meals(id) on delete cascade,
  food_name text not null default '',
  quantity text not null default '',
  unit text not null default '',
  kcal numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  sort_order integer not null default 0
);

create table diet_supplements (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references diet_plans(id) on delete cascade,
  name text not null default '',
  dose text not null default '',
  timing text not null default '',
  visible_to_client boolean not null default true
);

create table diet_templates (
  id uuid primary key default gen_random_uuid(),
  nutricionista_id uuid not null references nutricionistas(uid) on delete cascade,
  name text not null,
  plan jsonb not null default '{}'::jsonb
);

create table weight_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clientes(id) on delete cascade,
  date date not null,
  weight_kg numeric not null,
  note text not null default '',
  unique (client_id, date)
);

create table progress_photos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clientes(id) on delete cascade,
  date date not null default current_date,
  front_url text,
  side_url text,
  back_url text,
  note text not null default ''
);

create table daily_checkins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clientes(id) on delete cascade,
  date date not null,
  followed_plan text not null default 'si' check (followed_plan in ('si', 'parcial', 'no')),
  hunger smallint not null default 3 check (hunger between 1 and 5),
  energy smallint not null default 3 check (energy between 1 and 5),
  mood smallint not null default 3 check (mood between 1 and 5),
  water_l numeric,
  notes text not null default '',
  unique (client_id, date)
);

-- ── Índices en claves foráneas usadas en filtros ───────────

create index idx_clientes_nutricionista_id on clientes(nutricionista_id);
create index idx_clientes_auth_user_id on clientes(auth_user_id);
create index idx_diet_plans_client_id on diet_plans(client_id);
create index idx_diet_plans_nutricionista_id on diet_plans(nutricionista_id);
create index idx_diet_meals_plan_id on diet_meals(plan_id);
create index idx_diet_meal_items_meal_id on diet_meal_items(meal_id);
create index idx_diet_supplements_plan_id on diet_supplements(plan_id);
create index idx_diet_templates_nutricionista_id on diet_templates(nutricionista_id);
create index idx_weight_logs_client_id on weight_logs(client_id);
create index idx_progress_photos_client_id on progress_photos(client_id);
create index idx_daily_checkins_client_id on daily_checkins(client_id);

-- ── Funciones auxiliares para RLS (SECURITY DEFINER para poder
--    consultar tablas ajenas a la fila evaluada sin recursión) ──

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from nutricionistas where uid = auth.uid() and role = 'super_admin');
$$;

create or replace function public.is_nutricionista_of_client(p_client_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from clientes where id = p_client_id and nutricionista_id = auth.uid());
$$;

create or replace function public.is_owner_client(p_client_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from clientes where id = p_client_id and auth_user_id = auth.uid());
$$;

create or replace function public.is_client_of_nutricionista(p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from clientes where nutricionista_id = p_uid and auth_user_id = auth.uid());
$$;

create or replace function public.is_nutricionista_of_plan(p_plan_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from diet_plans dp join clientes c on c.id = dp.client_id
    where dp.id = p_plan_id and c.nutricionista_id = auth.uid()
  );
$$;

create or replace function public.is_owner_of_plan(p_plan_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from diet_plans dp join clientes c on c.id = dp.client_id
    where dp.id = p_plan_id and c.auth_user_id = auth.uid()
  );
$$;

create or replace function public.is_nutricionista_of_meal(p_meal_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from diet_meals dm
    join diet_plans dp on dp.id = dm.plan_id
    join clientes c on c.id = dp.client_id
    where dm.id = p_meal_id and c.nutricionista_id = auth.uid()
  );
$$;

create or replace function public.is_owner_of_meal(p_meal_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from diet_meals dm
    join diet_plans dp on dp.id = dm.plan_id
    join clientes c on c.id = dp.client_id
    where dm.id = p_meal_id and c.auth_user_id = auth.uid()
  );
$$;

-- ── Acceso del cliente por token (sin login) ───────────────

create or replace function public.get_client_by_token(p_token text) returns setof clientes
language sql stable security definer set search_path = public as $$
  select * from clientes where token = p_token limit 1;
$$;

create or replace function public.claim_client_by_token(p_token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update clientes set auth_user_id = auth.uid() where token = p_token and auth_user_id is null;
end;
$$;

-- ── RLS ─────────────────────────────────────────────────────

alter table nutricionistas enable row level security;
alter table clientes enable row level security;
alter table diet_plans enable row level security;
alter table diet_meals enable row level security;
alter table diet_meal_items enable row level security;
alter table diet_supplements enable row level security;
alter table diet_templates enable row level security;
alter table weight_logs enable row level security;
alter table progress_photos enable row level security;
alter table daily_checkins enable row level security;

create policy nutricionista_owns_self on nutricionistas for all
  using (uid = (select auth.uid()) or is_client_of_nutricionista(uid) or is_super_admin())
  with check (uid = (select auth.uid()) or is_super_admin());

create policy nutricionista_or_client_owns_clientes on clientes for all
  using (nutricionista_id = (select auth.uid()) or auth_user_id = (select auth.uid()) or is_super_admin())
  with check (nutricionista_id = (select auth.uid()) or is_super_admin());

create policy nutricionista_manages_diet_plans on diet_plans for all
  using (is_nutricionista_of_client(client_id) or is_super_admin())
  with check (is_nutricionista_of_client(client_id) or is_super_admin());
create policy client_reads_diet_plans on diet_plans for select
  using (is_owner_client(client_id));

create policy nutricionista_manages_diet_meals on diet_meals for all
  using (is_nutricionista_of_plan(plan_id) or is_super_admin())
  with check (is_nutricionista_of_plan(plan_id) or is_super_admin());
create policy client_reads_diet_meals on diet_meals for select
  using (is_owner_of_plan(plan_id));

create policy nutricionista_manages_diet_meal_items on diet_meal_items for all
  using (is_nutricionista_of_meal(meal_id) or is_super_admin())
  with check (is_nutricionista_of_meal(meal_id) or is_super_admin());
create policy client_reads_diet_meal_items on diet_meal_items for select
  using (is_owner_of_meal(meal_id));

create policy nutricionista_manages_diet_supplements on diet_supplements for all
  using (is_nutricionista_of_plan(plan_id) or is_super_admin())
  with check (is_nutricionista_of_plan(plan_id) or is_super_admin());
create policy client_reads_visible_supplements on diet_supplements for select
  using (is_owner_of_plan(plan_id) and visible_to_client = true);

create policy nutricionista_owns_diet_templates on diet_templates for all
  using (nutricionista_id = (select auth.uid()) or is_super_admin())
  with check (nutricionista_id = (select auth.uid()) or is_super_admin());

create policy nutricionista_reads_weight_logs on weight_logs for select
  using (is_nutricionista_of_client(client_id) or is_super_admin());
create policy client_manages_weight_logs on weight_logs for all
  using (is_owner_client(client_id))
  with check (is_owner_client(client_id));

create policy nutricionista_reads_progress_photos on progress_photos for select
  using (is_nutricionista_of_client(client_id) or is_super_admin());
create policy client_manages_progress_photos on progress_photos for all
  using (is_owner_client(client_id))
  with check (is_owner_client(client_id));

create policy nutricionista_reads_daily_checkins on daily_checkins for select
  using (is_nutricionista_of_client(client_id) or is_super_admin());
create policy client_manages_daily_checkins on daily_checkins for all
  using (is_owner_client(client_id))
  with check (is_owner_client(client_id));

-- ── Storage: fotos de progreso ──────────────────────────────

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy photos_client_write on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and is_owner_client((storage.foldername(name))[1]::uuid));

create policy photos_client_update on storage.objects for update to authenticated
  using (bucket_id = 'photos' and is_owner_client((storage.foldername(name))[1]::uuid));

create policy photos_read on storage.objects for select
  using (
    bucket_id = 'photos' and (
      is_owner_client((storage.foldername(name))[1]::uuid)
      or is_nutricionista_of_client((storage.foldername(name))[1]::uuid)
      or is_super_admin()
    )
  );
