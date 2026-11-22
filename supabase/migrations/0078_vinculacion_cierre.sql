-- VINCULACIÓN SEGURA DE CLIENTAS, parte 2 de 3 (CIERRE). PROPUESTA: no aplicada en ninguna base.
-- Requiere 0077 aplicada y la aplicación NUEVA desplegada y comprobada (la que genera invitaciones y usa claim_client_with_invitation).
--
-- Qué hace (cada punto cierra un bypass reproducido en src/lib/auditoriaAuthUserId.test.ts):
--  1. INVALIDA los tokens antiguos de las fichas SIN reclamar: se sustituyen por valores aleatorios que no conoce nadie. No se mantiene ninguno por
--     compatibilidad (criterio del responsable). Los enlaces ya enviados dejan de funcionar; el profesional genera uno nuevo (24 h, un uso) desde la ficha.
--     Las fichas ya vinculadas conservan su token: es solo el identificador con el que su titular abre su app y no sirve para reclamar nada.
--     (Esta es la única parte de la migración que modifica datos reales: columna token de las fichas con auth_user_id nulo. En producción, hoy, 7.)
--  2. AMPLÍA la protección de clientes (el trigger clientes_proteger_vinculo ya existe desde 0077 y bloquea auth_user_id, nutricionista_id, id y consent_invalidated_at): añade el
--     UPDATE directo de `token`, que hasta ahora seguía permitido solo porque la aplicación antigua regenera el enlace así. Mismo patrón que 0074: lista de permitidos por current_user
--     (postgres, supabase_admin, service_role), ENABLE ALWAYS. Todo cambio pasa por las funciones de 0077 (que corren como propietario) o por mantenimiento, y queda registrado.
--     OJO: no se tocan los privilegios de columna (a diferencia de 0074) para no obligar a conceder UPDATE en cada columna futura de clientes.
--  3. RETIRA la reclamación antigua: claim_client_by_token pasa a fallar con un mensaje claro. Una versión antigua de la aplicación que la llame verá el
--     error («Error al vincular cuenta…») en vez de un éxito silencioso, que es lo que ocurría.
--
-- NO retira todavía get_client_auth_status_by_token (la versión antigua la necesita para decidir entre registro e inicio de sesión): lo hace 0079.

-- 1. Tokens antiguos de fichas sin reclamar -----------------------------------------------------------------------------------------------------
update public.clientes set token = private.token_nuevo() where auth_user_id is null;

-- 2. Protección de clientes: el trigger de 0077 pasa a proteger también el token ----------------------------------------------------------------------
create or replace function private.clientes_proteger_vinculo() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then return new; end if;
  if tg_op = 'INSERT' then
    if new.auth_user_id is not null then raise exception 'Una ficha no se puede crear ya vinculada a una cuenta' using errcode = '42501'; end if;
    return new;
  end if;
  if new.auth_user_id is distinct from old.auth_user_id or new.nutricionista_id is distinct from old.nutricionista_id
     or new.token is distinct from old.token or new.id is distinct from old.id or new.consent_invalidated_at is distinct from old.consent_invalidated_at then
    raise exception 'auth_user_id, nutricionista_id, token, id y consent_invalidated_at no se modifican directamente: usa los procedimientos de vinculación' using errcode = '42501';
  end if;
  return new;
end $$;

-- 3. La reclamación antigua deja de existir como mecanismo ------------------------------------------------------------------------------------------
create or replace function public.claim_client_by_token(p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Esta versión de la aplicación ya no puede vincular cuentas. Recarga la página y pide a tu profesional un enlace nuevo.' using errcode = 'P0001';
end $$;
