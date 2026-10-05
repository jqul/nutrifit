-- Cierra la fuga de campos internos del nutricionista (notas privadas, notas del
-- informe, precio mensual, etiquetas, mensajes personalizados) hacia el propio
-- cliente: la política anterior (nutricionista_or_client_owns_clientes, 0001)
-- dejaba al cliente leer su fila ENTERA con una consulta directa a la API.
--
-- Ahora solo el nutricionista dueño de la ficha (o un super-admin) accede a la
-- tabla. El cliente lee su ficha por get_my_client_profile (0043), que devuelve
-- únicamente las columnas que necesita. Las cuentas en modo personal tienen
-- nutricionista_id = auth_user_id, así que siguen cubiertas por esta política.
--
-- Se aplicó DESPUÉS de desplegar el frontend que usa el RPC (ClientView.tsx),
-- para no dejar sin perfil a ningún cliente con la versión antigua cargada.
drop policy if exists nutricionista_or_client_owns_clientes on public.clientes;

create policy nutricionista_owns_clientes on public.clientes for all
  using (nutricionista_id = (select auth.uid()) or private.is_super_admin())
  with check (nutricionista_id = (select auth.uid()) or private.is_super_admin());
