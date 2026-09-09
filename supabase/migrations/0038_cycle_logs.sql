-- Registro de inicio de ciclo menstrual: solo la fecha en que el cliente
-- marca "hoy empieza mi periodo" — sirve para sombrear en el gráfico de
-- peso la semana previa a cada inicio (fase lútea tardía), donde 1-2.5kg de
-- fluctuación por retención de líquidos es fisiológico y no debería leerse
-- como "he ganado grasa" (ver WeightChart.tsx). Mismo patrón que
-- weight_logs: el cliente gestiona sus propias filas, el nutricionista solo
-- lee.
create table cycle_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clientes(id) on delete cascade,
  start_date date not null,
  unique (client_id, start_date)
);

create index idx_cycle_logs_client_id on cycle_logs(client_id);

alter table cycle_logs enable row level security;

-- Las funciones is_nutricionista_of_client/is_owner_client/is_super_admin de
-- 0001_init.sql viven hoy en el esquema `private` (se movieron ahí en algún
-- punto posterior sin backfillear el cambio en el propio 0001, así que
-- daría 42883 si se llamaran sin el prefijo) — confirmado contra las
-- políticas reales de weight_logs en producción antes de aplicar esta.
create policy nutricionista_reads_cycle_logs on cycle_logs for select
  using (private.is_nutricionista_of_client(client_id) or private.is_super_admin());
create policy client_manages_cycle_logs on cycle_logs for all
  using (private.is_owner_client(client_id))
  with check (private.is_owner_client(client_id));
