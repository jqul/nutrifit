-- El nutricionista puede registrar el peso inicial de su cliente al crearlo.
--
-- Hasta ahora weight_logs solo la escribía el cliente (client_manages_weight_logs) y el nutricionista solo podía leerla,
-- así que el formulario de "Nuevo cliente" no podía pedir el peso: quedaba "sin rellenar" hasta que el propio cliente
-- entraba y lo apuntaba. Se permite SOLO insertar (no modificar ni borrar los pesajes del cliente) y solo para sus clientes.
drop policy if exists nutricionista_inserts_weight_logs on public.weight_logs;
create policy nutricionista_inserts_weight_logs on public.weight_logs for insert
  with check (private.is_nutricionista_of_client(client_id));
