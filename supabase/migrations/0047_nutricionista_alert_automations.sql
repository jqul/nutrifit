-- Automatizaciones: aviso diario al NUTRICIONISTA (nunca al cliente) con las
-- alertas nuevas de sus clientes (peso estancado, hambre alta, energía baja,
-- adherencia baja, sin pesar, objetivo alcanzado) y sus citas de mañana. Lo
-- calcula la función programada send-nutricionista-alerts.

-- Qué avisos quiere recibir cada nutricionista. Tabla aparte (y no una columna
-- de `nutricionistas`) porque esa fila la puede leer el cliente: aquí no hay
-- política para clientes. Sin fila = todo activado.
create table public.nutricionista_automations (
  nutricionista_id uuid primary key references public.nutricionistas(uid) on delete cascade,
  -- { "kinds": { "high_hunger": false, ... }, "appointments_tomorrow": true }
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.nutricionista_automations enable row level security;

create policy nutricionista_manages_own_automations on public.nutricionista_automations
  for all
  using (nutricionista_id = (select auth.uid()))
  with check (nutricionista_id = (select auth.uid()));

-- Qué alertas ya se avisaron, para no repetirlas cada día: se avisa una vez y
-- solo vuelve a avisar si la alerta desaparece y reaparece. Es estado interno de
-- la función programada (usa la service role): RLS activada y SIN ninguna
-- política, así que nadie más puede leerla ni escribirla por la API.
create table public.nutricionista_alert_state (
  client_id uuid not null references public.clientes(id) on delete cascade,
  kind text not null,
  first_notified_at timestamptz not null default now(),
  primary key (client_id, kind)
);

alter table public.nutricionista_alert_state enable row level security;
