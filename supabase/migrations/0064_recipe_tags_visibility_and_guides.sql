-- Más de Harbiz (ver replica/recon-harbiz.md):
--
-- 1. Visibilidad del libro de recetas por etiquetas de cliente: book_tags vacío = lo ven todos los clientes del
--    nutricionista (como hasta ahora); con etiquetas = solo los clientes que tengan alguna de ellas (por ejemplo, una
--    receta extra solo para los de «Deportista»). Las recetas del plan de un cliente las sigue viendo siempre.
-- 2. Datos de la receta: tipos de dieta (vegetariana, sin gluten…), tiempo de preparación y un vídeo opcional.
-- 3. Lo mismo para las guías: visible_tags vacío = todos; con etiquetas = solo los clientes con alguna de ellas.
--
-- La regla se cumple en la base de datos (políticas de lectura), no solo en la app: un cliente no ve por la API lo que no
-- le corresponde.
alter table public.recipes
  add column if not exists book_tags text[] not null default '{}',
  add column if not exists diet_types text[] not null default '{}',
  add column if not exists prep_minutes int check (prep_minutes > 0 and prep_minutes <= 1440),
  add column if not exists video_url text;

alter table public.guides add column if not exists visible_tags text[] not null default '{}';

create or replace function private.client_can_read_recipe(p_recipe_id uuid, p_nutricionista_id uuid, p_in_book boolean, p_book_tags text[])
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from clientes c
    where c.nutricionista_id = p_nutricionista_id
      and c.auth_user_id = auth.uid()
      and (
        (p_in_book and (cardinality(p_book_tags) = 0 or c.tags && p_book_tags))
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
  using (private.client_can_read_recipe(id, nutricionista_id, in_recipe_book, book_tags));

drop function if exists private.client_can_read_recipe(uuid, uuid, boolean);

create or replace function private.client_can_read_guide(p_nutricionista_id uuid, p_visible_tags text[])
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from clientes c
    where c.nutricionista_id = p_nutricionista_id
      and c.auth_user_id = auth.uid()
      and (cardinality(p_visible_tags) = 0 or c.tags && p_visible_tags)
  );
$$;

drop policy if exists client_reads_own_nutricionista_guides on public.guides;
create policy client_reads_own_nutricionista_guides on public.guides for select
  using (private.client_can_read_guide(nutricionista_id, visible_tags));
