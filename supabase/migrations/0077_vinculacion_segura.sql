-- VINCULACIÓN SEGURA DE CLIENTAS, parte 1 de 3 (ADITIVA). PROPUESTA: no aplicada en ninguna base.
-- Auditoría de clientes.auth_user_id / claim_client_by_token (2026-11-21), criterios del responsable del producto.
--
-- Qué había (reproducido en src/lib/auditoriaAuthUserId.test.ts): quien conociera el token de una ficha sin reclamar y tuviera CUALQUIER sesión
-- se convertía en su titular (sin comprobar que fuese la persona de la ficha); la función no decía si había funcionado; el profesional podía
-- cambiar auth_user_id con un UPDATE directo; «Regenerar enlace» no retiraba al titular; y nada de esto dejaba rastro.
--
-- Qué añade esta parte (no rompe a la aplicación actual; el cierre es 0078 y la retirada de compatibilidad 0079):
--  1. INVITACIONES (client_invitations): credencial de reclamación de vida corta. 24 horas, un solo uso, se guarda SOLO el hash (SHA-256) del
--     token (nunca en claro), y generar una nueva revoca la anterior en la misma transacción (índice único parcial: una activa por ficha).
--  2. SOLICITUDES PENDIENTES (client_link_requests): si la ficha NO tiene email, reclamar no vincula: queda pendiente de aprobación expresa del
--     profesional dueño (caduca a los 7 días).
--  3. EVENTOS (client_link_events): registro de solo inserción de cada vinculación, desvinculación y reasignación (actor, profesional, ficha, uid
--     anterior y nuevo, fecha, método, motivo; sin tokens ni emails ni datos clínicos). Lo escribe un trigger sobre clientes.auth_user_id, así que
--     queda constancia aunque el cambio se haga por mantenimiento. UPDATE y TRUNCATE están prohibidos para todos los roles; DELETE solo lo hace la
--     función de purga por retención.
--  4. AVISOS (client_link_notifications): bandeja de salida para avisar al profesional de cada vinculación (la envía la función de borde
--     notify-client-link; ver supabase/functions/notify-client-link). Sin información clínica.
--  5. FUNCIONES (SECURITY DEFINER, search_path vacío): create_client_invitation, get_invitation_status, claim_client_with_invitation,
--     approve_client_link, reject_client_link, unlink_client_account, get_client_link_state, get_my_link_requests, purge_client_link_events.
--     Todas devuelven un resultado EXPLÍCITO; ninguna falla en silencio.
--  6. INTENTOS: límite de reclamaciones fallidas por cuenta (10 por hora) y consentimiento cuestionado (columna clientes.consent_invalidated_at: el registro original
--     NO se borra ni se modifica; se añade la marca y un evento «consent_invalidated»). La bandeja de avisos usa arrendamiento (take/finish) para no duplicar envíos.
--  7. PROTECCIÓN INMEDIATA de clientes (reduce la ventana hasta 0078): el trigger clientes_proteger_vinculo bloquea desde ya el UPDATE directo de auth_user_id, nutricionista_id,
--     id y consent_invalidated_at, y la creación de fichas ya vinculadas, para los roles de la API. La aplicación ACTUAL no hace ninguna de esas cosas (solo lee auth_user_id),
--     así que no la afecta; el UPDATE de `token` (su «Regenerar enlace») y la reclamación antigua siguen funcionando hasta 0078, que añade el token a la protección.
--  8. LÍNEA BASE: un evento «linked / migracion_inicial» por cada ficha ya vinculada (honesto: preexistente y no verificada por este mecanismo).
--
-- REQUISITO NO CUBIERTO POR SQL: la confirmación de email. Hoy el proyecto NO la exige (en producción, 6 de 6 usuarios tienen email_confirmed_at =
-- created_at y confirmation_sent_at nulo: confirmación automática). Mientras Auth no la exija, la regla de email_confirmado_por_la_persona()
-- (exige que se haya ENVIADO una confirmación y que se haya confirmado después) hace que ninguna reclamación prospere: falla cerrado, no abierto.
-- Activar «Confirm email» en Auth es una decisión aparte (afecta también al registro de profesionales) y no se hace desde una migración.

-- 1. Utilidades privadas ---------------------------------------------------------------------------------------------------------------------
create or replace function private.normalizar_email(p text) returns text
language sql immutable set search_path = '' as $$ select lower(btrim(coalesce(p, ''))) $$;

create or replace function private.hash_token(p text) returns text
language sql immutable set search_path = '' as $$ select encode(sha256(convert_to(coalesce(p, ''), 'UTF8')), 'hex') $$;

create or replace function private.token_nuevo() returns text
language sql volatile set search_path = '' as $$ select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') $$;

