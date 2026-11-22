-- VINCULACIÓN SEGURA DE CLIENTAS, parte 3 de 3 (RETIRADA DE COMPATIBILIDAD). PROPUESTA: no aplicada en ninguna base.
-- NO APLICAR hasta que la aplicación nueva lleve desplegada un plazo prudencial (propuesta: 14 días) y se haya comprobado que ya nadie usa la antigua.
--
-- Hasta ahora se ha mantenido, solo por compatibilidad con la aplicación antigua, la RPC anónima get_client_auth_status_by_token, que devuelve el
-- auth_user_id del titular a cualquiera que tenga el token de la ficha (hallazgo 9 de la auditoría). La aplicación nueva usa get_client_link_state, que
-- solo dice si la ficha está reclamada y si el llamante es su titular.
--
-- Qué hace: elimina esa RPC y la función antigua de reclamación (que desde 0078 solo lanza un error). Una versión antigua que siga abierta recibirá un
-- error visible al cargar, no datos incorrectos. Se puede recuperar recreando la función (definición en 0077 / supabase de producción antes de esta migración).
drop function if exists public.get_client_auth_status_by_token(text);
drop function if exists public.claim_client_by_token(text);
