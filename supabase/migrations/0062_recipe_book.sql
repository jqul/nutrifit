-- Recetas con datos para buscarlas, y un «libro de recetas» para los clientes.
--
-- 1. meal_type y tags: para encontrar una receta entre muchas (por tipo de comida y por etiquetas libres) y para que
--    «proponer menú» sepa qué receta va en cada comida.
-- 2. in_recipe_book: el nutricionista decide qué recetas puede ver el cliente por su cuenta, aunque no estén en su plan.
--
-- Hasta ahora la política client_reads_own_nutricionista_recipes (0028) dejaba a cualquier cliente leer TODAS las recetas
-- de su nutricionista si consultaba la API directamente (la app solo enseñaba las de su plan). Con un libro de recetas que
-- el nutricionista controla, eso tiene que cumplirse de verdad: el cliente lee una receta solo si está en su libro o si
-- está en su plan activo. Las recetas del sistema siguen siendo de lectura pública (todos_leen_recetas_del_sistema).
alter table public.recipes
  add column if not exists meal_type text check (meal_type in ('desayuno', 'comida', 'merienda', 'cena', 'snack')),
  add column if not exists tags text[] not null default '{}',
  add column if not exists in_recipe_book boolean not null default false;

create index if not exists idx_recipes_in_recipe_book on public.recipes (nutricionista_id) where in_recipe_book;

-- ¿Puede el usuario con sesión (un cliente) leer esta receta de su nutricionista? SECURITY DEFINER para consultar los
-- planes sin que sus propias políticas intervengan.
create or replace function private.client_can_read_recipe(p_recipe_id uuid, p_nutricionista_id uuid, p_in_book boolean)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from clientes c
    where c.nutricionista_id = p_nutricionista_id
      and c.auth_user_id = auth.uid()
      and (
        p_in_book
        or exists (
          select 1 from diet_meal_items i
          join diet_meals m on m.id = i.meal_id
          join diet_plans p on p.id = m.plan_id
          where i.recipe_id = p_recipe_id and p.client_id = c.id and p.is_active
        )
      )
  );
$$;

drop policy if exists client_reads_own_nutricionista_recipes on public.recipes;
create policy client_reads_own_nutricionista_recipes on public.recipes for select
  using (private.client_can_read_recipe(id, nutricionista_id, in_recipe_book));
