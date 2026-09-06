-- Adjuntar el PDF original del laboratorio a una extracción de sangre —
-- además de los valores numéricos que ya se registran en blood_markers,
-- para tener el informe tal cual siempre a mano. Una fila por extracción
-- (client_id + date), no por marcador — no tiene sentido duplicar el
-- mismo archivo en cada lectura de esa fecha.
create table lab_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clientes(id) on delete cascade,
  date date not null,
  file_path text not null,
  file_name text not null,
  uploaded_at timestamptz not null default now(),
  unique (client_id, date)
);

create index idx_lab_reports_client_id on lab_reports(client_id);

alter table lab_reports enable row level security;

create policy client_reads_own_lab_reports on lab_reports
  for select using (private.is_owner_client(client_id));

create policy nutricionista_manages_lab_reports on lab_reports
  for all using (private.is_nutricionista_of_client(client_id) or private.is_super_admin())
  with check (private.is_nutricionista_of_client(client_id) or private.is_super_admin());

-- Bucket PRIVADO desde el principio (a diferencia de `photos`, que se creó
-- público por error en 0001_init.sql y hubo que corregir en 0033) — un
-- informe de laboratorio es tan delicado como una foto corporal.
insert into storage.buckets (id, name, public)
values ('lab-reports', 'lab-reports', false)
on conflict (id) do nothing;

create policy lab_reports_nutricionista_write on storage.objects for insert to authenticated
  with check (bucket_id = 'lab-reports' and private.is_nutricionista_of_client((storage.foldername(name))[1]::uuid));

create policy lab_reports_nutricionista_update on storage.objects for update to authenticated
  using (bucket_id = 'lab-reports' and private.is_nutricionista_of_client((storage.foldername(name))[1]::uuid));

create policy lab_reports_nutricionista_delete on storage.objects for delete to authenticated
  using (bucket_id = 'lab-reports' and private.is_nutricionista_of_client((storage.foldername(name))[1]::uuid));

create policy lab_reports_read on storage.objects for select
  using (
    bucket_id = 'lab-reports' and (
      private.is_owner_client((storage.foldername(name))[1]::uuid)
      or private.is_nutricionista_of_client((storage.foldername(name))[1]::uuid)
      or private.is_super_admin()
    )
  );

-- NOTA: esta migración no se ha podido aplicar a la base de datos real en
-- esta sesión (sin conector de Supabase disponible) — aplícala junto con
-- el resto de cambios pendientes (0033, 0034 y esta) desde el SQL Editor
-- del dashboard o `supabase db push`.
