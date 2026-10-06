-- Dar de baja a un cliente: se va de la consulta, pero NO se borra nada.
--
-- Hasta ahora la única forma de "quitarse de encima" a un cliente que se iba era
-- eliminarlo (con todos sus datos), así que NutriFit no sabía cuántos clientes se
-- daban de baja: la retención se estimaba por actividad. Con estas columnas la
-- baja queda registrada (cuándo y por qué) y es reversible: el cliente deja de
-- salir en la lista, el Centro de control, los avisos y los recordatorios, pero
-- conserva su historial y se puede reactivar.
--
-- No se toca ninguna política: son columnas de `clientes`, que ya solo lee y
-- escribe el nutricionista (0044). La ficha que ve el propio cliente
-- (get_my_client_profile) lista sus columnas una a una, así que no las recibe.

alter table public.clientes
  add column if not exists baja_at timestamptz,
  add column if not exists baja_reason text,
  add column if not exists baja_note text;

alter table public.clientes drop constraint if exists clientes_baja_reason_valid;
alter table public.clientes add constraint clientes_baja_reason_valid
  check (baja_reason is null or baja_reason in ('precio', 'resultados', 'falta_tiempo', 'objetivo_logrado', 'otro'));

-- Motivo y nota solo tienen sentido si el cliente está de baja.
alter table public.clientes drop constraint if exists clientes_baja_consistent;
alter table public.clientes add constraint clientes_baja_consistent
  check (baja_at is not null or (baja_reason is null and baja_note is null));

create index if not exists idx_clientes_nutricionista_baja on public.clientes (nutricionista_id) where baja_at is not null;
