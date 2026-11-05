-- Registro de accesos a la ficha de un cliente (idea de Fitai Labs, ver replica/recon-fitailabs.md, G7): quién abrió su ficha,
-- exportó sus datos o imprimió su informe, y cuándo. Refuerza el RGPD (trazabilidad de los datos de salud).
--
-- Alcance, dicho claro: registra lo que se hace DENTRO de la aplicación (abrir la ficha, exportar, informe). Lo que alguien con
-- acceso directo a la base de datos haga por otra vía no pasa por aquí y no se registra.
--
-- Solo se escribe con log_client_access (comprueba que quien llama es el nutricionista de ese cliente): nadie puede insertar,
-- cambiar ni borrar filas a mano. El nutricionista lee las de sus clientes; el cliente solo ve un resumen (cuántas veces y la
-- última), no el detalle.
create table public.access_log (
  id bigint generated always as identity primary key,
  nutricionista_id uuid not null references public.nutricionistas(uid) on delete cascade,
  actor_id uuid not null,
  actor_name text not null default '',
  client_id uuid not null references public.clientes(id) on delete cascade,
  action text not null check (action in ('ficha', 'exportacion', 'informe')),
  created_at timestamptz not null default now()
);
create index idx_access_log_nutricionista on public.access_log (nutricionista_id, created_at desc);
create index idx_access_log_client on public.access_log (client_id, created_at desc);

alter table public.access_log enable row level security;

create policy nutricionista_reads_access_log on public.access_log for select
  using (nutricionista_id = (select auth.uid()) or private.is_super_admin());

-- Apunta un acceso. La ficha abierta varias veces seguidas se apunta una vez cada 30 minutos (si no, cada pestaña que se mira
-- llenaría el registro); exportar y sacar el informe se apuntan siempre.
create or replace function public.log_client_access(p_client_id uuid, p_action text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_name text;
begin
  if p_action not in ('ficha', 'exportacion', 'informe') then raise exception 'Acción no válida'; end if;
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  select nutricionista_id into v_owner from public.clientes where id = p_client_id;
  if v_owner is null or not (private.is_nutricionista_of_client(p_client_id) or private.is_super_admin()) then
    raise exception 'No autorizado';
  end if;
  if p_action = 'ficha' and exists (
    select 1 from public.access_log
    where client_id = p_client_id and actor_id = auth.uid() and action = 'ficha' and created_at > now() - interval '30 minutes'
  ) then return; end if;
  select coalesce(display_name, '') into v_name from public.nutricionistas where uid = auth.uid();
  insert into public.access_log (nutricionista_id, actor_id, actor_name, client_id, action)
  values (v_owner, auth.uid(), coalesce(v_name, ''), p_client_id, p_action);
end;
$$;

revoke all on function public.log_client_access(uuid, text) from public, anon;
grant execute on function public.log_client_access(uuid, text) to authenticated;

-- Lo que ve el propio cliente: cuántas veces se ha abierto su ficha y se han exportado sus datos en el último año, y la última vez.
create or replace function public.get_my_access_summary(p_client_id uuid)
returns table (opens bigint, exports bigint, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  select count(*) filter (where a.action = 'ficha'),
         count(*) filter (where a.action = 'exportacion'),
         max(a.created_at)
  from public.access_log a
  join public.clientes c on c.id = a.client_id
  where a.client_id = p_client_id and c.auth_user_id = auth.uid() and a.created_at > now() - interval '1 year';
$$;

revoke all on function public.get_my_access_summary(uuid) from public, anon;
grant execute on function public.get_my_access_summary(uuid) to authenticated;
