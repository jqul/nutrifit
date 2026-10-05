-- Fecha de la última edición de las notas privadas del cliente (UX-37).
-- La rellena la base de datos con un trigger — no el frontend — para que sea
-- fiable aunque la nota se edite desde otro sitio. Solo se actualiza cuando el
-- texto de `notes` cambia de verdad (guardar sin tocar nada no cuenta).
-- Las filas existentes se quedan en NULL: no hay forma de saber cuándo se
-- editaron por última vez.
alter table public.clientes add column if not exists notes_updated_at timestamptz;

create or replace function public.touch_clientes_notes_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.notes is distinct from old.notes then
    new.notes_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists clientes_touch_notes_updated_at on public.clientes;
create trigger clientes_touch_notes_updated_at
  before update of notes on public.clientes
  for each row execute function public.touch_clientes_notes_updated_at();
