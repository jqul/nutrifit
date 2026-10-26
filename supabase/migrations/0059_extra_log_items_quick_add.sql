-- Quick Add: apuntar solo kcal/macros a mano cuando el alimento no está en
-- el catálogo, en vez de quedarse sin poder registrarlo (ver
-- replica/architecture-myfitnesspal.md). Sin IA: son los números que teclea
-- el propio cliente, igual que leerlos de una etiqueta.
alter table extra_log_items drop constraint extra_log_items_source_check;
alter table extra_log_items add constraint extra_log_items_source_check
  check (source in ('barcode', 'catalog', 'quick_add'));

-- is_estimate ya existía sin usar (ver 0058) — se reutiliza aquí: true en
-- una fila quick_add (número propio, sin verificar contra nada), false en
-- 'barcode'/'catalog' (valor verificado por un escaneo o el catálogo).
comment on column extra_log_items.is_estimate is
  'true para una fila quick_add (número propio sin verificar); false para barcode/catalog (valor verificado).';
