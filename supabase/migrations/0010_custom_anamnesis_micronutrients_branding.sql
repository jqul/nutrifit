-- Preguntas de anamnesis personalizadas, nutrientes ampliados (fibra, azúcares,
-- sodio, grasas saturadas) en alimentos y en el plan de dieta, y marca blanca
-- (logo, color de acento, dominio propio) por nutricionista.

alter table nutricionistas add column custom_anamnesis_questions jsonb not null default '[]'::jsonb;
alter table nutricionistas add column logo_url text;
alter table nutricionistas add column accent_color text;
alter table nutricionistas add column custom_domain text unique;

alter table foods add column fiber_g numeric;
alter table foods add column sugar_g numeric;
alter table foods add column sodium_mg numeric;
alter table foods add column saturated_fat_g numeric;

alter table diet_meal_items add column fiber_g numeric;
alter table diet_meal_items add column sugar_g numeric;
alter table diet_meal_items add column sodium_mg numeric;
alter table diet_meal_items add column saturated_fat_g numeric;

-- El cliente (anónimo, antes de autenticarse) necesita ver el logo/color de su
-- nutricionista en la pantalla de registro/login — mismo patrón que
-- get_nutricionista_name_by_token, ahora con los campos de marca.
create or replace function public.get_nutricionista_branding_by_token(p_token text)
returns table(display_name text, logo_url text, accent_color text)
language sql stable security definer set search_path = public as $$
  select n.display_name, n.logo_url, n.accent_color
  from clientes c join nutricionistas n on n.uid = c.nutricionista_id
  where c.token = p_token
  limit 1;
$$;

-- Al entrar por un dominio propio (antes de cualquier sesión), hay que saber
-- qué nutricionista lo tiene asignado para aplicar su marca desde el arranque.
create or replace function public.get_nutricionista_by_domain(p_domain text)
returns table(uid uuid, display_name text, logo_url text, accent_color text)
language sql stable security definer set search_path = public as $$
  select uid, display_name, logo_url, accent_color
  from nutricionistas
  where custom_domain = p_domain
  limit 1;
$$;

-- ── Datos nutricionales ampliados para los alimentos ya existentes ──────
-- Valores aproximados por 100g (fibra, azúcares, sodio en mg, grasa saturada).

update foods set fiber_g = f, sugar_g = s, sodium_mg = so, saturated_fat_g = sf from (values
  ('Pechuga de pollo', 0, 0, 74, 1),
  ('Muslo de pollo', 0, 0, 90, 3),
  ('Pavo (pechuga)', 0, 0, 60, 0.4),
  ('Ternera magra', 0, 0, 65, 3),
  ('Cerdo (lomo)', 0, 0, 55, 1.3),
  ('Salmón', 0, 0, 60, 3.1),
  ('Merluza', 0, 0, 70, 0.3),
  ('Atún al natural', 0, 0, 300, 0.3),
  ('Bacalao', 0, 0, 60, 0.1),
  ('Gambas', 0.2, 0, 170, 0.1),
  ('Huevo entero', 1.1, 1.1, 124, 3.3),
  ('Clara de huevo', 0.7, 0.7, 166, 0),
  ('Tofu', 0.3, 0.6, 7, 0.7),
  ('Seitán', 0.6, 3, 250, 0.3),
  ('Jamón cocido', 0, 1, 900, 1.2),
  ('Jamón serrano', 0, 0, 1500, 4.5),
  ('Arroz blanco (cocido)', 0.4, 0, 1, 0.1),
  ('Arroz integral (cocido)', 1.8, 0.2, 2, 0.2),
  ('Pasta (cocida)', 1.8, 0.6, 1, 0.2),
  ('Pasta integral (cocida)', 4.5, 0.7, 3, 0.2),
  ('Pan blanco', 2.7, 5, 500, 0.6),
  ('Pan integral', 6.5, 5.6, 460, 0.7),
  ('Avena', 10.1, 1, 2, 1.4),
  ('Patata (cocida)', 1.8, 0.9, 4, 0),
  ('Boniato (asado)', 3.3, 6.5, 36, 0.1),
  ('Quinoa (cocida)', 2.8, 0.9, 7, 0.2),
  ('Cuscús (cocido)', 1.4, 0.1, 5, 0.1),
  ('Lentejas (cocidas)', 7.9, 1.8, 2, 0.1),
  ('Garbanzos (cocidos)', 7.6, 4.8, 7, 0.3),
  ('Alubias (cocidas)', 6.4, 0.3, 2, 0.1),
  ('Guisantes', 5.1, 5.7, 5, 0.1),
  ('Leche entera', 0, 4.8, 43, 2),
  ('Leche desnatada', 0, 5, 44, 0.1),
  ('Yogur natural', 0, 4.7, 46, 2.1),
  ('Yogur griego', 0, 4, 36, 3.2),
  ('Queso fresco', 0, 3.4, 320, 2.9),
  ('Requesón', 0, 3.4, 350, 2.9),
  ('Queso curado', 0, 0.5, 700, 21),
  ('Manzana', 2.4, 10.4, 1, 0),
  ('Plátano', 2.6, 12.2, 1, 0.1),
  ('Naranja', 2.4, 9.4, 0, 0),
  ('Fresas', 2, 4.9, 1, 0),
  ('Arándanos', 2.4, 10, 1, 0),
  ('Pera', 3.1, 9.8, 1, 0),
  ('Uvas', 0.9, 16, 2, 0.1),
  ('Kiwi', 3, 9, 3, 0),
  ('Brócoli', 2.6, 1.7, 33, 0.1),
  ('Espinacas', 2.2, 0.4, 79, 0.1),
  ('Tomate', 1.2, 2.6, 5, 0),
  ('Zanahoria', 2.8, 4.7, 69, 0.1),
  ('Calabacín', 1.1, 2.5, 8, 0.1),
  ('Pimiento rojo', 2.1, 4.2, 4, 0),
  ('Lechuga', 1.3, 0.8, 28, 0),
  ('Cebolla', 1.7, 4.2, 4, 0),
  ('Champiñones', 1, 2, 5, 0.1),
  ('Aguacate', 6.7, 0.7, 7, 2.1),
  ('Aceite de oliva', 0, 0, 0, 14),
  ('Almendras', 12.5, 4.4, 1, 3.7),
  ('Nueces', 6.7, 2.6, 2, 6.1),
  ('Cacahuetes', 8.5, 4, 18, 6.3),
  ('Anacardos', 3.3, 5.9, 12, 7.8),
  ('Miel', 0.2, 82, 4, 0),
  ('Chocolate negro (85%)', 11, 12, 5, 25.8),
  ('Proteína de suero (polvo)', 2, 4, 150, 3),
  ('Crema de cacahuete', 6, 9, 460, 9)
) as t(n, f, s, so, sf) where foods.name = t.n;
