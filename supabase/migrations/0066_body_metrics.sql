-- Medidas corporales y métricas propias (idea de la «evolución del cliente» de Harbiz, ver replica/recon-harbiz.md):
-- % de grasa, cintura, cadera… y las que cada nutricionista quiera inventar («pliegue tricipital», «masa muscular»).
--
-- metric_definitions: qué se mide (nombre, unidad) y si el cliente lo ve. Las estándar llevan una `key` fija y se crean
-- para cada nutricionista la primera vez que abre las medidas; las propias no tienen key.
-- body_metrics: cada valor con su fecha. El peso no va aquí: sigue en weight_logs.
--
-- Escribe el nutricionista (en consulta). El cliente solo LEE sus valores de las métricas marcadas como visibles; lo que el
-- nutricionista oculta no llega al cliente ni consultando la API.
create table public.metric_definitions (
  id uuid primary key default gen_random_uuid(),
  nutricionista_id uuid not null references public.nutricionistas(uid) on delete cascade,
  key text,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  unit text not null default '' check (char_length(unit) <= 12),
  client_visible boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index uq_metric_definitions_key on public.metric_definitions (nutricionista_id, key) where key is not null;
create index idx_metric_definitions_nutricionista on public.metric_definitions (nutricionista_id, sort_order);

create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clientes(id) on delete cascade,
  metric_id uuid not null references public.metric_definitions(id) on delete cascade,
  date date not null,
  value numeric not null check (value > 0 and value < 10000),
  created_at timestamptz not null default now(),
  unique (client_id, metric_id, date)
);
create index idx_body_metrics_client on public.body_metrics (client_id, date);

alter table public.metric_definitions enable row level security;
alter table public.body_metrics enable row level security;

create policy nutricionista_owns_metric_definitions on public.metric_definitions for all
  using (nutricionista_id = (select auth.uid()) or private.is_super_admin())
  with check (nutricionista_id = (select auth.uid()) or private.is_super_admin());

-- El cliente ve la lista de lo que se mide, solo lo visible y solo de su nutricionista.
create policy client_reads_visible_metric_definitions on public.metric_definitions for select
  using (client_visible and private.is_client_of_nutricionista(nutricionista_id));

-- ¿Es esta métrica visible para el cliente? SECURITY DEFINER para no depender de las políticas de metric_definitions.
create or replace function private.metric_visible_to_clients(p_metric_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from metric_definitions d where d.id = p_metric_id and d.client_visible);
$$;

-- ¿La métrica es de este nutricionista? (para que no se mezclen métricas de otro en un cliente suyo)
create or replace function private.metric_belongs_to_me(p_metric_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from metric_definitions d where d.id = p_metric_id and d.nutricionista_id = auth.uid());
$$;

create policy nutricionista_owns_body_metrics on public.body_metrics for all
  using (private.is_nutricionista_of_client(client_id) or private.is_super_admin())
  with check ((private.is_nutricionista_of_client(client_id) and private.metric_belongs_to_me(metric_id)) or private.is_super_admin());

create policy client_reads_own_visible_body_metrics on public.body_metrics for select
  using (private.is_owner_client(client_id) and private.metric_visible_to_clients(metric_id));
