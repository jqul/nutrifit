-- El cliente no podía ver la receta (foto + pasos de preparación) de los
-- platos de su propio plan: la política de recipes solo dejaba leer al
-- nutricionista dueño o, si eran recetas del sistema, a cualquiera — pero
-- ninguna cubría "las recetas propias del nutricionista que le asignó el
-- plan a este cliente en concreto". Mismo helper que ya usa
-- nutricionista_owns_self para el caso simétrico (el cliente lee el
-- perfil de su propio nutricionista).
create policy client_reads_own_nutricionista_recipes on recipes for select
  using (private.is_client_of_nutricionista(nutricionista_id));
