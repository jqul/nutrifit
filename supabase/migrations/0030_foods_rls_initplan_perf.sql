-- Encontrado en una revisión completa vía el advisor de rendimiento de
-- Supabase (no algo introducido en esta sesión): las 4 políticas RLS de
-- `foods` (0018_custom_foods_and_catalog_expansion.sql) usaban
-- auth.uid() directo en vez de (select auth.uid()) — Postgres las
-- reevalúa fila a fila en vez de una sola vez por consulta. Sin cambio
-- de comportamiento, solo de rendimiento a escala.
drop policy if exists foods_read_own_and_system on foods;
create policy foods_read_own_and_system on foods for select
  using (nutricionista_id is null or nutricionista_id = (select auth.uid()) or private.is_super_admin());

drop policy if exists foods_insert_own on foods;
create policy foods_insert_own on foods for insert
  with check (nutricionista_id = (select auth.uid()));

drop policy if exists foods_update_own on foods;
create policy foods_update_own on foods for update
  using (nutricionista_id = (select auth.uid()))
  with check (nutricionista_id = (select auth.uid()));

drop policy if exists foods_delete_own on foods;
create policy foods_delete_own on foods for delete
  using (nutricionista_id = (select auth.uid()));

-- También detectado por el advisor: diet_meal_items.recipe_id no tenía
-- índice propio (el recetario dinámico y el "Ver receta" del cliente
-- filtran por recipeId).
create index if not exists idx_diet_meal_items_recipe_id on diet_meal_items(recipe_id);
