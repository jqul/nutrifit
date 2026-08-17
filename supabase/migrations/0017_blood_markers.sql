-- Analíticas de sangre: entrada manual de valores de laboratorio, sin
-- lectura automática de PDF/imagen ni IA. Los rangos y consejos se evalúan
-- en código (src/lib/bloodMarkers.ts) contra este dato bruto.
create table blood_markers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clientes(id) on delete cascade,
  date date not null default current_date,
  marker_key text not null,
  value numeric not null,
  created_at timestamptz not null default now()
);

create index idx_blood_markers_client_id on blood_markers(client_id);

alter table blood_markers enable row level security;

create policy client_reads_own_blood_markers on blood_markers
  for select using (private.is_owner_client(client_id));

create policy nutricionista_manages_blood_markers on blood_markers
  for all using (private.is_nutricionista_of_client(client_id) or private.is_super_admin())
  with check (private.is_nutricionista_of_client(client_id) or private.is_super_admin());
