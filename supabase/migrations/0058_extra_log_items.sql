-- Las comidas fuera del plan ("extras") guardaban sus macros como una frase
-- formateada dentro de meal_logs.note ("150 g · 212 kcal · P 12 g · C 8 g · G
-- 14 g (producto escaneado…"), que scannedLogs.ts vuelve a parsear con una
-- regex. Eso aguanta un producto escaneado por entrada, pero no una comida
-- con varios ingredientes (lo que exige ExtrasQuickLogSheet: varios alimentos
-- del catálogo a la vez, ver replica/architecture.md). Esta tabla guarda los
-- extras como datos: una fila por ingrediente, con sus propios gramos y
-- macros. meal_logs no cambia — las comidas del plan marcadas como hechas
-- siguen igual; los registros de extras ya guardados en note siguen
-- leyéndose como hasta ahora (no se migran, scannedLogs.ts sigue soportando
-- ambos formatos).
create table extra_log_items (
  id uuid primary key default gen_random_uuid(),
  meal_log_id uuid not null references meal_logs(id) on delete cascade,
  -- Duplicado desde meal_logs.client_id a propósito: así las políticas RLS
  -- reutilizan private.is_owner_client / is_nutricionista_of_client igual
  -- que el resto de tablas, sin una subconsulta a meal_logs en cada fila.
  client_id uuid not null references clientes(id) on delete cascade,
  -- El alimento real del catálogo del que viene esta fila. 'catalog' siempre
  -- lo lleva (ExtrasQuickLogSheet obliga a elegir uno); 'barcode' no, porque
  -- un producto de Open Food Facts no es una fila de `foods`.
  food_id uuid references foods(id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  grams numeric not null check (grams > 0 and grams <= 5000),
  kcal numeric not null check (kcal >= 0 and kcal <= 950 * 5),
  protein_g numeric not null check (protein_g >= 0 and protein_g <= 500),
  carbs_g numeric not null check (carbs_g >= 0 and carbs_g <= 500),
  fat_g numeric not null check (fat_g >= 0 and fat_g <= 500),
  source text not null check (source in ('barcode', 'catalog')),
  -- Sin usar por ahora (todo lo que entra aquí viene ya resuelto contra el
  -- catálogo o un escaneo real) — se deja por si en el futuro vuelve a hacer
  -- falta distinguir una fila sin confirmar de una ya revisada.
  is_estimate boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_extra_log_items_meal_log_id on extra_log_items(meal_log_id);
create index idx_extra_log_items_client_id on extra_log_items(client_id);
create index idx_extra_log_items_food_id on extra_log_items(food_id);

alter table extra_log_items enable row level security;

create policy nutricionista_reads_extra_log_items on extra_log_items for select
  using (private.is_nutricionista_of_client(client_id) or private.is_super_admin());
create policy client_manages_own_extra_log_items on extra_log_items for all
  using (private.is_owner_client(client_id))
  with check (private.is_owner_client(client_id));
