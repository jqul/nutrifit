-- Pasos de preparación para recetas (texto libre, un paso por línea).
alter table recipes add column steps text;

-- Diario digestivo dentro del check-in diario: opcional (nullable), no
-- sustituye valoración médica — solo para que el nutricionista detecte
-- patrones (hinchazón, dolor abdominal, forma de las heces según la
-- escala de Bristol 1-7).
alter table daily_checkins add column bristol_scale smallint;
alter table daily_checkins add column bloating smallint;
alter table daily_checkins add column abdominal_pain smallint;
