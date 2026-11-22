import type { PGlite } from '@electric-sql/pglite'

// Réplica en PostgreSQL real (PGlite) del esquema de producción relevante para los permisos de `nutricionistas`, y ayudantes comunes
// de las pruebas de permisos (antes y después de las migraciones 0074/0075). Definiciones leídas de producción el 2026-11-20 con
// consultas de solo lectura. No incluye PostgREST ni Supabase Auth.

export const P = '00000000-0000-4000-8000-0000000000a1' // profesional P (trainer, sin aprobar, modo profesional)
export const Q = '00000000-0000-4000-8000-0000000000b1' // otro profesional Q (aprobado)
export const UC = '00000000-0000-4000-8000-0000000000c1' // usuario (auth) de la clienta C, ya vinculada a P
export const UD = '00000000-0000-4000-8000-0000000000d1' // usuario (auth) de la clienta D, vinculada a Q
export const UN = '00000000-0000-4000-8000-0000000000e1' // usuario que reclama una ficha sin dueño
export const ADM = '00000000-0000-4000-8000-0000000000ad' // superadministrador legítimo
export const PER = '00000000-0000-4000-8000-0000000000f0' // cuenta en modo personal (aprobada automáticamente, con su ficha propia)
export const FICHA_C = '00000000-0000-4000-8000-0000000000f1' // ficha de C (de P)
export const FICHA_U = '00000000-0000-4000-8000-0000000000f2' // ficha de P todavía sin reclamar
export const FICHA_D = '00000000-0000-4000-8000-0000000000f3' // ficha de D (de Q)
export const FICHA_PER = '00000000-0000-4000-8000-0000000000f4' // ficha propia de la cuenta personal
export const PLAN_C = '00000000-0000-4000-8000-000000000a01'
export const PLAN_D = '00000000-0000-4000-8000-000000000a02'

