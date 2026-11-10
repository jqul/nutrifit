-- Pasos del día en el check-in (idea de la conversación sobre MacroFactor, ver replica/recon-macrofactor.md).
--
-- Una app web no puede leer los pasos del móvil ni del reloj, así que el cliente los apunta a mano en su check-in diario
-- (los copia de la app de Salud en unos segundos). Es un dato informativo para el nutricionista (media de 7 y 30 días y
-- tendencia): ni se compara con un objetivo ni cuenta para la adherencia.
--
-- Solo se añade una columna opcional. Las políticas que ya existen no cambian: el cliente escribe su propia fila
-- (client_manages_daily_checkins) y su nutricionista la lee (nutricionista_reads_daily_checkins).
alter table public.daily_checkins add column if not exists steps integer
  check (steps is null or (steps >= 0 and steps <= 100000));
