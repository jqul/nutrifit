-- Recordatorio automático de citas: NutriFit ya tenía 4 recordatorios programados
-- (riesgo, encuestas, facturación, avisos) pero ninguno para "tu cita es mañana" —
-- hoy el cliente solo se entera si el nutricionista le escribe a mano. Ver
-- replica/architecture-nutrium.md.
--
-- Una columna basta como marca de "ya avisado": a diferencia de los recordatorios
-- periódicos (semanales/mensuales), una cita solo necesita un aviso, nunca uno por
-- periodo, así que no hace falta una tabla de estado aparte como
-- nutricionista_alert_state.
alter table appointments add column reminder_sent_at timestamptz;