// Esquema: DDL, políticas, privilegios y funciones leídos de producción (proyecto de NutriFit) el 2026-11-20.
export const ESQUEMA = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  -- El usuario de conexión de PostgREST (authenticator) NO es superusuario: solo puede adoptar los roles de los que es miembro.
  create role authenticator noinherit nologin; grant anon, authenticated, service_role to authenticator;
  create schema auth; create schema private;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb, email_confirmed_at timestamptz, confirmation_sent_at timestamptz,
    is_anonymous boolean not null default false, created_at timestamptz not null default now());
  -- auth.uid() de Supabase: lee la reclamación «sub» del JWT.
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;

  create table public.nutricionistas (
    uid uuid primary key references auth.users(id) on delete cascade,
    email text not null, display_name text not null default '', approved boolean not null default false,
    role text not null default 'trainer', created_at timestamptz not null default now(),
    custom_anamnesis_questions jsonb not null default '[]'::jsonb, logo_url text, accent_color text, custom_domain text unique,
    contact_phone text, consent_document_url text, account_mode text not null default 'professional', app_name text,
    constraint nutricionistas_account_mode_check check (account_mode = any (array['professional','personal'])),
    constraint nutricionistas_role_check check (role = any (array['trainer','super_admin']))
  );
  create table public.clientes (
    id uuid primary key default gen_random_uuid(),
    nutricionista_id uuid not null references public.nutricionistas(uid) on delete cascade,
    token text not null unique, auth_user_id uuid references auth.users(id) on delete set null,
    name text not null, email text
  );
  create table public.anamnesis (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null unique references public.clientes(id) on delete cascade,
    answers jsonb not null default '{}'::jsonb, completed_at timestamptz, updated_at timestamptz not null default now()
  );
  create table public.diet_plans (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references public.clientes(id) on delete cascade,
    nutricionista_id uuid not null references public.nutricionistas(uid) on delete cascade,
    name text, kcal_target numeric
  );
  create table public.diet_plan_versions (
    id uuid primary key default gen_random_uuid(),
    plan_id uuid not null references public.diet_plans(id) on delete cascade,
    client_id uuid not null references public.clientes(id) on delete cascade,
    version_number int not null, snapshot jsonb not null
  );
  create table public.diet_plan_changes (
    id uuid primary key default gen_random_uuid(),
    plan_id uuid not null references public.diet_plans(id) on delete cascade,
    client_id uuid not null references public.clientes(id) on delete cascade,
    changes jsonb not null
  );

  create function private.is_super_admin() returns boolean language sql stable security definer set search_path to 'public'
    as $$ select exists (select 1 from nutricionistas where uid = auth.uid() and role = 'super_admin'); $$;
  create function private.is_nutricionista_of_client(p_client_id uuid) returns boolean language sql stable security definer set search_path to 'public'
    as $$ select exists (select 1 from clientes where id = p_client_id and nutricionista_id = auth.uid()); $$;
  create function private.is_client_of_nutricionista(p_uid uuid) returns boolean language sql stable security definer set search_path to 'public'
    as $$ select exists (select 1 from clientes where nutricionista_id = p_uid and auth_user_id = auth.uid()); $$;
  create function private.is_owner_client(p_client_id uuid) returns boolean language sql stable security definer set search_path to 'public'
    as $$ select exists (select 1 from clientes where id = p_client_id and auth_user_id = auth.uid()); $$;

  create function public.claim_client_by_token(p_token text) returns void language plpgsql security definer set search_path to 'public'
    as $$ begin update clientes set auth_user_id = auth.uid() where token = p_token and auth_user_id is null; end; $$;
  create function public.handle_new_nutricionista() returns trigger language plpgsql security definer set search_path to 'public' as $$
    declare v_mode text; v_name text;
    begin
      if new.raw_user_meta_data->>'signup_type' = 'nutricionista' then
        v_mode := coalesce(new.raw_user_meta_data->>'account_mode', 'professional');
        v_name := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1));
        insert into public.nutricionistas (uid, email, display_name, approved, role, account_mode, created_at)
        values (new.id, new.email, v_name, v_mode = 'personal', 'trainer', v_mode, now()) on conflict (uid) do nothing;
        if v_mode = 'personal' then
          insert into public.clientes (nutricionista_id, token, auth_user_id, name, email)
          values (new.id, replace(gen_random_uuid()::text, '-', ''), new.id, v_name, new.email);
        end if;
      end if;
      return new;
    end; $$;
  create trigger on_auth_user_created_nutricionista after insert on auth.users for each row execute function public.handle_new_nutricionista();

  alter table public.nutricionistas enable row level security;
  alter table public.clientes enable row level security;
  alter table public.anamnesis enable row level security;
  alter table public.diet_plans enable row level security;
  alter table public.diet_plan_versions enable row level security;
  alter table public.diet_plan_changes enable row level security;

  create policy nutricionista_owns_self on public.nutricionistas for all
    using ((uid = (select auth.uid())) or private.is_client_of_nutricionista(uid) or private.is_super_admin())
    with check ((uid = (select auth.uid())) or private.is_super_admin());
  create policy nutricionista_owns_clientes on public.clientes for all
    using ((nutricionista_id = (select auth.uid())) or private.is_super_admin())
    with check ((nutricionista_id = (select auth.uid())) or private.is_super_admin());
  create policy client_manages_own_anamnesis on public.anamnesis for all
    using (private.is_owner_client(client_id)) with check (private.is_owner_client(client_id));
  create policy nutricionista_reads_anamnesis on public.anamnesis for select
    using (private.is_nutricionista_of_client(client_id) or private.is_super_admin());
  create policy nutricionista_manages_diet_plans on public.diet_plans for all
    using (private.is_nutricionista_of_client(client_id) or private.is_super_admin())
    with check (private.is_nutricionista_of_client(client_id) or private.is_super_admin());
  create policy client_reads_diet_plans on public.diet_plans for select using (private.is_owner_client(client_id));
  create policy nutricionista_reads_diet_plan_versions on public.diet_plan_versions for select
    using (private.is_nutricionista_of_client(client_id) or private.is_super_admin());
  create policy nutricionista_reads_diet_plan_changes on public.diet_plan_changes for select
    using (private.is_nutricionista_of_client(client_id) or private.is_super_admin());

  -- Privilegios como en producción: anon, authenticated y service_role tienen todos los privilegios de tabla (arwdDxtm).
  grant usage on schema public, private, auth to anon, authenticated, service_role;
  grant all on all tables in schema public to anon, authenticated, service_role;
  grant execute on all functions in schema public, private, auth to anon, authenticated, service_role;

  -- Como en producción: auth.users es de supabase_auth_admin (no superusuario) y las funciones NUEVAS de postgres en public nacen ejecutables por
  -- anon, authenticated y service_role (ALTER DEFAULT PRIVILEGES de Supabase; PUBLIC ya tiene EXECUTE por defecto). private no tiene esa regla.
  create role supabase_auth_admin nologin;
  alter schema auth owner to supabase_auth_admin;
  alter table auth.users owner to supabase_auth_admin;
  alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, service_role;
  -- Y las tablas NUEVAS de postgres en public nacen con todos los privilegios para anon, authenticated y service_role (ALTER DEFAULT PRIVILEGES de Supabase).
  alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
