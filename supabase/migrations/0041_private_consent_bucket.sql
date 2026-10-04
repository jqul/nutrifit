-- El PDF de consentimiento (0026) se creó en un bucket público: cualquiera
-- con la URL lo descargaba sin sesión. Aunque el documento sea genérico,
-- puede llevar datos profesionales, condiciones legales y marca del
-- nutricionista, y el resto de buckets con documentos (photos, lab-reports)
-- ya son privados.
--
-- A partir de ahora el bucket es privado y nutricionistas.consent_document_url
-- guarda la RUTA del objeto ("<uid>/consentimiento.pdf"), no una URL pública.
-- La app pide una URL firmada de corta duración al mostrarlo (ver
-- src/lib/useSignedUrl.ts). Si algún día hubiera una fila con la URL pública
-- antigua, useSignedUrl le extrae la ruta igual que StoragePhoto, así que no
-- hace falta migrar datos (en el momento de aplicar esto no había ninguno).
update storage.buckets set public = false where id = 'consent-documents';

-- Con el bucket público no hacía falta política de lectura. Ahora sí:
-- el nutricionista dueño de la carpeta (para ver y reemplazar su documento) y
-- los clientes de ese nutricionista (para leerlo antes de firmar).
create policy consent_documents_read on storage.objects for select to authenticated
  using (
    bucket_id = 'consent-documents'
    and (
      ((storage.foldername(name))[1])::uuid = (select auth.uid())
      or private.is_client_of_nutricionista(((storage.foldername(name))[1])::uuid)
    )
  );
