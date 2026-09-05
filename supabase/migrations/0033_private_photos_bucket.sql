-- El bucket `photos` (fotos de progreso corporal y del diario de comidas)
-- se creó como público en 0001_init.sql — cualquiera con la URL, filtrada
-- o adivinada, podía ver la foto sin autenticarse ni pasar por ninguna
-- política RLS (un bucket público de Supabase Storage sirve el objeto
-- directamente, sin comprobar storage.objects policies). Para datos tan
-- delicados como fotos corporales, eso es demasiado.
--
-- A partir de ahora el bucket es privado: la app guarda solo la RUTA del
-- objeto (no una URL pública) y pide una URL firmada de corta duración
-- justo antes de mostrar cada foto (ver src/components/shared/
-- StoragePhoto.tsx). Las filas ya existentes, que sí guardaron la URL
-- pública completa, siguen funcionando — StoragePhoto le extrae la ruta a
-- esa URL vieja y pide una firmada igual que a las nuevas, así que no
-- hace falta migrar los datos aparte.
update storage.buckets set public = false where id = 'photos';

-- Punto suelto que señalaba también la revisión: existían políticas de
-- insert/update/select para este bucket pero ninguna de delete — el
-- cliente no podía borrar una foto suya (ni de progreso ni de una comida)
-- una vez subida.
create policy photos_client_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and private.is_owner_client((storage.foldername(name))[1]::uuid));