`

export const SEMILLA = `
  insert into auth.users (id, email) values
    ('${P}', 'p@prueba.invalid'), ('${Q}', 'q@prueba.invalid'), ('${UC}', 'c@prueba.invalid'),
    ('${UD}', 'd@prueba.invalid'), ('${UN}', 'n@prueba.invalid');
  insert into public.nutricionistas (uid, email, display_name, approved, role, custom_anamnesis_questions) values
    ('${P}', 'p@prueba.invalid', 'Profesional P', false, 'trainer', '[{"id":"q1","label":"¿Pregunta de P?"}]'),
    ('${Q}', 'q@prueba.invalid', 'Profesional Q', true, 'trainer', '[]');
  insert into public.clientes (id, nutricionista_id, token, auth_user_id, name) values
    ('${FICHA_C}', '${P}', 'tokC', '${UC}', 'Clienta C'),
    ('${FICHA_U}', '${P}', 'tokU', null, 'Ficha sin reclamar'),
    ('${FICHA_D}', '${Q}', 'tokD', '${UD}', 'Clienta D');
  insert into public.diet_plans (id, client_id, nutricionista_id, name, kcal_target) values
    ('${PLAN_C}', '${FICHA_C}', '${P}', 'Plan C', 1800), ('${PLAN_D}', '${FICHA_D}', '${Q}', 'Plan D', 2000);
  insert into public.diet_plan_versions (plan_id, client_id, version_number, snapshot) values
    ('${PLAN_C}', '${FICHA_C}', 1, '{}'), ('${PLAN_D}', '${FICHA_D}', 1, '{}');
  insert into public.diet_plan_changes (plan_id, client_id, changes) values
    ('${PLAN_C}', '${FICHA_C}', '[]'), ('${PLAN_D}', '${FICHA_D}', '[]');
  insert into public.anamnesis (client_id, answers) values ('${FICHA_D}', '{"embarazo_lactancia":"Embarazo"}');
`

export type Intento = { ok: true; rows: Record<string, unknown>[] } | { ok: false; error: string }

/** Ayudantes ligados a una base. `getDb` se evalúa en cada uso (la base se crea en un beforeAll). */
export function entorno(getDb: () => PGlite) {
  /** Una prueba corre dentro de una transacción que siempre se deshace: ninguna prueba deja rastro en la siguiente. */
  const aislada = (fn: () => Promise<void>) => async () => {
    const db = getDb()
    // Tras un fallo dentro de un savepoint, PGlite puede dejar la autorización de sesión de la prueba anterior: se fija siempre al empezar.
    await db.exec('set session authorization postgres')
    await db.exec('begin')
    try { await db.exec(SEMILLA); await fn() } finally { await db.exec('rollback'); await db.exec('set session authorization postgres') }
  }
  /** Ejecuta `fn` como un usuario de la API de datos (rol de la base + `sub` del JWT). `uid = null` es el rol anónimo sin sesión. */
  async function como<T>(rol: string, uid: string | null, fn: () => Promise<T>): Promise<T> {
    const db = getDb()
    // Como PostgREST: la conexión es del usuario authenticator (sin privilegios propios) y adopta el rol del JWT con SET ROLE.
    await db.exec(`set local session authorization authenticator; set local role ${rol}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', true)`)
    try { return await fn() } finally { await db.exec(`reset role; set local session authorization postgres; select set_config('request.jwt.claim.sub', '', true)`) }
  }
  /** Una sentencia que puede fallar sin abortar la transacción de la prueba. */
  async function intentar(sql: string, params: unknown[] = []): Promise<Intento> {
    const db = getDb()
    await db.exec('savepoint intento')
    try { const r = await db.query<Record<string, unknown>>(sql, params); await db.exec('release intento'); return { ok: true, rows: r.rows } }
    catch (e) { await db.exec('rollback to intento'); return { ok: false, error: (e as Error).message } }
  }
  const filas = async (sql: string) => (await getDb().query<Record<string, unknown>>(sql)).rows // como propietario de la base (sin RLS)
  const cuenta = async (tabla: string, donde = 'true') => Number((await filas(`select count(*)::int n from public.${tabla} where ${donde}`))[0].n)
  return { aislada, como, intentar, filas, cuenta }
}

