-- Carb cycling: día ON (entrenamiento) / día OFF (descanso) — dos variantes
-- de una comida dentro del mismo plan, independiente del día de la semana
-- (day_of_week) porque el calendario de entreno real de un cliente no
-- siempre sigue un patrón semanal fijo. El cliente decide cada día qué tipo
-- de día es (ver localStorage del lado cliente, igual que las opciones
-- intercambiables). day_type null = aplica cualquier día (comportamiento
-- sin cambios para los planes ya creados).
alter table diet_meals add column day_type text check (day_type in ('on', 'off'));
