-- Notas del profesional para el informe clínico en PDF (printProgressReport.ts).
-- Distinto de `clientes.notes`, que es explícitamente privado/no visible
-- para el cliente (ver NotasTab.tsx) — este campo SÍ se imprime en el PDF,
-- que ahora también puede descargar el propio cliente desde su móvil, así
-- que debe quedar en una columna separada para no filtrar las notas
-- internas de consulta.
alter table clientes add column report_notes text not null default '';
