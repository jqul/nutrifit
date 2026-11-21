-- Cierra H-B1 y H-B2 en `nutricionistas` (auditoría de permisos, 2026-11-20). PROPUESTA: no aplicada en producción.
--
-- Qué pasaba (reproducido contra una réplica en PostgreSQL real, src/lib/permisosNutricionistas.antes.test.ts):
--  · H-B1: la política `nutricionista_owns_self` era ALL con `with check (uid = auth.uid() ...)` y los roles `anon` y `authenticated`
--    tenían todos los privilegios de la tabla. Cualquier usuario con sesión podía hacer UPDATE de su propia fila con role = 'super_admin'
--    o approved = true y, con ello, leer y modificar los datos de otros profesionales. Lo mismo valía para un INSERT de una fila nueva
--    con su propio uid (no hay política ni restricción que lo impida: la fila la crea el trigger de registro, pero el privilegio estaba).
--  · H-B2: la rama `private.is_client_of_nutricionista(uid)` del USING valía también para DELETE: una clienta vinculada podía borrar la
--    fila de su profesional y, por las claves foráneas ON DELETE CASCADE, sus fichas, planes, versiones e historial.
--
-- Qué hace esta migración (tres capas independientes; cada una basta por sí sola contra la vía que cierra):
--  1. PRIVILEGIOS. `anon` y `authenticated` pierden INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES y TRIGGER sobre la tabla. `authenticated`
--     recupera UPDATE SOLO en las columnas que la aplicación edita hoy (marca, preguntas de anamnesis, documento de consentimiento) y en
--     `approved` (lo usa el panel de superadministración; el trigger de la capa 3 decide quién puede cambiarla). No se concede UPDATE
--     sobre `display_name`, `uid`, `role`, `account_mode`, `email` ni `created_at`. `service_role` y `postgres` no cambian.
--  2. POLÍTICAS RLS. Se sustituye la política ALL por una de SELECT (igual que la de hoy, incluida —de forma TEMPORAL— la rama de la
--     clienta: la retira 0075 cuando la aplicación nueva ya lea las preguntas por RPC) y dos de UPDATE (la propia fila, o cualquiera si
--     eres superadministrador). No hay políticas de INSERT ni de DELETE: ningún usuario de la API los puede hacer.
--  3. TRIGGERS. Segunda barrera independiente de los privilegios y de las políticas, por si algún día se vuelve a conceder algo:
--     · BEFORE UPDATE: no deja cambiar uid, role, account_mode, email ni created_at, y solo deja cambiar `approved` a un superadministrador.
--     · BEFORE DELETE y BEFORE TRUNCATE: los rechaza.
--     La identidad que se comprueba es `current_user`: el rol de base de datos con el que corre la sentencia. No es un dato de la
--     petición (no lo puede fijar el cliente: PostgREST hace `SET LOCAL ROLE` según el JWT ya verificado) ni depende de ningún
--     parámetro de sesión personalizado. Solo pasan `postgres`, `supabase_admin` y `service_role` (mantenimiento, funciones de borde
--     y el borrado de una cuenta de autenticación, cuyas cascadas corren como propietario de la tabla = postgres). Cualquier otro rol
--     queda restringido (lista de permitidos, no de prohibidos). Las funciones fijan `search_path = ''` y califican todos los nombres.
--     Los triggers son ENABLE ALWAYS: tampoco se saltan con `session_replication_role = replica`.
--  4. `private.is_super_admin()` pasa a tener `search_path = ''` (ver más abajo) y se añade la RPC `get_custom_anamnesis_questions`.
--
-- Qué NO hace: no toca `clientes.auth_user_id` ni `claim_client_by_token` (hallazgo aparte), ni la Fase B (validación de planes).
-- Lo que sigue funcionando: el trigger de registro (`handle_new_nutricionista`, SECURITY DEFINER, corre como propietario), las
-- funciones SECURITY DEFINER existentes, las funciones de borde (service_role), el panel de superadministración, Ajustes (marca,
-- preguntas, consentimiento) y la lectura de la clienta (todavía por la tabla: ver 0075).
--
-- Antes de aplicar en producción: probado SOLO en PGlite (src/lib/permisosNutricionistas.despues.test.ts). Pendiente de comprobar en
-- Supabase real (PostgREST, sesiones reales y los privilegios por defecto del proyecto): ver el informe de implementación.

-- 1. Privilegios ------------------------------------------------------------------------------------------------------------------
revoke all on table public.nutricionistas from anon, authenticated;
grant select on table public.nutricionistas to anon, authenticated;
grant update (logo_url, accent_color, custom_domain, contact_phone, app_name, consent_document_url, custom_anamnesis_questions, approved)
  on table public.nutricionistas to authenticated;

-- 2. Políticas --------------------------------------------------------------------------------------------------------------------
drop policy if exists nutricionista_owns_self on public.nutricionistas;

