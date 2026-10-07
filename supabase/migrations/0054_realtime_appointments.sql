-- Tiempo real para las citas.
--
-- La app llevaba tiempo suscrita a cambios en directo, pero la publicación supabase_realtime
-- estaba VACÍA: ninguna tabla emitía eventos, así que lo que pasaba en otro dispositivo (por
-- ejemplo, un cliente pidiendo cita) no llegaba al nutricionista hasta que cerraba y volvía a
-- abrir la app. Se añaden las citas. Realtime respeta las políticas de seguridad (RLS): cada
-- usuario solo recibe los eventos de las filas que ya puede leer.
--
-- No se añade `clientes` a propósito: la lista de clientes se suscribe a esa tabla y recargaría
-- 6 consultas con cada cambio; se hará con su propio ajuste (agrupando cambios).
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'appointments') then
    alter publication supabase_realtime add table public.appointments;
  end if;
end $$;
