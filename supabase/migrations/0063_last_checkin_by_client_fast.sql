-- last_checkin_by_client() (0050) agrupaba TODA la tabla daily_checkins para sacar el último check-in de cada cliente:
-- su coste crecía con el número de check-ins de la plataforma (~450 ms con ~2 millones de filas). Ahora pregunta por cada
-- cliente su máximo, que resuelve el índice (client_id, date): el coste crece con los clientes, no con sus check-ins.
-- Devuelve lo mismo (una fila por cliente que tenga algún check-in, ordenada por cliente), con los mismos permisos.
create or replace function public.last_checkin_by_client()
returns table (client_id uuid, last_checkin date)
language sql stable security definer set search_path = public as $$
  select c.id, l.last_checkin
  from public.clientes c
  cross join lateral (
    select max(d.date) as last_checkin from public.daily_checkins d where d.client_id = c.id
  ) l
  where l.last_checkin is not null
  order by c.id;
$$;

revoke all on function public.last_checkin_by_client() from public, anon, authenticated;
grant execute on function public.last_checkin_by_client() to service_role;
