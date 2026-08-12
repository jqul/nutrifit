-- Encuestas personalizadas recurrentes (semanales o mensuales) definidas por
-- el nutricionista, con historial completo de respuestas por cliente y periodo.
-- Distinto del cuestionario de anamnesis (0009): ese es fijo y de una sola vez
-- al alta; esto son encuestas propias que se repiten solas cada semana/mes.

create table custom_surveys (
  id uuid primary key default gen_random_uuid(),
  nutricionista_id uuid not null references nutricionistas(uid) on delete cascade,
  name text not null,
  frequency text not null check (frequency in ('weekly', 'monthly')),
  questions jsonb not null default '[]'::jsonb, -- [{ id, label }]
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- period_key identifica el periodo al que pertenece una respuesta: 'YYYY-"W"WW'
-- (semana ISO) para encuestas semanales, 'YYYY-MM' para mensuales. El unique
-- por (survey_id, client_id, period_key) es lo que da el "una respuesta por
-- periodo" e impide reenvíos duplicados del mismo periodo.
create table survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references custom_surveys(id) on delete cascade,
  client_id uuid not null references clientes(id) on delete cascade,
  period_key text not null,
  answers jsonb not null default '{}'::jsonb, -- { questionId: texto }
  submitted_at timestamptz not null default now(),
  unique (survey_id, client_id, period_key)
);

create index idx_custom_surveys_nutricionista_id on custom_surveys(nutricionista_id);
create index idx_survey_responses_survey_id on survey_responses(survey_id);
create index idx_survey_responses_client_id on survey_responses(client_id);

alter table custom_surveys enable row level security;
alter table survey_responses enable row level security;

-- El nutricionista gestiona sus propias encuestas.
create policy nutricionista_manages_surveys on custom_surveys for all
  using (nutricionista_id = (select auth.uid()) or private.is_super_admin())
  with check (nutricionista_id = (select auth.uid()) or private.is_super_admin());

-- El cliente autenticado necesita leer las encuestas activas de su propio
-- nutricionista para saber cuáles tiene pendientes y qué preguntas mostrar.
create policy client_reads_own_nutricionista_surveys on custom_surveys for select
  using (private.is_client_of_nutricionista(nutricionista_id));

-- El nutricionista ve el historial de respuestas de sus clientes; el cliente
-- gestiona (crea/edita) solo las suyas.
create policy nutricionista_reads_survey_responses on survey_responses for select
  using (private.is_nutricionista_of_client(client_id) or private.is_super_admin());
create policy client_manages_own_survey_responses on survey_responses for all
  using (private.is_owner_client(client_id))
  with check (private.is_owner_client(client_id));
