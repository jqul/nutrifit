-- Recetas predeterminadas: una biblioteca de recetas del sistema (no ligadas a
-- ningún nutricionista) que cualquiera puede consultar e insertar en un plan,
-- igual que sus propias recetas guardadas — a petición de un nutricionista:
-- un punto de partida además de sus propias recetas, no en sustitución.

alter table recipes alter column nutricionista_id drop not null;

-- La política "for all" ya existente exige nutricionista_id = auth.uid() para
-- insertar/editar/borrar (así que las recetas del sistema, con
-- nutricionista_id null, quedan protegidas de escritura para cualquiera que
-- no sea super_admin) — esta política adicional solo abre la lectura.
create policy todos_leen_recetas_del_sistema on recipes for select
  using (nutricionista_id is null);

insert into recipes (nutricionista_id, name, items) values
(null, 'Bowl de avena con plátano y almendras', '[
  {"id":"pr1-1","foodName":"Avena","quantity":"50","unit":"g","kcal":"195","proteinG":"8.5","carbsG":"33","fatG":"3.5","fiberG":"5.1","sugarG":"0.5","sodiumMg":"1","saturatedFatG":"0.7","calciumMg":"27","ironMg":"2.2","zincMg":"2"},
  {"id":"pr1-2","foodName":"Plátano","quantity":"100","unit":"g","kcal":"89","proteinG":"1.1","carbsG":"23","fatG":"0.3","fiberG":"2.6","sugarG":"12.2","sodiumMg":"1","saturatedFatG":"0.1","calciumMg":"5","ironMg":"0.3","zincMg":"0.2"},
  {"id":"pr1-3","foodName":"Almendras","quantity":"15","unit":"g","kcal":"87","proteinG":"3.2","carbsG":"3.3","fatG":"7.5","fiberG":"1.9","sugarG":"0.7","sodiumMg":"0.2","saturatedFatG":"0.6","calciumMg":"40","ironMg":"0.6","zincMg":"0.5"},
  {"id":"pr1-4","foodName":"Yogur griego","quantity":"150","unit":"g","kcal":"146","proteinG":"13.5","carbsG":"6","fatG":"7.5","fiberG":"0","sugarG":"6","sodiumMg":"54","saturatedFatG":"4.8","calciumMg":"165","ironMg":"0.2","zincMg":"0.8"}
]'::jsonb),
(null, 'Pollo con arroz integral y brócoli', '[
  {"id":"pr2-1","foodName":"Pechuga de pollo","quantity":"150","unit":"g","kcal":"248","proteinG":"46.5","carbsG":"0","fatG":"5.4","fiberG":"0","sugarG":"0","sodiumMg":"111","saturatedFatG":"1.5","calciumMg":"9","ironMg":"0.6","zincMg":"1.1"},
  {"id":"pr2-2","foodName":"Arroz integral (cocido)","quantity":"150","unit":"g","kcal":"167","proteinG":"3.9","carbsG":"34.5","fatG":"1.4","fiberG":"2.7","sugarG":"0.3","sodiumMg":"3","saturatedFatG":"0.3","calciumMg":"6","ironMg":"0.6","zincMg":"0.9"},
  {"id":"pr2-3","foodName":"Brócoli","quantity":"150","unit":"g","kcal":"51","proteinG":"4.2","carbsG":"10.5","fatG":"0.6","fiberG":"3.9","sugarG":"2.6","sodiumMg":"50","saturatedFatG":"0.2","calciumMg":"71","ironMg":"1.1","zincMg":"0.6"},
  {"id":"pr2-4","foodName":"Aceite de oliva","quantity":"10","unit":"g","kcal":"88","proteinG":"0","carbsG":"0","fatG":"10","fiberG":"0","sugarG":"0","sodiumMg":"0","saturatedFatG":"1.4","calciumMg":"0.1","ironMg":"0.1","zincMg":"0"}
]'::jsonb),
(null, 'Boloñesa de pasta integral con carne', '[
  {"id":"pr3-1","foodName":"Pasta integral (cocida)","quantity":"200","unit":"g","kcal":"248","proteinG":"10.6","carbsG":"50","fatG":"2.2","fiberG":"9","sugarG":"1.4","sodiumMg":"6","saturatedFatG":"0.4","calciumMg":"26","ironMg":"2.6","zincMg":"2"},
  {"id":"pr3-2","foodName":"Ternera magra (picada)","quantity":"150","unit":"g","kcal":"258","proteinG":"40.5","carbsG":"0","fatG":"10.5","fiberG":"0","sugarG":"0","sodiumMg":"98","saturatedFatG":"4.5","calciumMg":"12","ironMg":"3.2","zincMg":"6"},
  {"id":"pr3-3","foodName":"Tomate (triturado)","quantity":"200","unit":"g","kcal":"36","proteinG":"1.8","carbsG":"7.8","fatG":"0.4","fiberG":"2.4","sugarG":"5.2","sodiumMg":"10","saturatedFatG":"0","calciumMg":"20","ironMg":"0.6","zincMg":"0.4"},
  {"id":"pr3-4","foodName":"Cebolla","quantity":"50","unit":"g","kcal":"20","proteinG":"0.6","carbsG":"4.7","fatG":"0.1","fiberG":"0.9","sugarG":"2.1","sodiumMg":"2","saturatedFatG":"0","calciumMg":"12","ironMg":"0.1","zincMg":"0.1"},
  {"id":"pr3-5","foodName":"Aceite de oliva","quantity":"10","unit":"g","kcal":"88","proteinG":"0","carbsG":"0","fatG":"10","fiberG":"0","sugarG":"0","sodiumMg":"0","saturatedFatG":"1.4","calciumMg":"0.1","ironMg":"0.1","zincMg":"0"}
]'::jsonb),
(null, 'Boloñesa de pasta integral con tofu (plant-based)', '[
  {"id":"pr4-1","foodName":"Pasta integral (cocida)","quantity":"200","unit":"g","kcal":"248","proteinG":"10.6","carbsG":"50","fatG":"2.2","fiberG":"9","sugarG":"1.4","sodiumMg":"6","saturatedFatG":"0.4","calciumMg":"26","ironMg":"2.6","zincMg":"2"},
  {"id":"pr4-2","foodName":"Tofu (desmenuzado)","quantity":"200","unit":"g","kcal":"152","proteinG":"16","carbsG":"3.8","fatG":"9.6","fiberG":"0.6","sugarG":"1.2","sodiumMg":"14","saturatedFatG":"1.4","calciumMg":"700","ironMg":"10.8","zincMg":"1.6"},
  {"id":"pr4-3","foodName":"Tomate (triturado)","quantity":"200","unit":"g","kcal":"36","proteinG":"1.8","carbsG":"7.8","fatG":"0.4","fiberG":"2.4","sugarG":"5.2","sodiumMg":"10","saturatedFatG":"0","calciumMg":"20","ironMg":"0.6","zincMg":"0.4"},
  {"id":"pr4-4","foodName":"Cebolla","quantity":"50","unit":"g","kcal":"20","proteinG":"0.6","carbsG":"4.7","fatG":"0.1","fiberG":"0.9","sugarG":"2.1","sodiumMg":"2","saturatedFatG":"0","calciumMg":"12","ironMg":"0.1","zincMg":"0.1"},
  {"id":"pr4-5","foodName":"Aceite de oliva","quantity":"10","unit":"g","kcal":"88","proteinG":"0","carbsG":"0","fatG":"10","fiberG":"0","sugarG":"0","sodiumMg":"0","saturatedFatG":"1.4","calciumMg":"0.1","ironMg":"0.1","zincMg":"0"}
]'::jsonb),
(null, 'Ensalada de garbanzos con aguacate', '[
  {"id":"pr5-1","foodName":"Garbanzos (cocidos)","quantity":"150","unit":"g","kcal":"246","proteinG":"13.5","carbsG":"40.5","fatG":"3.9","fiberG":"11.4","sugarG":"7.2","sodiumMg":"11","saturatedFatG":"0.5","calciumMg":"74","ironMg":"4.4","zincMg":"2.3"},
  {"id":"pr5-2","foodName":"Espinacas","quantity":"50","unit":"g","kcal":"12","proteinG":"1.5","carbsG":"1.8","fatG":"0.2","fiberG":"1.1","sugarG":"0.2","sodiumMg":"40","saturatedFatG":"0.1","calciumMg":"50","ironMg":"1.4","zincMg":"0.3"},
  {"id":"pr5-3","foodName":"Zanahoria","quantity":"80","unit":"g","kcal":"33","proteinG":"0.7","carbsG":"8","fatG":"0.2","fiberG":"2.2","sugarG":"3.8","sodiumMg":"55","saturatedFatG":"0.1","calciumMg":"26","ironMg":"0.2","zincMg":"0.2"},
  {"id":"pr5-4","foodName":"Aguacate","quantity":"50","unit":"g","kcal":"80","proteinG":"1","carbsG":"4.3","fatG":"7.5","fiberG":"3.4","sugarG":"0.4","sodiumMg":"4","saturatedFatG":"1.1","calciumMg":"6","ironMg":"0.3","zincMg":"0.3"},
  {"id":"pr5-5","foodName":"Aceite de oliva","quantity":"10","unit":"g","kcal":"88","proteinG":"0","carbsG":"0","fatG":"10","fiberG":"0","sugarG":"0","sodiumMg":"0","saturatedFatG":"1.4","calciumMg":"0.1","ironMg":"0.1","zincMg":"0"}
]'::jsonb);
