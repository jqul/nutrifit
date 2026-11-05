-- 1. El cliente apunta sus propias medidas (0066 solo le dejaba leerlas): cintura, % de grasa… de las métricas que su
--    nutricionista deja visibles. No puede escribir métricas ocultas ni de otro nutricionista, ni en la ficha de otro cliente,
--    ni con fecha de mañana en adelante (se deja un día de margen por la zona horaria).
-- 2. Recetas: alérgenos (para avisar al cliente y para que «proponer menú» salte lo que no le va) y raciones.
create or replace function private.metric_of_my_nutricionista(p_metric_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from metric_definitions d
    where d.id = p_metric_id and d.client_visible and private.is_client_of_nutricionista(d.nutricionista_id)
  );
$$;

create policy client_inserts_own_body_metrics on public.body_metrics for insert
  with check (private.is_owner_client(client_id) and private.metric_of_my_nutricionista(metric_id) and date <= current_date + 1);

create policy client_updates_own_body_metrics on public.body_metrics for update
  using (private.is_owner_client(client_id) and private.metric_of_my_nutricionista(metric_id))
  with check (private.is_owner_client(client_id) and private.metric_of_my_nutricionista(metric_id) and date <= current_date + 1);

create policy client_deletes_own_body_metrics on public.body_metrics for delete
  using (private.is_owner_client(client_id) and private.metric_of_my_nutricionista(metric_id));

alter table public.recipes
  add column if not exists allergens text[] not null default '{}',
  add column if not exists servings int check (servings between 1 and 50);