-- ¿El email de la cuenta lo ha confirmado la persona? Exige que Auth haya ENVIADO una confirmación y que se confirmase después. Con la
-- confirmación automática de Auth (confirmation_sent_at nulo) devuelve false: así una configuración permisiva no abre la vinculación.
-- Verificar en un entorno aislado de Supabase que GoTrue conserva confirmation_sent_at tras confirmar; esta es la ÚNICA regla a ajustar si no.
create or replace function private.email_confirmado_por_la_persona(p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = p_uid and u.email_confirmed_at is not null and u.confirmation_sent_at is not null
      and u.email_confirmed_at >= u.confirmation_sent_at and not coalesce(u.is_anonymous, false)
  );
$$;

-- 2. Tablas ------------------------------------------------------------------------------------------------------------------------------------
create table public.client_invitations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clientes(id) on delete cascade,
  nutricionista_id uuid not null references public.nutricionistas(uid) on delete cascade,
  token_hash text not null unique,                       -- SHA-256 del token; el token solo se muestra una vez, al generarlo
  created_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz, consumed_by uuid,
  revoked_at timestamptz, revoked_reason text,
  constraint client_invitations_vida_maxima check (expires_at > created_at and expires_at <= created_at + interval '24 hours'),
  constraint client_invitations_un_solo_estado check (not (consumed_at is not null and revoked_at is not null))
);
create unique index client_invitations_una_activa on public.client_invitations (client_id) where consumed_at is null and revoked_at is null;

create table public.client_link_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clientes(id) on delete cascade,
  nutricionista_id uuid not null references public.nutricionistas(uid) on delete cascade,
  requester_uid uuid not null,
  requester_email text not null,                         -- email confirmado de la cuenta: el profesional necesita saber a quién aprueba
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  decision text check (decision in ('approved', 'rejected', 'cancelled', 'expired')),
  decided_at timestamptz, decided_by uuid, decision_reason text,
  constraint client_link_requests_decision_coherente check ((decision is null) = (decided_at is null))
);
create unique index client_link_requests_una_pendiente on public.client_link_requests (client_id) where decision is null;

create table public.client_link_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  event text not null check (event in ('invitation_created', 'invitation_revoked', 'link_requested', 'linked', 'link_rejected', 'unlinked', 'reassigned', 'claim_denied', 'consent_invalidated')),
  nutricionista_id uuid not null,                        -- sin clave foránea: el registro sobrevive al borrado de la ficha o de la cuenta (la purga la decide la retención)
  client_id uuid not null,
  actor_id uuid,                                         -- auth.uid() de quien actúa; null = sistema o mantenimiento
  actor_role text not null check (actor_role in ('client', 'professional', 'super_admin', 'system')),
  previous_uid uuid, new_uid uuid,
  method text not null,
  reason text,
  invitation_id uuid                                     -- referencia a la invitación, NUNCA el token
);
create index client_link_events_ficha on public.client_link_events (client_id, occurred_at);
create index client_link_events_profesional on public.client_link_events (nutricionista_id, occurred_at);

create table public.client_link_notifications (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.client_link_events(id) on delete cascade,
  nutricionista_id uuid not null,
  client_id uuid not null,
  kind text not null check (kind in ('linked', 'pending_approval')),
  method text not null,
  occurred_at timestamptz not null,
  sent_at timestamptz, attempts int not null default 0, last_error text
);
create index client_link_notifications_pendientes on public.client_link_notifications (id) where sent_at is null;

-- Consentimiento cuestionado por suplantación: se CONSERVA consent_accepted_at / consent_signed_name tal cual y se añade esta marca. El consentimiento solo vale
-- si no hay marca o si se firmó DESPUÉS de ella (una firma nueva de la clienta legítima lo vuelve a dejar vigente).
alter table public.clientes add column if not exists consent_invalidated_at timestamptz;

create table public.client_link_attempts (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  attempted_at timestamptz not null default now(),
  outcome text not null
);
create index client_link_attempts_actor on public.client_link_attempts (actor_id, attempted_at);

alter table public.client_link_notifications add column locked_until timestamptz;

-- 3. Privilegios y RLS: nadie escribe estas tablas por la API (solo las funciones, que corren como propietario) -------------------------------------
alter table public.client_invitations enable row level security;
alter table public.client_link_requests enable row level security;
alter table public.client_link_events enable row level security;
alter table public.client_link_notifications enable row level security;
alter table public.client_link_attempts enable row level security;
revoke all on public.client_invitations, public.client_link_requests, public.client_link_events, public.client_link_notifications, public.client_link_attempts from public, anon, authenticated;
grant select on public.client_invitations, public.client_link_requests, public.client_link_events to authenticated;
create policy invitaciones_del_profesional on public.client_invitations for select to authenticated using (nutricionista_id = (select auth.uid()) or private.is_super_admin());
create policy solicitudes_del_profesional on public.client_link_requests for select to authenticated using (nutricionista_id = (select auth.uid()) or private.is_super_admin());
create policy eventos_del_profesional on public.client_link_events for select to authenticated using (nutricionista_id = (select auth.uid()) or private.is_super_admin());

