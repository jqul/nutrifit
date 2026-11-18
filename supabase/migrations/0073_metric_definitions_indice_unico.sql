-- Arregla el error 400 al crear las medidas estándar (% de grasa, cintura, cadera, pecho, brazo, muslo).
--
-- Qué pasaba: la migración 0066 creó `uq_metric_definitions_key` como índice único PARCIAL
-- (nutricionista_id, key) WHERE key IS NOT NULL. La app crea las estándar con
--   supabase.from('metric_definitions').upsert(..., { onConflict: 'nutricionista_id,key', ignoreDuplicates: true })
-- que se traduce en `INSERT ... ON CONFLICT (nutricionista_id, key) DO NOTHING`. Postgres solo usa un índice parcial como
-- árbitro del ON CONFLICT si la sentencia repite su predicado (`WHERE key IS NOT NULL`), y PostgREST solo permite indicar
-- columnas, no un predicado. Resultado: error 42P10 («no unique or exclusion constraint matching the ON CONFLICT
-- specification»), que la API devuelve como 400, en cada apertura de la ficha. Las estándar nunca se llegaron a crear
-- (la tabla está vacía en producción) y el fallo no se veía porque la app no miraba el error.
--
-- Arreglo: un índice único NO parcial sobre las mismas columnas. No cambia lo que se permite:
--  · Las métricas propias llevan key NULL y siguen pudiendo ser tantas como se quiera, porque en un índice único los NULL
--    se consideran distintos entre sí (comportamiento por defecto de Postgres, NULLS DISTINCT).
--  · Para un mismo nutricionista y una misma key (no nula) sigue sin haber duplicados.
--
-- Primero se crea el nuevo y después se borra el parcial, para que en ningún momento falte la protección contra duplicados.
-- No toca datos, otras restricciones, políticas RLS ni relaciones (body_metrics sigue apuntando a metric_definitions(id)).
-- Reversión: crear de nuevo el parcial (create unique index uq_metric_definitions_key on public.metric_definitions
-- (nutricionista_id, key) where key is not null) y borrar el nuevo.
create unique index uq_metric_definitions_nutricionista_key on public.metric_definitions (nutricionista_id, key);

drop index public.uq_metric_definitions_key;
