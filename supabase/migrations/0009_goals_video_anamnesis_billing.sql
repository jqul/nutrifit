-- Peso objetivo, enlace de videollamada en citas, cuestionario de anamnesis
-- inicial y facturación simple.

alter table clientes add column goal_weight_kg numeric;
alter table appointments add column video_link text;

create table anamnesis (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clientes(id) on delete cascade unique,
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  nutricionista_id uuid not null references nutricionistas(uid) on delete cascade,
  client_id uuid not null references clientes(id) on delete cascade,
  period text not null,
  amount numeric not null,
  status text not null default 'pendiente' check (status in ('pendiente', 'pagado')),
  created_at timestamptz not null default now(),
  unique (client_id, period)
);

create index idx_anamnesis_client_id on anamnesis(client_id);
create index idx_invoices_nutricionista_id on invoices(nutricionista_id);
create index idx_invoices_client_id on invoices(client_id);

alter table anamnesis enable row level security;
alter table invoices enable row level security;

create policy nutricionista_reads_anamnesis on anamnesis for select
  using (private.is_nutricionista_of_client(client_id) or private.is_super_admin());
create policy client_manages_own_anamnesis on anamnesis for all
  using (private.is_owner_client(client_id))
  with check (private.is_owner_client(client_id));

create policy nutricionista_manages_invoices on invoices for all
  using (nutricionista_id = (select auth.uid()) or private.is_super_admin())
  with check (nutricionista_id = (select auth.uid()) or private.is_super_admin());
create policy client_reads_own_invoices on invoices for select
  using (private.is_owner_client(client_id));
