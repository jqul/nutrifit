-- Permite a cada nutricionista añadir sus propios alimentos al catálogo
-- (privados, solo visibles para quien los crea) además de los del sistema
-- (nutricionista_id null, visibles para todos) — mismo patrón que `recipes`.
alter table foods add column nutricionista_id uuid references nutricionistas(uid) on delete cascade;

drop policy if exists foods_read_all on foods;

create policy foods_read_own_and_system on foods for select
  using (nutricionista_id is null or nutricionista_id = auth.uid() or private.is_super_admin());

create policy foods_insert_own on foods for insert
  with check (nutricionista_id = auth.uid());

create policy foods_update_own on foods for update
  using (nutricionista_id = auth.uid())
  with check (nutricionista_id = auth.uid());

create policy foods_delete_own on foods for delete
  using (nutricionista_id = auth.uid());

create index idx_foods_nutricionista_id on foods(nutricionista_id);

-- Ampliación del catálogo base (alimentos del sistema, nutricionista_id null)
-- para cubrir huecos habituales: más verduras, frutas, pescados, mariscos,
-- lácteos alternativos, legumbres, grasas/semillas, frutos secos y suplementos.
insert into foods (name, category, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g, calcium_mg, iron_mg, zinc_mg, reference) values
('Pepino', 'Verdura', 15, 0.7, 3.6, 0.1, 0.5, 1.7, 2, 0, 16, 0.3, 0.2, 'BEDCA / USDA (aproximado)'),
('Berenjena', 'Verdura', 25, 1, 6, 0.2, 3, 3.5, 2, 0, 9, 0.2, 0.2, 'BEDCA / USDA (aproximado)'),
('Coliflor', 'Verdura', 25, 1.9, 5, 0.3, 2, 1.9, 30, 0.1, 22, 0.4, 0.3, 'BEDCA / USDA (aproximado)'),
('Judía verde', 'Verdura', 31, 1.8, 7, 0.1, 3.4, 3.3, 6, 0, 37, 1, 0.2, 'BEDCA / USDA (aproximado)'),
('Puerro', 'Verdura', 61, 1.5, 14, 0.3, 1.8, 3.9, 20, 0, 59, 2.1, 0.1, 'BEDCA / USDA (aproximado)'),
('Espárragos', 'Verdura', 20, 2.2, 3.9, 0.1, 2.1, 1.9, 2, 0, 24, 2.1, 0.5, 'BEDCA / USDA (aproximado)'),
('Calabaza', 'Verdura', 26, 1, 6.5, 0.1, 0.5, 2.8, 1, 0, 21, 0.8, 0.3, 'BEDCA / USDA (aproximado)'),
('Remolacha (cocida)', 'Verdura', 44, 1.7, 10, 0.2, 2, 7, 77, 0, 16, 0.8, 0.4, 'BEDCA / USDA (aproximado)'),
('Apio', 'Verdura', 16, 0.7, 3, 0.2, 1.6, 1.3, 80, 0, 40, 0.2, 0.1, 'BEDCA / USDA (aproximado)'),
('Ajo', 'Verdura', 149, 6.4, 33, 0.5, 2.1, 1, 17, 0.1, 181, 1.7, 1.2, 'BEDCA / USDA (aproximado)'),
('Sandía', 'Fruta', 30, 0.6, 8, 0.2, 0.4, 6, 1, 0, 7, 0.2, 0.1, 'BEDCA / USDA (aproximado)'),
('Melón', 'Fruta', 34, 0.8, 8, 0.2, 0.9, 8, 16, 0, 9, 0.2, 0.2, 'BEDCA / USDA (aproximado)'),
('Piña', 'Fruta', 50, 0.5, 13, 0.1, 1.4, 10, 1, 0, 13, 0.3, 0.1, 'BEDCA / USDA (aproximado)'),
('Mango', 'Fruta', 60, 0.8, 15, 0.4, 1.6, 14, 1, 0.1, 11, 0.2, 0.1, 'BEDCA / USDA (aproximado)'),
('Melocotón', 'Fruta', 39, 0.9, 10, 0.3, 1.5, 8, 0, 0, 6, 0.3, 0.2, 'BEDCA / USDA (aproximado)'),
('Cerezas', 'Fruta', 63, 1.1, 16, 0.2, 2.1, 13, 0, 0, 13, 0.4, 0.1, 'BEDCA / USDA (aproximado)'),
('Mandarina', 'Fruta', 53, 0.8, 13, 0.3, 1.8, 10, 2, 0, 37, 0.2, 0.1, 'BEDCA / USDA (aproximado)'),
('Limón', 'Fruta', 29, 1.1, 9, 0.3, 2.8, 2.5, 2, 0, 26, 0.6, 0.1, 'BEDCA / USDA (aproximado)'),
('Ciruela', 'Fruta', 46, 0.7, 11, 0.3, 1.4, 10, 0, 0, 6, 0.2, 0.1, 'BEDCA / USDA (aproximado)'),
('Maíz dulce (cocido)', 'Carbohidrato', 96, 3.4, 21, 1.5, 2.4, 3.2, 15, 0.2, 2, 0.5, 0.5, 'BEDCA / USDA (aproximado)'),
('Tortitas de arroz', 'Carbohidrato', 387, 8, 81, 2.8, 4.2, 0.4, 6, 0.6, 11, 1.2, 1.2, 'BEDCA / USDA (aproximado)'),
('Pan de centeno', 'Carbohidrato', 250, 8.5, 48, 1.7, 5.8, 3, 500, 0.3, 40, 2.5, 1.3, 'BEDCA / USDA (aproximado)'),
('Copos de maíz (cereales)', 'Carbohidrato', 378, 7, 84, 0.9, 3, 8, 660, 0.2, 3, 8, 0.6, 'BEDCA / USDA (aproximado)'),
('Pavo (entero)', 'Proteína', 189, 20, 0, 11, 0, 0, 70, 3, 12, 1.4, 2.3, 'BEDCA / USDA (aproximado)'),
('Conejo', 'Proteína', 173, 21, 0, 9, 0, 0, 40, 2.7, 15, 1.3, 1.6, 'BEDCA / USDA (aproximado)'),
('Lubina', 'Proteína', 97, 18, 0, 2.5, 0, 0, 68, 0.6, 15, 0.3, 0.4, 'BEDCA / USDA (aproximado)'),
('Dorada', 'Proteína', 118, 19, 0, 4, 0, 0, 65, 1, 20, 0.5, 0.5, 'BEDCA / USDA (aproximado)'),
('Sardinas (en lata, al natural)', 'Proteína', 208, 25, 0, 11, 0, 0, 400, 1.5, 380, 2.9, 1.3, 'BEDCA / USDA (aproximado)'),
('Caballa', 'Proteína', 205, 19, 0, 14, 0, 0, 90, 3.3, 12, 1.6, 0.8, 'BEDCA / USDA (aproximado)'),
('Mejillones', 'Proteína', 86, 12, 3.7, 2.2, 0, 0, 286, 0.4, 26, 4, 1.6, 'BEDCA / USDA (aproximado)'),
('Calamar', 'Proteína', 92, 15.6, 3.1, 1.4, 0, 0, 44, 0.4, 32, 0.7, 1.5, 'BEDCA / USDA (aproximado)'),
('Pulpo (cocido)', 'Proteína', 82, 15, 2.2, 1, 0, 0, 230, 0.2, 106, 5.3, 1.7, 'BEDCA / USDA (aproximado)'),
('Tempeh', 'Proteína', 190, 20, 9, 11, 9, 0, 9, 2.3, 111, 2.7, 1.1, 'BEDCA / USDA (aproximado)'),
('Edamame', 'Proteína', 122, 11, 10, 5, 5, 2.2, 6, 0.6, 63, 2.3, 1, 'BEDCA / USDA (aproximado)'),
('Leche de almendra', 'Lácteo', 24, 0.5, 3, 1.1, 0.3, 2.5, 55, 0.1, 120, 0.3, 0.1, 'BEDCA / USDA (aproximado)'),
('Leche de avena', 'Lácteo', 47, 1, 7, 1.5, 0.8, 4, 55, 0.2, 120, 0.3, 0.1, 'BEDCA / USDA (aproximado)'),
('Skyr', 'Lácteo', 63, 11, 4, 0.2, 0, 4, 40, 0.1, 150, 0.1, 0.5, 'BEDCA / USDA (aproximado)'),
('Kéfir', 'Lácteo', 41, 3.3, 4.5, 1, 0, 4.5, 40, 0.6, 120, 0.1, 0.4, 'BEDCA / USDA (aproximado)'),
('Queso cottage', 'Lácteo', 98, 11, 3.4, 4.3, 0, 2.7, 364, 2.7, 83, 0.1, 0.4, 'BEDCA / USDA (aproximado)'),
('Nata para cocinar', 'Lácteo', 195, 2.5, 3, 20, 0, 3, 40, 12.5, 90, 0.1, 0.3, 'BEDCA / USDA (aproximado)'),
('Soja texturizada (seca)', 'Legumbre', 336, 52, 30, 1, 14, 8, 5, 0.2, 240, 8, 4, 'BEDCA / USDA (aproximado)'),
('Habas (cocidas)', 'Legumbre', 88, 7.6, 17, 0.4, 5, 1.8, 5, 0.1, 26, 1.5, 0.8, 'BEDCA / USDA (aproximado)'),
('Mantequilla', 'Grasa', 717, 0.9, 0.1, 81, 0, 0.1, 11, 51, 24, 0.02, 0.1, 'BEDCA / USDA (aproximado)'),
('Aceite de coco', 'Grasa', 862, 0, 0, 100, 0, 0, 0, 87, 1, 0.04, 0, 'BEDCA / USDA (aproximado)'),
('Semillas de chía', 'Grasa', 486, 17, 42, 31, 34, 0, 16, 3.3, 631, 7.7, 4.6, 'BEDCA / USDA (aproximado)'),
('Semillas de lino', 'Grasa', 534, 18, 29, 42, 27, 1.6, 30, 3.7, 255, 5.7, 4.3, 'BEDCA / USDA (aproximado)'),
('Semillas de girasol', 'Grasa', 584, 21, 20, 51, 8.6, 2.6, 9, 4.5, 78, 5.3, 5, 'BEDCA / USDA (aproximado)'),
('Tahini (crema de sésamo)', 'Grasa', 595, 17, 21, 54, 9.3, 0.5, 115, 7.5, 426, 9, 4.6, 'BEDCA / USDA (aproximado)'),
('Pistachos', 'Fruto seco', 560, 20, 28, 45, 10, 7.7, 1, 5.6, 105, 3.9, 2.2, 'BEDCA / USDA (aproximado)'),
('Avellanas', 'Fruto seco', 628, 15, 17, 61, 9.7, 4.3, 0, 4.5, 114, 4.7, 2.5, 'BEDCA / USDA (aproximado)'),
('Piñones', 'Fruto seco', 673, 14, 13, 68, 3.7, 3.6, 2, 4.9, 16, 5.5, 6.5, 'BEDCA / USDA (aproximado)'),
('Cacao puro en polvo', 'Otros', 228, 19.6, 57.9, 13.7, 37, 1.8, 21, 8, 128, 13.9, 6.8, 'BEDCA / USDA (aproximado)'),
('Creatina monohidrato', 'Suplemento', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'Fabricante (aproximado)'),
('Proteína vegetal (polvo)', 'Suplemento', 380, 75, 8, 5, 3, 1, 300, 1, 200, 8, 3, 'Fabricante (aproximado)');
