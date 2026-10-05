-- Revisión semanal sugerida (Centro de control): lo que el nutricionista decidió
-- hacer con la revisión de un cliente en una semana — aceptarla, editarla o
-- ignorarla. La revisión en sí se genera al vuelo (src/lib/weeklyReview.ts); aquí
-- solo se guarda la decisión y una instantánea de lo que se vio.
--
-- ES INTERNA DEL NUTRICIONISTA: no hay política de lectura para el cliente (a
-- diferencia de client_clinical_notes). Solo el nutricionista dueño de la ficha
-- o un super-admin pueden leer o escribir.
create table public.client_reviews (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clientes(id) on delete cascade,
  -- Lunes de la semana revisada. Una decisión por cliente y semana (se puede rehacer).
  week_start date not null,
  status text not null check (status in ('accepted', 'edited', 'ignored')),
  -- Instantánea de lo que mostraba la revisión (items con valores y tono).
  summary jsonb not null default '[]'::jsonb,
  -- Texto sugerido por el sistema y texto final del nutricionista (distinto si lo editó).
  suggestion text not null default '',
  note text not null default '',
  reviewed_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, week_start)
);

create index idx_client_reviews_week_start on public.client_reviews(week_start);

alter table public.client_reviews enable row level security;

create policy nutricionista_manages_client_reviews on public.client_reviews
  for all
  using (private.is_nutricionista_of_client(client_id) or private.is_super_admin())
  with check (private.is_nutricionista_of_client(client_id) or private.is_super_admin());
