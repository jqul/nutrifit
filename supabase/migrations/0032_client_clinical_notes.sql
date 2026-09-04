-- Notas clínicas fechadas y visibles para el cliente — a diferencia de
-- clientes.notes (privadas, solo el nutricionista) o report_notes (un único
-- bloque de texto para el informe), esto es un historial cronológico de
-- observaciones/cambios de pauta que alimenta la Línea de Vida Clínica
-- (HealthTimeline) tanto en el panel del nutricionista como en el portal
-- del cliente.
create table client_clinical_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clientes(id) on delete cascade,
  date date not null default current_date,
  note text not null,
  created_at timestamptz not null default now()
);

create index idx_client_clinical_notes_client_id on client_clinical_notes(client_id);

alter table client_clinical_notes enable row level security;

create policy client_reads_own_clinical_notes on client_clinical_notes
  for select using (private.is_owner_client(client_id));

create policy nutricionista_manages_clinical_notes on client_clinical_notes
  for all using (private.is_nutricionista_of_client(client_id) or private.is_super_admin())
  with check (private.is_nutricionista_of_client(client_id) or private.is_super_admin());