-- 4. Eventos de solo inserción ------------------------------------------------------------------------------------------------------------------
create or replace function private.eventos_vinculo_solo_insercion() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('nutrifit.purga', true), '') = 'on' then return old; end if;
  raise exception 'client_link_events es de solo inserción (%)', tg_op using errcode = '42501';
end $$;
create trigger eventos_vinculo_no_update before update on public.client_link_events for each row execute function private.eventos_vinculo_solo_insercion();
create trigger eventos_vinculo_no_delete before delete on public.client_link_events for each row execute function private.eventos_vinculo_solo_insercion();
create trigger eventos_vinculo_no_truncate before truncate on public.client_link_events for each statement execute function private.eventos_vinculo_solo_insercion();
alter table public.client_link_events enable always trigger eventos_vinculo_no_update;
alter table public.client_link_events enable always trigger eventos_vinculo_no_delete;
alter table public.client_link_events enable always trigger eventos_vinculo_no_truncate;

-- 5. Registro de eventos (única vía de escritura de client_link_events) ----------------------------------------------------------------------------
create or replace function private.registrar_evento_vinculo(
  p_event text, p_nutricionista uuid, p_client uuid, p_actor uuid, p_actor_role text,
  p_previous uuid, p_new uuid, p_method text, p_reason text, p_invitation uuid
) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  insert into public.client_link_events (event, nutricionista_id, client_id, actor_id, actor_role, previous_uid, new_uid, method, reason, invitation_id)
  values (p_event, p_nutricionista, p_client, p_actor, p_actor_role, p_previous, p_new, p_method, left(p_reason, 300), p_invitation)
  returning id into v_id;
  -- Aviso al profesional: solo cuando una cuenta se vincula por el procedimiento normal o hay una solicitud que aprobar.
  if (p_event = 'linked' and p_method in ('email_verificado', 'aprobacion_profesional')) or p_event = 'link_requested' then
    insert into public.client_link_notifications (event_id, nutricionista_id, client_id, kind, method, occurred_at)
    values (v_id, p_nutricionista, p_client, case when p_event = 'linked' then 'linked' else 'pending_approval' end, p_method, now());
  end if;
  return v_id;
end $$;

-- Las funciones de este fichero indican el contexto de un cambio de auth_user_id con un parámetro local de la transacción; el trigger lo lee,
-- lo escribe en el evento y lo borra. Si no hay contexto, el cambio se registra como «cambio_directo» (mantenimiento o vía antigua).
create or replace function private.contexto_vinculo(p_method text, p_actor_role text, p_reason text, p_invitation uuid) returns void
language sql volatile set search_path = '' as $$
  select set_config('nutrifit.vinculacion', jsonb_build_object('method', p_method, 'actor_role', p_actor_role, 'reason', p_reason, 'invitation', p_invitation)::text, true);
$$;

create or replace function private.trg_registrar_vinculo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_ctx jsonb := nullif(current_setting('nutrifit.vinculacion', true), '')::jsonb; v_method text; v_role text; v_event text; v_prev uuid; v_new uuid; v_client uuid; v_prof uuid;
begin
  if tg_op = 'DELETE' then
    if old.auth_user_id is null then return old; end if;
    v_event := 'unlinked'; v_prev := old.auth_user_id; v_new := null; v_client := old.id; v_prof := old.nutricionista_id; v_method := 'ficha_eliminada';
  else
    v_client := new.id; v_prof := new.nutricionista_id; v_prev := case when tg_op = 'UPDATE' then old.auth_user_id else null end; v_new := new.auth_user_id;
    if v_prev is not distinct from v_new then return new; end if;
    v_event := case when v_prev is null then 'linked' when v_new is null then 'unlinked' else 'reassigned' end;
    v_method := case when tg_op = 'INSERT' and new.auth_user_id = new.nutricionista_id then 'modo_personal' else 'cambio_directo' end;
  end if;
  v_method := coalesce(v_ctx ->> 'method', v_method);
  v_role := coalesce(v_ctx ->> 'actor_role', 'system');
  perform private.registrar_evento_vinculo(v_event, v_prof, v_client, auth.uid(), v_role, v_prev, v_new, v_method, v_ctx ->> 'reason', nullif(v_ctx ->> 'invitation', '')::uuid);
  perform set_config('nutrifit.vinculacion', '', true);
  return coalesce(new, old);
