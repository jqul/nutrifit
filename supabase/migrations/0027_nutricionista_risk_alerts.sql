-- Radar de clientes en riesgo con alerta al NUTRICIONISTA (no solo al
-- cliente) — cron diario a las 9:00 UTC. send-risk-reminders ya avisaba al
-- propio cliente a los 3 días sin check-in; esta función complementaria
-- (send-nutricionista-risk-alerts) avisa al profesional un día después (4
-- días) si el cliente sigue sin volver, agrupando por nutricionista para
-- no saturar con un push por cliente.
--
-- Ver la nota en 0026_billing_reminders_and_consent_document.sql sobre el
-- placeholder <ANON_KEY>: el entorno bloquea escribir a disco cualquier
-- cadena con forma de JWT. El job real en producción sí lleva la clave
-- real (aplicada directamente contra la base de datos, no escrita aquí).
select cron.schedule(
  'nutrifit-nutricionista-risk-alerts-daily',
  '0 9 * * *',
  $cron$
  select net.http_post(
    url := 'https://yuhebegybxjrdmkpwjqa.supabase.co/functions/v1/send-nutricionista-risk-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
