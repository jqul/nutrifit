-- Backfill de higiene, encontrado en una revisión completa: esta columna
-- ya está en producción desde el principio del proyecto de mensajería
-- (se aplicó directamente por SQL y nunca se dejó constancia en un
-- archivo de migración) — se documenta aquí para que el repo refleje la
-- base de datos real. `if not exists` para que sea seguro reproducir
-- este archivo en una base de datos ya al día.
alter table message_templates add column if not exists created_at timestamptz not null default now();