end $$;
create trigger clientes_registrar_vinculo after insert or update of auth_user_id on public.clientes for each row execute function private.trg_registrar_vinculo();
create trigger clientes_registrar_vinculo_borrado after delete on public.clientes for each row execute function private.trg_registrar_vinculo();

-- 5b. Protección inmediata de clientes (versión 1: compatible con la aplicación antigua; 0078 la amplía al token) ----------------------------------------------
create or replace function private.clientes_proteger_vinculo() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then return new; end if;
  if tg_op = 'INSERT' then
    if new.auth_user_id is not null then raise exception 'Una ficha no se puede crear ya vinculada a una cuenta' using errcode = '42501'; end if;
    return new;
  end if;
  if new.auth_user_id is distinct from old.auth_user_id or new.nutricionista_id is distinct from old.nutricionista_id
     or new.id is distinct from old.id or new.consent_invalidated_at is distinct from old.consent_invalidated_at then
    raise exception 'auth_user_id, nutricionista_id, id y consent_invalidated_at no se modifican directamente: usa los procedimientos de vinculación' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.clientes_proteger_vinculo() from public, anon, authenticated;
create trigger clientes_proteger_vinculo before insert or update on public.clientes for each row execute function private.clientes_proteger_vinculo();
alter table public.clientes enable always trigger clientes_proteger_vinculo;

