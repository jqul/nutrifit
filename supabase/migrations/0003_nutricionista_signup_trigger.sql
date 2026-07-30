-- Crear la fila de perfil en nutricionistas vía trigger de auth.users, en vez de
-- un upsert desde el cliente justo tras signUp(). Con "Confirm email" activo (el
-- valor por defecto en un proyecto Supabase nuevo) signUp() no deja sesión activa
-- hasta confirmar el email, así que auth.uid() es null y el upsert del cliente
-- fallaba silenciosamente por RLS, dejando usuarios de auth sin fila de perfil.
--
-- Se restringe a los signups marcados con signup_type='nutricionista' en los
-- metadatos (los pone Auth.tsx) para no crear también una fila de nutricionista
-- cuando quien se registra es un cliente (ClientRegister.tsx).

create or replace function public.handle_new_nutricionista() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.raw_user_meta_data->>'signup_type' = 'nutricionista' then
    insert into public.nutricionistas (uid, email, display_name, approved, role, created_at)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), false, 'trainer', now())
    on conflict (uid) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created_nutricionista
  after insert on auth.users
  for each row execute function public.handle_new_nutricionista();
