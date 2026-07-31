-- Recetario: el nutricionista guarda una comida ya montada (lista de alimentos)
-- como receta reutilizable e insertable en cualquier plan de cualquier cliente.

create table recipes (
  id uuid primary key default gen_random_uuid(),
  nutricionista_id uuid not null references nutricionistas(uid) on delete cascade,
  name text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_recipes_nutricionista_id on recipes(nutricionista_id);

alter table recipes enable row level security;
create policy nutricionista_owns_recipes on recipes for all
  using (nutricionista_id = (select auth.uid()) or private.is_super_admin())
  with check (nutricionista_id = (select auth.uid()) or private.is_super_admin());
