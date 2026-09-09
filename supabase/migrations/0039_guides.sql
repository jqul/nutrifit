-- Biblioteca de guías y recursos educativos: el nutricionista escribe
-- pequeñas guías (texto libre, sin formato — se muestra tal cual con saltos
-- de línea, igual que plan.advice) que TODOS sus clientes ven en su propia
-- app ("Más" → Guías) — es contenido del nutricionista, no de un cliente
-- concreto, así que no hace falta ninguna tabla de asignación: cualquier
-- cliente de este nutricionista las lee todas. Mismo patrón de RLS que
-- recipes (0008/0028): el nutricionista gestiona las suyas, sus clientes
-- solo leen.
create table guides (
  id uuid primary key default gen_random_uuid(),
  nutricionista_id uuid not null references nutricionistas(uid) on delete cascade,
  title text not null,
  emoji text not null default '📄',
  body text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_guides_nutricionista_id on guides(nutricionista_id);

alter table guides enable row level security;

create policy nutricionista_owns_guides on guides for all
  using (nutricionista_id = (select auth.uid()) or private.is_super_admin())
  with check (nutricionista_id = (select auth.uid()) or private.is_super_admin());
create policy client_reads_own_nutricionista_guides on guides for select
  using (private.is_client_of_nutricionista(nutricionista_id));
