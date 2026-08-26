-- ── Recordatorio automático de facturación ──────────────────────────
-- Mismo patrón que send-risk-reminders / send-survey-reminders: cron
-- diario a las 9:00 UTC; la propia función decide si le toca actuar hoy
-- (día 1 de mes) para no generar ruido el resto de días. Avisa al
-- NUTRICIONISTA (no al cliente), porque generar la factura es una acción
-- suya, no del cliente — ver supabase/functions/send-billing-reminders.
--
-- NOTA sobre el <ANON_KEY> de más abajo: el entorno en el que se escribió
-- esta migración bloquea por seguridad escribir a un archivo local
-- cualquier cadena con forma de JWT (para evitar comitear credenciales
-- por accidente), así que aquí va un placeholder — sustitúyelo por la
-- "anon public key" del proyecto (Project Settings → API) al aplicar esta
-- migración en otro entorno. El job real en producción SÍ se creó con la
-- clave verdadera (aplicada directamente contra la base de datos, no
-- escrita a este archivo — la anon key es pública de todas formas, es la
-- misma que ya viaja en el bundle del cliente).
--
-- Esta migración también deja constancia (de forma idempotente — con
-- nombre, cron.schedule hace upsert y no duplica) de los dos cron jobs
-- que ya estaban activos en producción antes de esta migración
-- (nutrifit-risk-reminders-daily y nutrifit-survey-reminders-daily) pero
-- que se crearon en su momento directamente por SQL sin backfillear el
-- archivo — se documentan aquí para que el repo refleje la base de datos real.

select cron.schedule(
  'nutrifit-risk-reminders-daily',
  '0 9 * * *',
  $cron$
  select net.http_post(
    url := 'https://yuhebegybxjrdmkpwjqa.supabase.co/functions/v1/send-risk-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>'
    ),
    body := '{}'::jsonb
  );
  $cron$
);

select cron.schedule(
  'nutrifit-survey-reminders-daily',
  '0 9 * * *',
  $cron$
  select net.http_post(
    url := 'https://yuhebegybxjrdmkpwjqa.supabase.co/functions/v1/send-survey-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>'
    ),
    body := '{}'::jsonb
  );
  $cron$
);

select cron.schedule(
  'nutrifit-billing-reminders-daily',
  '0 9 * * *',
  $cron$
  select net.http_post(
    url := 'https://yuhebegybxjrdmkpwjqa.supabase.co/functions/v1/send-billing-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>'
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- ── Documento de consentimiento propio + firma electrónica del cliente ──
-- En vez de un texto de consentimiento genérico integrado en la app, el
-- nutricionista sube el PDF que le haya preparado su propio abogado
-- (AjustesTab) y el cliente lo acepta con una firma electrónica ligera
-- (nombre completo + fecha) antes de poder usar su panel — igual que ya
-- se le exige registrarse/iniciar sesión.
alter table nutricionistas add column consent_document_url text;
alter table clientes add column consent_accepted_at timestamptz;
alter table clientes add column consent_signed_name text;

drop function if exists public.get_nutricionista_branding_by_token(text);
create or replace function public.get_nutricionista_branding_by_token(p_token text)
returns table(display_name text, logo_url text, accent_color text, contact_phone text, consent_document_url text)
language sql stable security definer set search_path = public as $$
  select n.display_name, n.logo_url, n.accent_color, n.contact_phone, n.consent_document_url
  from clientes c join nutricionistas n on n.uid = c.nutricionista_id
  where c.token = p_token
  limit 1;
$$;

-- SECURITY DEFINER porque la política RLS de escritura de `clientes` solo
-- permite escribir al nutricionista dueño (ver 0001_init.sql), igual que
-- claim_client_by_token para el registro — el cliente firma con su propia
-- sesión ya autenticada, verificada aquí contra auth.uid().
create or replace function public.accept_consent(p_token text, p_signed_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update clientes set consent_accepted_at = now(), consent_signed_name = p_signed_name
  where token = p_token and auth_user_id = auth.uid();
end;
$$;

-- Bucket para el PDF de consentimiento — público en lectura porque el
-- cliente lo abre desde su enlace sin sesión de nutricionista de por
-- medio (mismo patrón que el bucket "recipe-photos"); escritura solo bajo
-- la carpeta del propio nutricionista.
insert into storage.buckets (id, name, public) values ('consent-documents', 'consent-documents', true)
on conflict (id) do nothing;

create policy consent_documents_write on storage.objects for insert
  with check (bucket_id = 'consent-documents' and ((storage.foldername(name))[1])::uuid = auth.uid());

create policy consent_documents_update on storage.objects for update
  using (bucket_id = 'consent-documents' and ((storage.foldername(name))[1])::uuid = auth.uid());

create policy consent_documents_delete on storage.objects for delete
  using (bucket_id = 'consent-documents' and ((storage.foldername(name))[1])::uuid = auth.uid());
