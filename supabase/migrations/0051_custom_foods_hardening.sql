-- Alimentos propios: tres huecos que tenía el catálogo personal (0018).
--
-- 1) Los CLIENTES no veían los alimentos propios de su nutricionista: la política
--    de lectura solo dejaba ver los del sistema, los del propio usuario y (super
--    admin) todos. Un plan con un alimento propio salía en la app del cliente, pero
--    sin poder sugerirle sustitutos ni agruparlo bien en la lista de la compra.
--    Ahora el cliente también lee los alimentos de SU nutricionista (y de nadie más).
--
-- 2) Los platos de un plan se enlazan con el alimento POR NOMBRE, así que dos
--    alimentos con el mismo nombre hacen ambiguas las sustituciones y la lista de
--    la compra. Un nutricionista no puede repetir un nombre suyo, ni usar el de un
--    alimento del sistema (sin distinguir mayúsculas).
--
-- 3) Valores imposibles (un typo de 5000 kcal por 100 g) rompen todos los cálculos
--    de macros del plan. Solo en los alimentos propios (los del sistema ya están
--    revisados): kcal 0-950, proteína/carbohidratos/grasa 0-100 g por 100 g y no más
--    de 105 g entre los tres. Los mismos límites que valida el formulario
--    (src/lib/foodDraft.ts).

drop policy if exists foods_read_own_and_system on public.foods;
create policy foods_read_own_and_system on public.foods for select
  using (
    nutricionista_id is null
    or nutricionista_id = (select auth.uid())
    or private.is_super_admin()
    or private.is_client_of_nutricionista(nutricionista_id)
  );

-- Un nombre propio no se repite (por nutricionista, sin distinguir mayúsculas).
create unique index if not exists foods_custom_name_unique
  on public.foods (nutricionista_id, lower(btrim(name)))
  where nutricionista_id is not null;

-- ...ni coincide con el de un alimento del sistema.
create or replace function public.foods_custom_name_not_system()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.nutricionista_id is not null and exists (
    select 1 from public.foods s where s.nutricionista_id is null and lower(btrim(s.name)) = lower(btrim(new.name))
  ) then
    raise exception 'Ya existe en el catálogo un alimento llamado "%"', btrim(new.name) using errcode = '23505';
  end if;
  return new;
end $$;

drop trigger if exists foods_custom_name_not_system on public.foods;
create trigger foods_custom_name_not_system
  before insert or update of name, nutricionista_id on public.foods
  for each row execute function public.foods_custom_name_not_system();

alter table public.foods drop constraint if exists foods_custom_values_sane;
alter table public.foods add constraint foods_custom_values_sane check (
  nutricionista_id is null or (
    char_length(btrim(name)) between 1 and 100
    and kcal between 0 and 950
    and protein_g between 0 and 100 and carbs_g between 0 and 100 and fat_g between 0 and 100
    and protein_g + carbs_g + fat_g <= 105
    and coalesce(fiber_g, 0) >= 0 and coalesce(sugar_g, 0) >= 0 and coalesce(sodium_mg, 0) >= 0
    and coalesce(saturated_fat_g, 0) >= 0 and coalesce(calcium_mg, 0) >= 0
    and coalesce(iron_mg, 0) >= 0 and coalesce(zinc_mg, 0) >= 0
  )
);
