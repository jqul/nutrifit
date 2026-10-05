-- Resúmenes de actividad calculados en la base de datos, para no traer miles de
-- filas solo para quedarse con un dato por cliente.
--
-- Contexto: PostgREST devuelve como mucho 1.000 filas por consulta (valor por
-- defecto de Supabase) y CORTA EN SILENCIO. La lista de clientes de la app y las
-- funciones programadas leían "todos los check-ins" y "todos los pesajes" para
-- sacar el último check-in o el primer peso de cada cliente: con unos pocos
-- clientes y unos meses de datos esas consultas ya se pasan de 1.000 filas y los
-- resultados salen mal sin ningún error. Estas dos funciones devuelven una fila
-- por cliente, así que no tienen ese problema.

-- Por cliente: último check-in, último y primer pesaje (con su peso). SECURITY
-- INVOKER (el valor por defecto): se aplica RLS, así que un nutricionista solo
-- obtiene datos de sus clientes y la service role (funciones programadas) de todos.
create or replace function public.clients_activity_summary(p_client_ids uuid[])
returns table (
  client_id uuid,
  last_checkin date,
  last_weigh_in date,
  first_weigh_in date,
  first_weight_kg numeric,
  last_weight_kg numeric
)
language sql stable set search_path = public as $$
  select c.id,
    (select max(d.date) from public.daily_checkins d where d.client_id = c.id),
    (select max(w.date) from public.weight_logs w where w.client_id = c.id),
    (select w.date from public.weight_logs w where w.client_id = c.id order by w.date asc, w.id asc limit 1),
    (select w.weight_kg from public.weight_logs w where w.client_id = c.id order by w.date asc, w.id asc limit 1),
    (select w.weight_kg from public.weight_logs w where w.client_id = c.id order by w.date desc, w.id desc limit 1)
  from public.clientes c
  where c.id = any(p_client_ids)
  order by c.id;
$$;

revoke all on function public.clients_activity_summary(uuid[]) from public, anon;
grant execute on function public.clients_activity_summary(uuid[]) to authenticated, service_role;

-- Último check-in de CADA cliente de la plataforma, para los recordatorios
-- programados. Solo la service role puede llamarla: ve datos de todos los
-- nutricionistas, así que no se expone a usuarios (por eso SECURITY DEFINER y el
-- revoke explícito).
create or replace function public.last_checkin_by_client()
returns table (client_id uuid, last_checkin date)
language sql stable security definer set search_path = public as $$
  select d.client_id, max(d.date)
  from public.daily_checkins d
  group by d.client_id
  order by d.client_id;
$$;

revoke all on function public.last_checkin_by_client() from public, anon, authenticated;
grant execute on function public.last_checkin_by_client() to service_role;