/** Partes de producción que usan las pruebas de vinculación de clientas (leídas el 2026-11-21): columnas de consentimiento, pesos, access_log y las RPC antiguas por token. */
export const EXTENSION_CLIENTE = `
  alter table public.clientes add column consent_accepted_at timestamptz, add column consent_signed_name text, add column surname text not null default '';
  create table public.weight_logs (id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clientes(id) on delete cascade,
    weight_kg numeric not null, logged_at timestamptz not null default now());
  create table public.access_log (id bigint generated always as identity primary key, nutricionista_id uuid, actor_id uuid, actor_name text,
    client_id uuid, action text, created_at timestamptz not null default now());
  create table public.push_subscriptions (id uuid primary key default gen_random_uuid(), nutricionista_id uuid references public.nutricionistas(uid) on delete cascade,
    client_id uuid references public.clientes(id) on delete cascade, endpoint text not null, p256dh text not null, auth text not null);
  alter table public.weight_logs enable row level security;
  alter table public.access_log enable row level security;
  alter table public.push_subscriptions enable row level security;
  create policy client_manages_weight_logs on public.weight_logs for all using (private.is_owner_client(client_id)) with check (private.is_owner_client(client_id));
  create policy nutricionista_reads_weight_logs on public.weight_logs for select using (private.is_nutricionista_of_client(client_id) or private.is_super_admin());
  create policy nutricionista_reads_access_log on public.access_log for select using ((nutricionista_id = (select auth.uid())) or private.is_super_admin());
  create policy client_manages_own_push_subscriptions on public.push_subscriptions for all using (client_id is not null and private.is_owner_client(client_id)) with check (client_id is not null and private.is_owner_client(client_id));

  create function public.get_client_auth_status_by_token(p_token text)
    returns table(id uuid, name text, surname text, auth_user_id uuid, consent_accepted_at timestamptz) language sql stable security definer set search_path to 'public' as $$
    select id, name, surname, auth_user_id, consent_accepted_at from clientes where token = p_token limit 1; $$;
  create function public.accept_consent(p_token text, p_signed_name text) returns void language plpgsql security definer set search_path to 'public' as $$
    begin update clientes set consent_accepted_at = now(), consent_signed_name = p_signed_name where token = p_token and auth_user_id = auth.uid(); end; $$;
  create function public.get_my_client_token() returns text language sql stable security definer set search_path to 'public' as $$
    select c.token from public.clientes c where c.auth_user_id = auth.uid() order by c.id desc limit 1; $$;
  revoke all on function public.get_my_client_token() from public, anon;
  create function public.log_client_access(p_client_id uuid, p_action text) returns void language plpgsql security definer set search_path to 'public' as $$
    declare v_owner uuid; v_name text;
    begin
      if p_action not in ('ficha', 'exportacion', 'informe') then raise exception 'Acción no válida'; end if;
      if auth.uid() is null then raise exception 'No autorizado'; end if;
      select nutricionista_id into v_owner from public.clientes where id = p_client_id;
      if v_owner is null or not (private.is_nutricionista_of_client(p_client_id) or private.is_super_admin()) then raise exception 'No autorizado'; end if;
      select coalesce(display_name, '') into v_name from public.nutricionistas where uid = auth.uid();
      insert into public.access_log (nutricionista_id, actor_id, actor_name, client_id, action) values (v_owner, auth.uid(), coalesce(v_name, ''), p_client_id, p_action);
    end; $$;
  create function public.get_nutricionista_branding_by_token(p_token text)
    returns table(display_name text, logo_url text, accent_color text, contact_phone text, consent_document_url text, app_name text) language sql stable security definer set search_path to 'public' as $$
    select n.display_name, n.logo_url, n.accent_color, n.contact_phone, n.consent_document_url, n.app_name from clientes c join nutricionistas n on n.uid = c.nutricionista_id where c.token = p_token limit 1; $$;
  grant all on public.weight_logs, public.access_log, public.push_subscriptions to anon, authenticated, service_role;
`
