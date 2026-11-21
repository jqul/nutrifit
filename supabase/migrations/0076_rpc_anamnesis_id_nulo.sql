-- Corrige un caso límite de public.get_custom_anamnesis_questions(uuid) creada en 0074 (ya aplicada en producción; por eso va en una migración nueva).
--
-- Qué pasaba: con p_nutricionista_id = NULL, la condición `not (p = auth.uid() or is_client_of_nutricionista(p) or is_super_admin())` valía
-- NULL (no false) por la lógica de tres valores de SQL, y un `if` con NULL no entra: la función NO lanzaba el error de acceso y devolvía '[]'.
-- No filtraba datos (no existe fila con uid NULL), pero contradecía lo que 0074 promete: «sin acceso → error 42501, nunca una lista vacía».
--
-- Arreglo: un identificador NULL se rechaza expresamente con el mismo error 42501. No cambia nada más: mismos atributos (SECURITY DEFINER,
-- STABLE, search_path vacío, propietario), mismos controles para el resto de entradas, mismo resultado, mismos privilegios. `create or replace`
-- conserva el ACL de la función (ejecutable por authenticated y service_role, no por anon ni PUBLIC); se repiten el REVOKE y el GRANT para que la
-- migración se baste a sí misma y no dependa de ese detalle.
--
-- Solo DDL sobre una función: no modifica datos. Este cambio NO es la etapa 2 (retirar la lectura de la clienta), que sigue sin aplicarse.

create or replace function public.get_custom_anamnesis_questions(p_nutricionista_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if auth.uid() is null then
    raise exception 'Hace falta una sesión' using errcode = '28000';
  end if;
  if p_nutricionista_id is null
     or not (p_nutricionista_id = auth.uid()
             or private.is_client_of_nutricionista(p_nutricionista_id)
             or private.is_super_admin()) then
    raise exception 'Sin acceso a las preguntas de este profesional' using errcode = '42501';
  end if;
  select n.custom_anamnesis_questions into v from public.nutricionistas n where n.uid = p_nutricionista_id;
  return coalesce(v, '[]'::jsonb);
end $$;

revoke all on function public.get_custom_anamnesis_questions(uuid) from public, anon;
grant execute on function public.get_custom_anamnesis_questions(uuid) to authenticated;
