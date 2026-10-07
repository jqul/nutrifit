-- Qué opción del plan eligió el cliente al marcar una comida como hecha.
--
-- Un plan puede tener opciones intercambiables (Comida: opción A / B / C) y días de entrenamiento o descanso, y la
-- elección del cliente solo vivía en su móvil: el nutricionista no podía saber cuántas kcal contaba de verdad una comida
-- "hecha". Al marcarla, el cliente guarda ahora la opción y una copia de lo que aportaba (kcal y macros del plan en ese
-- momento), así el balance del día es exacto aunque después se edite el plan. Todo es opcional: los registros antiguos y
-- los productos escaneados no lo llevan.
alter table public.meal_logs
  add column if not exists option_label text,
  add column if not exists planned_kcal numeric check (planned_kcal is null or planned_kcal >= 0),
  add column if not exists planned_protein_g numeric check (planned_protein_g is null or planned_protein_g >= 0),
  add column if not exists planned_carbs_g numeric check (planned_carbs_g is null or planned_carbs_g >= 0),
  add column if not exists planned_fat_g numeric check (planned_fat_g is null or planned_fat_g >= 0);