-- 6. RPC ---------------------------------------------------------------------------------------------------------------------------------------
-- 6.1 Generar un enlace de acceso nuevo (24 h, un solo uso). El token se devuelve UNA vez; después solo existe su hash. Revoca el anterior.
create or replace function public.create_client_invitation(p_client_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_c record; v_token text := private.token_nuevo(); v_id uuid; v_exp timestamptz := now() + interval '24 hours'; v_rev record; v_role text;
begin
  if auth.uid() is null then raise exception 'Hace falta una sesión' using errcode = '28000'; end if;
  select c.id, c.nutricionista_id, c.auth_user_id into v_c from public.clientes c where c.id = p_client_id for update;
  if not found or not (v_c.nutricionista_id = auth.uid() or private.is_super_admin()) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if v_c.auth_user_id is not null then raise exception 'La ficha ya está vinculada a una cuenta: desvincúlala antes de generar un enlace' using errcode = '55000'; end if;
  v_role := case when v_c.nutricionista_id = auth.uid() then 'professional' else 'super_admin' end;
  for v_rev in update public.client_invitations set revoked_at = now(), revoked_reason = 'regenerado'
      where client_id = p_client_id and consumed_at is null and revoked_at is null returning id, expires_at loop
    if v_rev.expires_at > now() then
      perform private.registrar_evento_vinculo('invitation_revoked', v_c.nutricionista_id, p_client_id, auth.uid(), v_role, null, null, 'enlace_regenerado', null, v_rev.id);
    end if;
  end loop;
  insert into public.client_invitations (client_id, nutricionista_id, token_hash, created_by, expires_at)
  values (p_client_id, v_c.nutricionista_id, private.hash_token(v_token), auth.uid(), v_exp) returning id into v_id;
  perform private.registrar_evento_vinculo('invitation_created', v_c.nutricionista_id, p_client_id, auth.uid(), v_role, null, null, 'enlace_24h', null, v_id);
  return jsonb_build_object('token', v_token, 'expires_at', v_exp, 'invitation_id', v_id);
end $$;

-- 6.2 Estado de una invitación (anónimo: la usa la pantalla de acceso). Respuesta uniforme; no revela el email de la ficha.
create or replace function public.get_invitation_status(p_token text)
returns table(status text, client_first_name text, requires_approval boolean, display_name text, logo_url text, accent_color text, contact_phone text, consent_document_url text, app_name text)
language plpgsql stable security definer set search_path = '' as $$
declare v_i record; v_c record; v_n record; v_status text;
begin
  select * into v_i from public.client_invitations where token_hash = private.hash_token(p_token);
  if not found then return query select 'invalid'::text, null::text, null::boolean, null::text, null::text, null::text, null::text, null::text, null::text; return; end if;
  select c.name, c.email, c.auth_user_id into v_c from public.clientes c where c.id = v_i.client_id;
  select n.display_name, n.logo_url, n.accent_color, n.contact_phone, n.consent_document_url, n.app_name into v_n from public.nutricionistas n where n.uid = v_i.nutricionista_id;
  v_status := case when v_i.revoked_at is not null then 'revoked' when v_i.consumed_at is not null then 'used' when v_i.expires_at <= now() then 'expired'
                   when v_c.auth_user_id is not null then 'ficha_already_linked' else 'valid' end;
  return query select v_status, split_part(btrim(coalesce(v_c.name, '')), ' ', 1), private.normalizar_email(v_c.email) = '',
    v_n.display_name, v_n.logo_url, v_n.accent_color, v_n.contact_phone, v_n.consent_document_url, v_n.app_name;
end $$;

-- 6.3 Reclamar con una invitación. Resultado explícito; atómica (bloqueos de fila sobre la invitación y la ficha). Nunca basta con conocer el token.
create or replace function private.reclamar_con_invitacion(p_uid uuid, p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := p_uid; v_i record; v_c record; v_email text; v_req uuid;
begin
  select * into v_i from public.client_invitations where token_hash = private.hash_token(p_token) for update;
  if not found then return jsonb_build_object('result', 'invitation_invalid'); end if;
  if v_i.revoked_at is not null then return jsonb_build_object('result', 'invitation_revoked'); end if;
  if v_i.consumed_at is not null then return jsonb_build_object('result', 'invitation_used'); end if;
  if v_i.expires_at <= now() then return jsonb_build_object('result', 'invitation_expired'); end if;

  select u.email into v_email from auth.users u where u.id = v_uid;
  if exists (select 1 from public.nutricionistas n where n.uid = v_uid) then
    return jsonb_build_object('result', 'account_not_allowed');            -- una cuenta de profesional (o de modo personal) no puede ser titular de la ficha de otra persona
  end if;
  if not private.email_confirmado_por_la_persona(v_uid) then
    return jsonb_build_object('result', 'email_not_confirmed');            -- no consume la invitación: se podrá reclamar tras confirmar
  end if;

  select c.id, c.nutricionista_id, c.email, c.auth_user_id into v_c from public.clientes c where c.id = v_i.client_id for update;
  if not found then return jsonb_build_object('result', 'invitation_invalid'); end if;
  if v_c.auth_user_id is not null then
    return jsonb_build_object('result', case when v_c.auth_user_id = v_uid then 'already_linked' else 'ficha_already_linked' end);
  end if;

  if private.normalizar_email(v_c.email) <> '' then
    if private.normalizar_email(v_c.email) <> private.normalizar_email(v_email) then
      if not exists (select 1 from public.client_link_events e where e.client_id = v_c.id and e.actor_id = v_uid and e.event = 'claim_denied' and e.occurred_at > now() - interval '1 hour') then
        perform private.registrar_evento_vinculo('claim_denied', v_c.nutricionista_id, v_c.id, v_uid, 'client', null, null, 'email_no_coincide', null, v_i.id);
      end if;
      return jsonb_build_object('result', 'email_mismatch');
    end if;
    update public.client_invitations set consumed_at = now(), consumed_by = v_uid where id = v_i.id;
    perform private.contexto_vinculo('email_verificado', 'client', null, v_i.id);
    update public.clientes set auth_user_id = v_uid where id = v_c.id;
    return jsonb_build_object('result', 'linked', 'client_id', v_c.id);
  end if;

  -- Sin email en la ficha: queda pendiente de aprobación expresa del profesional dueño.
  update public.client_link_requests set decision = 'expired', decided_at = now(), decision_reason = 'caducada' where client_id = v_c.id and decision is null and expires_at <= now();
  if exists (select 1 from public.client_link_requests r where r.client_id = v_c.id and r.decision is null) then
    return jsonb_build_object('result', 'pending_exists');                 -- no consume la invitación
  end if;
  update public.client_invitations set consumed_at = now(), consumed_by = v_uid where id = v_i.id;
  insert into public.client_link_requests (client_id, nutricionista_id, requester_uid, requester_email, expires_at)
  values (v_c.id, v_c.nutricionista_id, v_uid, coalesce(v_email, ''), now() + interval '7 days') returning id into v_req;
  perform private.registrar_evento_vinculo('link_requested', v_c.nutricionista_id, v_c.id, v_uid, 'client', null, v_uid, 'solicitud_pendiente_aprobacion', null, v_i.id);
  return jsonb_build_object('result', 'pending_approval', 'request_id', v_req);
end $$;

-- Límite de intentos: 10 reclamaciones FALLIDAS por cuenta y hora. Las que no son un fallo de la persona (vincular, solicitud, ya vinculada, falta confirmar
-- el email, solicitud ya pendiente) no cuentan. Con 244 bits de entropía el token no se puede adivinar; el límite frena sobre todo el tanteo de enlaces
-- y la repetición automática desde una cuenta. NO limita las consultas anónimas de get_invitation_status (no hay IP en SQL: lo cubre el límite de la API de Supabase).
create or replace function public.claim_client_with_invitation(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_res jsonb; v_fallos int;
begin
  if v_uid is null then raise exception 'Hace falta una sesión' using errcode = '28000'; end if;
  delete from public.client_link_attempts where attempted_at < now() - interval '1 day';
  select count(*) into v_fallos from public.client_link_attempts a where a.actor_id = v_uid and a.attempted_at > now() - interval '1 hour';
  if v_fallos >= 10 then return jsonb_build_object('result', 'too_many_attempts'); end if;
  v_res := private.reclamar_con_invitacion(v_uid, p_token);
  if v_res ->> 'result' in ('invitation_invalid', 'invitation_revoked', 'invitation_used', 'invitation_expired', 'account_not_allowed', 'email_mismatch', 'ficha_already_linked') then
    insert into public.client_link_attempts (actor_id, outcome) values (v_uid, v_res ->> 'result');
  end if;
  return v_res;
end $$;

-- 6.4 Aprobar / rechazar una solicitud pendiente (solo el profesional dueño o un superadministrador).
create or replace function public.approve_client_link(p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_r record; v_c record; v_role text;
begin
  if auth.uid() is null then raise exception 'Hace falta una sesión' using errcode = '28000'; end if;
  select * into v_r from public.client_link_requests where id = p_request_id for update;
  if not found or not (v_r.nutricionista_id = auth.uid() or private.is_super_admin()) then raise exception 'No autorizado' using errcode = '42501'; end if;
  v_role := case when v_r.nutricionista_id = auth.uid() then 'professional' else 'super_admin' end;
  if v_r.decision is not null then return jsonb_build_object('result', 'already_decided', 'decision', v_r.decision); end if;
  if v_r.expires_at <= now() then
    update public.client_link_requests set decision = 'expired', decided_at = now(), decision_reason = 'caducada' where id = v_r.id;
    return jsonb_build_object('result', 'request_expired');
  end if;
  select c.id, c.auth_user_id into v_c from public.clientes c where c.id = v_r.client_id for update;
  if not found or v_c.auth_user_id is not null then
    update public.client_link_requests set decision = 'cancelled', decided_at = now(), decided_by = auth.uid(), decision_reason = 'la ficha ya está vinculada' where id = v_r.id;
    return jsonb_build_object('result', 'ficha_already_linked');
  end if;
  if not exists (select 1 from auth.users u where u.id = v_r.requester_uid) then return jsonb_build_object('result', 'requester_not_found'); end if;
  if not private.email_confirmado_por_la_persona(v_r.requester_uid) then return jsonb_build_object('result', 'email_not_confirmed'); end if;
  update public.client_link_requests set decision = 'approved', decided_at = now(), decided_by = auth.uid() where id = v_r.id;
  perform private.contexto_vinculo('aprobacion_profesional', v_role, null, null);
  update public.clientes set auth_user_id = v_r.requester_uid where id = v_r.client_id;
  return jsonb_build_object('result', 'linked', 'client_id', v_r.client_id);
end $$;

create or replace function public.reject_client_link(p_request_id uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_r record; v_role text;
begin
  if auth.uid() is null then raise exception 'Hace falta una sesión' using errcode = '28000'; end if;
  select * into v_r from public.client_link_requests where id = p_request_id for update;
  if not found or not (v_r.nutricionista_id = auth.uid() or private.is_super_admin()) then raise exception 'No autorizado' using errcode = '42501'; end if;
  v_role := case when v_r.nutricionista_id = auth.uid() then 'professional' else 'super_admin' end;
  if v_r.decision is not null then return jsonb_build_object('result', 'already_decided', 'decision', v_r.decision); end if;
  update public.client_link_requests set decision = 'rejected', decided_at = now(), decided_by = auth.uid(), decision_reason = left(p_reason, 300) where id = v_r.id;
  perform private.registrar_evento_vinculo('link_rejected', v_r.nutricionista_id, v_r.client_id, auth.uid(), v_role, null, v_r.requester_uid, 'rechazo_profesional', p_reason, null);
  return jsonb_build_object('result', 'rejected');
end $$;

-- 6.5 Desvincular la cuenta de una ficha. ATÓMICA: en la misma transacción se retira el acceso (auth_user_id), se revocan las invitaciones activas, se
-- cancelan las solicitudes pendientes, se borran las suscripciones push del titular anterior y se rota el token de la ficha. El acceso a las 18 tablas
-- de datos del cliente desaparece al instante porque depende de auth_user_id (RLS se evalúa en cada consulta).
create or replace function public.unlink_client_account(p_client_id uuid, p_reason text default null, p_impersonation boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_c record; v_role text; v_rev record; v_since timestamptz; v_invalidated boolean := false;
begin
  if auth.uid() is null then raise exception 'Hace falta una sesión' using errcode = '28000'; end if;
  select c.id, c.nutricionista_id, c.auth_user_id, c.consent_accepted_at, c.consent_invalidated_at into v_c from public.clientes c where c.id = p_client_id for update;
  if not found or not (v_c.nutricionista_id = auth.uid() or private.is_super_admin()) then raise exception 'No autorizado' using errcode = '42501'; end if;
  v_role := case when v_c.nutricionista_id = auth.uid() then 'professional' else 'super_admin' end;
  if v_c.auth_user_id is null then return jsonb_build_object('result', 'not_linked'); end if;
  if v_c.auth_user_id = v_c.nutricionista_id then raise exception 'Las fichas del modo personal no se desvinculan' using errcode = '55000'; end if;
  for v_rev in update public.client_invitations set revoked_at = now(), revoked_reason = 'desvinculacion' where client_id = p_client_id and consumed_at is null and revoked_at is null returning id, expires_at loop
    if v_rev.expires_at > now() then
      perform private.registrar_evento_vinculo('invitation_revoked', v_c.nutricionista_id, p_client_id, auth.uid(), v_role, null, null, 'desvinculacion', null, v_rev.id);
    end if;
  end loop;
  update public.client_link_requests set decision = 'cancelled', decided_at = now(), decided_by = auth.uid(), decision_reason = 'desvinculación' where client_id = p_client_id and decision is null;
  delete from public.push_subscriptions where client_id = p_client_id;
  -- Suplantación: se cuestiona SOLO el consentimiento firmado mientras la cuenta anterior era la titular (accept_consent exige ser la titular al firmar).
  -- Inicio de esa titularidad = su último evento de vinculación; en las fichas vinculadas antes de este registro (migracion_inicial) no se conoce: se toma desde siempre.
  -- Un consentimiento anterior (de otra cuenta) o ya cuestionado NO se toca. El original (fecha y nombre firmados) se conserva intacto.
  if p_impersonation and v_c.consent_accepted_at is not null and (v_c.consent_invalidated_at is null or v_c.consent_invalidated_at < v_c.consent_accepted_at) then
    select coalesce(max(case when e.method = 'migracion_inicial' then '-infinity'::timestamptz else e.occurred_at end), '-infinity'::timestamptz) into v_since
      from public.client_link_events e where e.client_id = p_client_id and e.event in ('linked', 'reassigned') and e.new_uid = v_c.auth_user_id;
    if v_c.consent_accepted_at >= v_since then
      update public.clientes set consent_invalidated_at = now() where id = p_client_id;
      perform private.registrar_evento_vinculo('consent_invalidated', v_c.nutricionista_id, p_client_id, auth.uid(), v_role, v_c.auth_user_id, null, 'suplantacion', p_reason, null);
      v_invalidated := true;
    end if;
  end if;
  perform private.contexto_vinculo('desvinculacion_profesional', v_role, p_reason, null);
  update public.clientes set auth_user_id = null, token = private.token_nuevo() where id = p_client_id;
  return jsonb_build_object('result', 'unlinked', 'consent_invalidated', v_invalidated);
end $$;

-- 6.6 Estado de una ficha por su token (sustituye, para la aplicación nueva, a get_client_auth_status_by_token: NO revela el uid del titular).
create or replace function public.get_client_link_state(p_token text)
returns table(id uuid, name text, surname text, claimed boolean, is_mine boolean, consent_accepted_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.surname, c.auth_user_id is not null, coalesce(c.auth_user_id = auth.uid(), false),
         case when c.consent_invalidated_at is null or c.consent_accepted_at > c.consent_invalidated_at then c.consent_accepted_at end
  from public.clientes c where c.token = p_token limit 1;
$$;

-- La RPC antigua (compatibilidad hasta 0079) misma firma y columnas, pero con el consentimiento EFECTIVO: un consentimiento cuestionado no cuenta como firmado.
create or replace function public.get_client_auth_status_by_token(p_token text)
returns table(id uuid, name text, surname text, auth_user_id uuid, consent_accepted_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select id, name, surname, auth_user_id,
         case when consent_invalidated_at is null or consent_accepted_at > consent_invalidated_at then consent_accepted_at end
  from clientes where token = p_token limit 1;
$$;

-- 6.7 Solicitudes de vinculación de la cuenta que llama (para que la clienta vea «pendiente de aprobación» al volver).
create or replace function public.get_my_link_requests()
returns table(request_id uuid, client_first_name text, display_name text, decision text, created_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, split_part(btrim(c.name), ' ', 1), n.display_name, r.decision, r.created_at, r.expires_at
  from public.client_link_requests r join public.clientes c on c.id = r.client_id join public.nutricionistas n on n.uid = r.nutricionista_id
  where r.requester_uid = auth.uid() order by r.created_at desc limit 5;
$$;

-- 6.8 Purga por retención. NO se programa: el plazo está PENDIENTE DE VALIDACIÓN JURÍDICA (los 24 meses de este valor por defecto son solo un punto de partida, no una obligación legal
-- identificada). Solo service_role / propietario.
-- Borra los eventos de las fichas SIN titular actual cuya última actividad es anterior al plazo y que tuvieron alguna desvinculación o fueron eliminadas.
create or replace function public.purge_client_link_events(p_retencion interval default interval '24 months') returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_n bigint;
begin
  perform set_config('nutrifit.purga', 'on', true);
  with candidatas as (
    select e.client_id from public.client_link_events e group by e.client_id
    having max(e.occurred_at) < now() - p_retencion and bool_or(e.event = 'unlinked')
       and not exists (select 1 from public.clientes c where c.id = e.client_id and c.auth_user_id is not null)
  ), borradas as (
    delete from public.client_link_events where client_id in (select client_id from candidatas) returning 1
  ) select count(*) into v_n from borradas;
  perform set_config('nutrifit.purga', '', true);
  return v_n;
end $$;

-- 6.9 Bandeja de avisos con arrendamiento. take_link_notifications reserva (5 min) hasta p_limit avisos pendientes y cuenta el intento; si quien los envía se cae, el
-- aviso vuelve a estar disponible al caducar la reserva (máximo 5 intentos). finish_link_notification marca enviado o anota el error. Dos ejecuciones simultáneas
-- nunca reciben el mismo aviso (FOR UPDATE SKIP LOCKED). Solo service_role.
create or replace function public.take_link_notifications(p_limit int default 50) returns setof public.client_link_notifications
language sql security definer set search_path = '' as $$
  update public.client_link_notifications n set locked_until = now() + interval '5 minutes', attempts = n.attempts + 1
  where n.id in (
    select x.id from public.client_link_notifications x
    where x.sent_at is null and x.attempts < 5 and (x.locked_until is null or x.locked_until < now())
    order by x.id limit greatest(1, least(coalesce(p_limit, 50), 200)) for update skip locked)
  returning n.*;
$$;
create or replace function public.finish_link_notification(p_id bigint, p_sent boolean, p_error text default null) returns void
language sql security definer set search_path = '' as $$
  update public.client_link_notifications
  set sent_at = case when p_sent then now() else sent_at end, last_error = left(p_error, 200), locked_until = null
  where id = p_id and sent_at is null;
$$;

-- 7. Permisos de ejecución (los privilegios por defecto de Supabase darían EXECUTE a anon: se retira explícitamente) -----------------------------
revoke all on function private.normalizar_email(text), private.hash_token(text), private.token_nuevo(), private.email_confirmado_por_la_persona(uuid),
  private.eventos_vinculo_solo_insercion(), private.registrar_evento_vinculo(text, uuid, uuid, uuid, text, uuid, uuid, text, text, uuid),
  private.contexto_vinculo(text, text, text, uuid), private.trg_registrar_vinculo(), private.reclamar_con_invitacion(uuid, text) from public, anon, authenticated;
revoke all on function public.create_client_invitation(uuid), public.claim_client_with_invitation(text), public.approve_client_link(uuid),
  public.reject_client_link(uuid, text), public.unlink_client_account(uuid, text, boolean), public.get_my_link_requests(), public.purge_client_link_events(interval),
  public.take_link_notifications(int), public.finish_link_notification(bigint, boolean, text) from public, anon;
revoke all on function public.get_invitation_status(text), public.get_client_link_state(text) from public;
grant execute on function public.create_client_invitation(uuid), public.claim_client_with_invitation(text), public.approve_client_link(uuid),
  public.reject_client_link(uuid, text), public.unlink_client_account(uuid, text, boolean), public.get_my_link_requests() to authenticated;
grant execute on function public.get_invitation_status(text), public.get_client_link_state(text) to anon, authenticated;
revoke all on function public.purge_client_link_events(interval), public.take_link_notifications(int), public.finish_link_notification(bigint, boolean, text) from authenticated;

-- 8. Línea base: una entrada por cada ficha ya vinculada (preexistente; este mecanismo no la verificó) --------------------------------------------
insert into public.client_link_events (event, nutricionista_id, client_id, actor_id, actor_role, previous_uid, new_uid, method, reason)
select 'linked', c.nutricionista_id, c.id, null, 'system', null, c.auth_user_id,
       case when c.auth_user_id = c.nutricionista_id then 'modo_personal' else 'migracion_inicial' end, 'línea base anterior a la auditoría de vinculación'
from public.clientes c where c.auth_user_id is not null;
