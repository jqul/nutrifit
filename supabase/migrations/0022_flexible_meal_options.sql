-- Pauta flexible por opciones: varias comidas pueden compartir un mismo
-- "grupo de opciones" (option_group) — son alternativas intercambiables
-- del mismo hueco (ej. "Comida: Opción A / Opción B / Opción C") y el
-- cliente elige cuál sigue ese día. option_group null = comida fija de
-- siempre (comportamiento sin cambios para los planes ya creados).
alter table diet_meals add column option_group uuid;
alter table diet_meals add column option_label text;
