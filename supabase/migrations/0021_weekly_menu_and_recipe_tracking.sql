-- Cuadrante semanal: cada comida puede pertenecer a un día concreto de la
-- semana (0=lunes ... 6=domingo) o a ninguno en particular, en cuyo caso se
-- muestra todos los días — así los planes ya existentes (todas sus comidas
-- con day_of_week null) siguen funcionando exactamente igual que antes sin
-- necesidad de migrar datos.
alter table diet_meals add column day_of_week smallint;

-- Recetario dinámico: qué receta (si alguna) dio origen a los ingredientes
-- de un ítem, para poder filtrar el recetario en PDF a solo las recetas
-- realmente usadas en el plan actual, en vez de todas las guardadas.
-- on delete set null porque borrar la receta original no debe borrar el
-- ítem ya insertado en el plan del cliente.
alter table diet_meal_items add column recipe_id uuid references recipes(id) on delete set null;
