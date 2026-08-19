-- Bucket público para fotos de receta — antes solo se podía pegar una URL
-- externa ya publicada, lo cual no funcionaba para casi nadie (no todo el
-- mundo tiene una foto ya alojada en algún sitio). Público en lectura
-- porque las recetas del sistema se comparten entre todos los
-- nutricionistas y las fotos se ven también en el PDF sin necesidad de
-- sesión. Escritura solo bajo la carpeta del propio nutricionista
-- (nutricionista_id como primer segmento de la ruta), igual que el patrón
-- ya usado en el bucket "photos".
insert into storage.buckets (id, name, public) values ('recipe-photos', 'recipe-photos', true)
on conflict (id) do nothing;

create policy recipe_photos_write on storage.objects for insert
  with check (bucket_id = 'recipe-photos' and ((storage.foldername(name))[1])::uuid = auth.uid());

create policy recipe_photos_update on storage.objects for update
  using (bucket_id = 'recipe-photos' and ((storage.foldername(name))[1])::uuid = auth.uid());

create policy recipe_photos_delete on storage.objects for delete
  using (bucket_id = 'recipe-photos' and ((storage.foldername(name))[1])::uuid = auth.uid());
