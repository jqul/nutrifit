-- Las 4 funciones de recordatorio automático (send-risk-reminders,
-- send-survey-reminders, send-billing-reminders,
-- send-nutricionista-risk-alerts) ahora exigen una cabecera x-cron-secret
-- si la variable de entorno CRON_SECRET está configurada (ver el código de
-- cada función) — antes cualquiera con el anon key público podía invocarlas
-- repetidamente sin ninguna barrera. cron.schedule(...) hace upsert por
-- nombre de job, así que hay que reemitir la definición completa de cada
-- uno de los 4 jobs existentes (mismo nombre, mismo cron, misma URL) para
-- añadir la nueva cabecera junto a la Authorization que ya llevaban.
--
-- <ANON_KEY> y <CRON_SECRET> son placeholders — no se commitean los valores
-- reales. <CRON_SECRET>, a diferencia del anon key, es un secreto nuevo que
-- además hay que configurar como Edge Function secret (Project Settings →
-- Edge Functions → Secrets) para que el check del lado del código llegue a
-- aplicarse.
select cron.schedule(
  'nutrifit-risk-reminders-daily',
  '0 9 * * *',
  $cron$
  select net.http_post(
    url := 'https://yuhebegybxjrdmkpwjqa.supabase.co/functions/v1/send-risk-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>',
      'x-cron-secret', '<CRON_SECRET>'
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
      'Authorization', 'Bearer <ANON_KEY>',
      'x-cron-secret', '<CRON_SECRET>'
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
      'Authorization', 'Bearer <ANON_KEY>',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $cron$
);

select cron.schedule(
  'nutrifit-nutricionista-risk-alerts-daily',
  '0 9 * * *',
  $cron$
  select net.http_post(
    url := 'https://yuhebegybxjrdmkpwjqa.supabase.co/functions/v1/send-nutricionista-risk-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- PENDIENTE (no lo puedo hacer yo con las herramientas MCP disponibles):
-- configurar el secreto CRON_SECRET en Project Settings → Edge Functions →
-- Secrets. Hasta que no se configure, el check de las 4 funciones no
-- bloquea nada (fail-open deliberado — ver comentario en cada index.ts).