create policy nutricionistas_select on public.nutricionistas for select to authenticated
  using ((uid = (select auth.uid())) or private.is_client_of_nutricionista(uid) or private.is_super_admin());

create policy nutricionistas_update_propia on public.nutricionistas for update to authenticated
  using (uid = (select auth.uid()))
  with check (uid = (select auth.uid()));

create policy nutricionistas_update_superadmin on public.nutricionistas for update to authenticated
  using (private.is_super_admin())
  with check (private.is_super_admin());

-- 3. Triggers ---------------------------------------------------------------------------------------------------------------------
create or replace function private.nutricionistas_proteger_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Identidad efectiva = rol con el que corre la sentencia (no un dato de la petición). Lista de permitidos.
  if current_user in ('postgres', 'supabase_admin', 'service_role') then return new; end if;

  if new.uid is distinct from old.uid
     or new.role is distinct from old.role
     or new.account_mode is distinct from old.account_mode
     or new.email is distinct from old.email
     or new.created_at is distinct from old.created_at then
    raise exception 'No se pueden modificar uid, role, account_mode, email ni created_at de una cuenta' using errcode = '42501';
  end if;

  if new.approved is distinct from old.approved and not private.is_super_admin() then
    raise exception 'Solo un superadministrador puede cambiar la aprobación de una cuenta' using errcode = '42501';
  end if;

  return new;
end $$;

create or replace function private.nutricionistas_proteger_borrado() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    if tg_op = 'DELETE' then return old; end if;
    return null;
  end if;
  raise exception 'Las cuentas de profesional no se pueden borrar desde la API' using errcode = '42501';
end $$;

drop trigger if exists nutricionistas_proteger_update on public.nutricionistas;
create trigger nutricionistas_proteger_update before update on public.nutricionistas
  for each row execute function private.nutricionistas_proteger_update();

drop trigger if exists nutricionistas_proteger_delete on public.nutricionistas;
create trigger nutricionistas_proteger_delete before delete on public.nutricionistas
  for each row execute function private.nutricionistas_proteger_borrado();

drop trigger if exists nutricionistas_proteger_truncate on public.nutricionistas;
create trigger nutricionistas_proteger_truncate before truncate on public.nutricionistas
  for each statement execute function private.nutricionistas_proteger_borrado();

alter table public.nutricionistas enable always trigger nutricionistas_proteger_update;
alter table public.nutricionistas enable always trigger nutricionistas_proteger_delete;
alter table public.nutricionistas enable always trigger nutricionistas_proteger_truncate;

revoke all on function private.nutricionistas_proteger_update() from public, anon, authenticated;
revoke all on function private.nutricionistas_proteger_borrado() from public, anon, authenticated;

-- is_super_admin() con el search_path vacío y la tabla cualificada. Mismo resultado que antes. Motivo (probado en PGlite): con
-- `search_path = public` Postgres busca primero en el esquema temporal, así que quien pueda ejecutar SQL libre (no es el caso de
-- PostgREST, pero sí de cualquier acceso directo a la base) creaba `pg_temp.nutricionistas` con su propia fila de super_admin y
-- is_super_admin() le devolvía true, lo que además habría abierto la rama de superadministrador del trigger. Las otras tres
-- funciones auxiliares de RLS tienen el mismo patrón y NO se tocan aquí (fuera de alcance; ver el informe).
create or replace function private.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.nutricionistas where uid = auth.uid() and role = 'super_admin');
$$;

-- 4. Lectura de las preguntas de anamnesis sin dar acceso a la fila entera ----------------------------------------------------------
-- Devuelve SOLO `custom_anamnesis_questions`. Si quien llama no es ese profesional, una clienta vinculada a él ni un superadministrador,
-- falla con un error (42501) en vez de devolver una lista vacía: una pantalla que no pueda leer las preguntas debe verlo, no mostrar un
-- cuestionario sin ellas. Con la aplicación nueva desplegada, 0075 retira a las clientas el acceso a la fila del profesional.
create or replace function public.get_custom_anamnesis_questions(p_nutricionista_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if auth.uid() is null then
    raise exception 'Hace falta una sesión' using errcode = '28000';
  end if;
  if not (p_nutricionista_id = auth.uid()
          or private.is_client_of_nutricionista(p_nutricionista_id)
          or private.is_super_admin()) then
    raise exception 'Sin acceso a las preguntas de este profesional' using errcode = '42501';
  end if;
  select n.custom_anamnesis_questions into v from public.nutricionistas n where n.uid = p_nutricionista_id;
  return coalesce(v, '[]'::jsonb);
end $$;

revoke all on function public.get_custom_anamnesis_questions(uuid) from public, anon;
grant execute on function public.get_custom_anamnesis_questions(uuid) to authenticated;
