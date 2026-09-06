-- Marca cuándo fue la última vez que el nutricionista revisó la ficha de
-- un cliente (SeguimientoTab) — permite detectar "hay un check-in o
-- encuesta más reciente que la última revisión" para el semáforo de salud
-- del dashboard (ver src/lib/clientHealth.ts), sin necesitar una tabla de
-- notificaciones aparte.
alter table clientes add column if not exists last_reviewed_at timestamptz;

-- NOTA: esta migración no se ha podido aplicar a la base de datos real en
-- esta sesión (sin conector de Supabase disponible) — aplícala junto con
-- el resto de cambios pendientes (0033 y esta) desde el SQL Editor del
-- dashboard o `supabase db push`.
