-- Minerales (calcio, hierro, zinc) en alimentos y en el plan de dieta, y una
-- columna de referencia para saber de dónde sale cada dato nutricional.

alter table foods add column calcium_mg numeric;
alter table foods add column iron_mg numeric;
alter table foods add column zinc_mg numeric;
alter table foods add column reference text;

alter table diet_meal_items add column calcium_mg numeric;
alter table diet_meal_items add column iron_mg numeric;
alter table diet_meal_items add column zinc_mg numeric;

-- ── Minerales para los alimentos ya existentes ───────────────────────────
-- Valores aproximados por 100g (calcio mg, hierro mg, zinc mg), basados en
-- tablas de composición de alimentos de referencia (BEDCA / USDA).

update foods set calcium_mg = ca, iron_mg = fe, zinc_mg = zn, reference = 'BEDCA / USDA (aproximado)' from (values
  ('Arroz blanco (cocido)', 3, 0.2, 0.5),
  ('Arroz integral (cocido)', 4, 0.4, 0.6),
  ('Avena', 54, 4.3, 4.0),
  ('Boniato (asado)', 30, 0.7, 0.3),
  ('Cuscús (cocido)', 8, 0.5, 0.4),
  ('Pan blanco', 150, 1.2, 0.6),
  ('Pan integral', 100, 2.0, 1.5),
  ('Pasta (cocida)', 7, 0.5, 0.5),
  ('Pasta integral (cocida)', 13, 1.3, 1.0),
  ('Patata (cocida)', 8, 0.3, 0.3),
  ('Quinoa (cocida)', 17, 1.5, 1.1),
  ('Arándanos', 6, 0.3, 0.2),
  ('Fresas', 16, 0.4, 0.1),
  ('Kiwi', 34, 0.3, 0.1),
  ('Manzana', 6, 0.1, 0.0),
  ('Naranja', 40, 0.1, 0.1),
  ('Pera', 9, 0.2, 0.1),
  ('Plátano', 5, 0.3, 0.2),
  ('Uvas', 10, 0.4, 0.1),
  ('Almendras', 269, 3.7, 3.1),
  ('Anacardos', 37, 6.7, 5.8),
  ('Cacahuetes', 92, 4.6, 3.3),
  ('Nueces', 98, 2.9, 3.1),
  ('Aceite de oliva', 1, 0.6, 0.0),
  ('Aguacate', 12, 0.6, 0.6),
  ('Crema de cacahuete', 43, 1.9, 2.5),
  ('Leche desnatada', 122, 0.0, 0.4),
  ('Leche entera', 113, 0.0, 0.4),
  ('Queso curado', 800, 0.5, 3.5),
  ('Queso fresco', 90, 0.1, 0.6),
  ('Requesón', 83, 0.1, 0.4),
  ('Yogur griego', 110, 0.1, 0.5),
  ('Yogur natural', 121, 0.1, 0.6),
  ('Alubias (cocidas)', 35, 2.0, 1.0),
  ('Garbanzos (cocidos)', 49, 2.9, 1.5),
  ('Guisantes', 25, 1.5, 1.2),
  ('Lentejas (cocidas)', 19, 3.3, 1.3),
  ('Chocolate negro (85%)', 73, 11.9, 3.3),
  ('Miel', 6, 0.4, 0.2),
  ('Atún al natural', 8, 1.3, 0.6),
  ('Bacalao', 16, 0.4, 0.5),
  ('Cerdo (lomo)', 6, 0.9, 2.0),
  ('Clara de huevo', 5, 0.1, 0.0),
  ('Gambas', 70, 0.5, 1.3),
  ('Huevo entero', 50, 1.8, 1.3),
  ('Jamón cocido', 6, 0.6, 1.3),
  ('Jamón serrano', 10, 1.0, 2.5),
  ('Merluza', 20, 0.3, 0.4),
  ('Muslo de pollo', 10, 1.0, 1.9),
  ('Pavo (pechuga)', 12, 0.7, 0.7),
  ('Pechuga de pollo', 6, 0.4, 0.7),
  ('Salmón', 12, 0.3, 0.4),
  ('Seitán', 30, 2.0, 1.0),
  ('Ternera magra', 8, 2.1, 4.0),
  ('Tofu', 350, 5.4, 0.8),
  ('Proteína de suero (polvo)', 150, 0.5, 2.0),
  ('Brócoli', 47, 0.7, 0.4),
  ('Calabacín', 16, 0.4, 0.3),
  ('Cebolla', 23, 0.2, 0.2),
  ('Champiñones', 3, 0.5, 0.5),
  ('Espinacas', 99, 2.7, 0.5),
  ('Lechuga', 36, 0.9, 0.2),
  ('Pimiento rojo', 7, 0.4, 0.3),
  ('Tomate', 10, 0.3, 0.2),
  ('Zanahoria', 33, 0.3, 0.2)
) as t(n, ca, fe, zn) where foods.name = t.n;
