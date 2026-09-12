-- "¿Vas a comer fuera?" era contenido fijo (src/lib/eatingOutGuides.ts),
-- igual para todos los nutricionistas — pasa a ser editable por cada uno,
-- mismo patrón que guides (0039): el nutricionista gestiona las suyas,
-- cualquier cliente suyo las lee. tips es un array de líneas (jsonb) en
-- vez de un body libre, porque aquí sí tiene sentido una lista con
-- viñetas numeradas en vez de texto corrido.
--
-- Si el nutricionista nunca ha tocado esto (tabla vacía para su
-- nutricionista_id), el cliente sigue viendo el contenido genérico por
-- defecto de eatingOutGuides.ts — no se siembra nada automáticamente en
-- esta migración para no obligar a nadie a "empezar" con filas que no
-- pidió; el botón "Restaurar valores por defecto" del editor es quien
-- las crea si el nutricionista decide personalizar a partir de ahí.
create table eating_out_guides (
  id uuid primary key default gen_random_uuid(),
  nutricionista_id uuid not null references nutricionistas(uid) on delete cascade,
  emoji text not null default '🍽️',
  label text not null,
  tips jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_eating_out_guides_nutricionista_id on eating_out_guides(nutricionista_id);

alter table eating_out_guides enable row level security;

create policy nutricionista_owns_eating_out_guides on eating_out_guides for all
  using (nutricionista_id = (select auth.uid()) or private.is_super_admin())
  with check (nutricionista_id = (select auth.uid()) or private.is_super_admin());
create policy client_reads_own_nutricionista_eating_out_guides on eating_out_guides for select
  using (private.is_client_of_nutricionista(nutricionista_id));
