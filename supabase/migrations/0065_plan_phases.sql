-- Fases del plan (idea de los «Programas» de Harbiz, ver replica/recon-harbiz.md): la línea de tiempo de un cliente,
-- por ejemplo «Definición · 4 semanas», «Mantenimiento · 2 semanas». Cada fase tiene nombre, fechas, un texto para el
-- cliente («en esta fase…») y, opcionalmente, la plantilla de plan que le corresponde.
--
-- Esta primera versión es una línea de tiempo con aviso: no cambia el plan por sí sola. El nutricionista la edita en el
-- Plan de dieta del cliente, ve en el Centro de control qué fases terminan y el cliente ve en qué fase está.
create table public.plan_phases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clientes(id) on delete cascade,
  nutricionista_id uuid not null references public.nutricionistas(uid) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  -- Lo ve el cliente: no es para notas internas.
  description text not null default '' check (char_length(description) <= 500),
  start_date date not null,
  end_date date not null,
  template_id uuid references public.diet_templates(id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index idx_plan_phases_client on public.plan_phases (client_id, start_date);
create index idx_plan_phases_nutricionista on public.plan_phases (nutricionista_id, end_date);

alter table public.plan_phases enable row level security;

-- El nutricionista gestiona las de sus clientes (y no puede colgar una fase de un cliente que no es suyo).
create policy nutricionista_owns_plan_phases on public.plan_phases for all
  using (nutricionista_id = (select auth.uid()) or private.is_super_admin())
  with check ((nutricionista_id = (select auth.uid()) and private.is_nutricionista_of_client(client_id)) or private.is_super_admin());

-- El cliente solo lee las suyas.
create policy client_reads_own_plan_phases on public.plan_phases for select
  using (private.is_owner_client(client_id));
