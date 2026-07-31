-- Mensajería WhatsApp, notificaciones push, calendario de citas, panel de
-- negocio y diario de comidas.

alter table clientes add column monthly_price numeric;
alter table clientes add column custom_messages jsonb not null default '{}'::jsonb;

create table message_templates (
  id uuid primary key default gen_random_uuid(),
  nutricionista_id uuid not null references nutricionistas(uid) on delete cascade,
  tipo text not null default 'custom' check (tipo in ('nuevo_plan','racha','checkin_recordatorio','custom')),
  nombre text not null,
  texto text not null,
  created_at timestamptz not null default now()
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  nutricionista_id uuid references nutricionistas(uid) on delete cascade,
  client_id uuid references clientes(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  nutricionista_id uuid not null references nutricionistas(uid) on delete cascade,
  client_id uuid references clientes(id) on delete cascade,
  title text not null default '',
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'confirmada' check (status in ('pendiente','confirmada','cancelada','completada')),
  notes text not null default '',
  recurring text check (recurring in ('weekly')),
  google_event_id text
);

create table meal_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clientes(id) on delete cascade,
  date date not null,
  meal_name text not null default '',
  photo_url text,
  note text not null default '',
  created_at timestamptz not null default now()
);

-- ── Índices ─────────────────────────────────────────────────

create index idx_message_templates_nutricionista_id on message_templates(nutricionista_id);
create index idx_push_subscriptions_nutricionista_id on push_subscriptions(nutricionista_id);
create index idx_push_subscriptions_client_id on push_subscriptions(client_id);
create index idx_appointments_nutricionista_id on appointments(nutricionista_id);
create index idx_appointments_client_id on appointments(client_id);
create index idx_meal_logs_client_id on meal_logs(client_id);

-- ── RLS ─────────────────────────────────────────────────────

alter table message_templates enable row level security;
alter table push_subscriptions enable row level security;
alter table appointments enable row level security;
alter table meal_logs enable row level security;

create policy nutricionista_owns_message_templates on message_templates for all
  using (nutricionista_id = (select auth.uid()) or private.is_super_admin())
  with check (nutricionista_id = (select auth.uid()) or private.is_super_admin());

create policy nutricionista_manages_own_push_subscriptions on push_subscriptions for all
  using (nutricionista_id = (select auth.uid()))
  with check (nutricionista_id = (select auth.uid()));
create policy client_manages_own_push_subscriptions on push_subscriptions for all
  using (client_id is not null and private.is_owner_client(client_id))
  with check (client_id is not null and private.is_owner_client(client_id));

create policy nutricionista_manages_appointments on appointments for all
  using (nutricionista_id = (select auth.uid()) or private.is_super_admin())
  with check (nutricionista_id = (select auth.uid()) or private.is_super_admin());
create policy client_reads_own_appointments on appointments for select
  using (client_id is not null and private.is_owner_client(client_id));
create policy client_requests_appointments on appointments for insert
  with check (client_id is not null and private.is_owner_client(client_id) and status = 'pendiente');
create policy client_cancels_own_appointments on appointments for update
  using (client_id is not null and private.is_owner_client(client_id))
  with check (client_id is not null and private.is_owner_client(client_id) and status = 'cancelada');

create policy nutricionista_reads_meal_logs on meal_logs for select
  using (private.is_nutricionista_of_client(client_id) or private.is_super_admin());
create policy client_manages_own_meal_logs on meal_logs for all
  using (private.is_owner_client(client_id))
  with check (private.is_owner_client(client_id));
