# Informe de discrepancias: respuestas de embarazo y lactancia (anamnesis) frente a permisos reales y textos legales

Fecha: 2026-11-19. Rama `feat/calculadora-evaluacion` (PR #34, borrador).

**Qué es este informe.** Una comparación de hechos técnicos con lo que dicen los borradores de textos legales. **No afirma que ninguna
práctica cumpla o incumpla la normativa de protección de datos y no inventa obligaciones ni cláusulas.** Los puntos que dependen de una
valoración jurídica están marcados «REVISIÓN DE ESPECIALISTA». No se ha modificado `privacidad.md`, `clientes.md` ni `encargado.md`
(son borradores: `LEGAL_REVIEWED = false` en `src/legal/entity.ts`).

**Método.** Lectura (solo lectura) de las políticas de seguridad por fila (RLS) y de las funciones `private.*` en la base de datos de
producción el 2026-11-19 (`pg_policies`, `pg_get_functiondef`), del código de la rama y de los textos de `src/legal`. No se ha leído ni
modificado ningún dato de clientes: solo recuentos (p. ej. filas de `anamnesis`).

## 1. Hechos técnicos comprobados

| # | Hecho | Fuente |
|---|---|---|
| T1 | Las respuestas del cuestionario de salud, incluida la pregunta `embarazo_lactancia`, se guardan en `public.anamnesis.answers` (`jsonb`, una fila por cliente, borrado en cascada desde `clientes`). | Migración 0009 |
| T2 | **Lectura:** `nutricionista_reads_anamnesis` (SELECT) permite `is_nutricionista_of_client(client_id) OR is_super_admin()`. **Gestión por el cliente:** `client_manages_own_anamnesis` (ALL) permite `is_owner_client(client_id)`. | `pg_policies`, producción |
| T3 | `private.is_super_admin()` es verdadero si la persona autenticada tiene `role = 'super_admin'` en `nutricionistas`. Hoy hay **1** cuenta con ese rol y **3** con rol `trainer`. | `pg_get_functiondef`, recuento |
| T4 | Ese mismo rol puede además **leer y escribir** `clientes` (`nutricionista_owns_clientes`, ALL) y `diet_plans` (`nutricionista_manages_diet_plans`, ALL), y leer `diet_plan_changes` y `diet_plan_versions`. | `pg_policies` |
| T5 | Un profesional con rol `trainer` solo cumple `is_nutricionista_of_client` para los clientes cuyo `nutricionista_id` es el suyo (`clientes.nutricionista_id = auth.uid()`). | `pg_get_functiondef` |
| T6 | **Historial de cambios de las respuestas: ninguno.** El cliente puede cambiar «Embarazo» por «No» y solo queda `updated_at`. No existe un estado «confirmado por el profesional». | Migración 0009, código |
| T7 | Hoy hay **0** filas de `anamnesis` con la clave `embarazo_lactancia` (la pregunta no se ha publicado). | Recuento |
| T8 | La respuesta la ve el profesional en la ficha (`PerfilTab`) y la **usa la aplicación de forma automática**: con embarazo o lactancia declarados no se genera un objetivo de pérdida de peso ni se proponen reajustes (calculadora, reajuste, guarda de guardado, plantillas y restauraciones). | Código (PR #34) |
| T9 | **Exportación:** `anamnesis` figura en `EXPORT_TABLES` y hay una prueba que exige que toda tabla con `client_id` esté en la exportación o en una lista de exclusiones con motivo. **Eliminación:** la función de borde `delete-client` borra la ficha (con cascada), los ficheros y la cuenta de acceso; la puede invocar el nutricionista del cliente o el super administrador. | `clientExport.ts`, `delete-client/index.ts` |
| T10 | **Registros y analíticas:** no hay analíticas de terceros (una prueba legal lo vigila); las funciones de borde no leen `anamnesis`; los registros de la API de Supabase no conservaron el cuerpo de las peticiones en una comprobación hecha con una escritura real (el `PATCH` de una receta). Lo que sí consta en esos registros es la URL (con identificadores de cliente), no las respuestas. | Código, registros |
| T11 | Lo que ve la persona al rellenar el cuestionario: «Ayuda a tu nutricionista a conocerte mejor antes de la primera consulta» (o, en cuenta personal, «Te ayuda a tener claro tu punto de partida»). **No dice** que una respuesta concreta se use para activar reglas automáticas, ni quién más puede leerla. | `AnamnesisForm.tsx` |

## 2. Textos legales (borradores) y puntos de contraste

| # | Qué dice el texto | Contraste con los hechos | ¿Revisión de especialista? |
|---|---|---|---|
| D1 | `privacidad.md` (seguridad) y `encargado.md`: «separación de datos por profesional: cada profesional solo accede a los datos de sus clientes y cada cliente, solo a los suyos». | Es coherente con T5 para los profesionales con rol `trainer`. **No menciona** que el rol `super_admin` puede leer y escribir todas las filas (T2, T4). | **Sí** |
| D2 | «Acceso del personal de NutriFit limitado a lo necesario para el soporte y bajo deber de confidencialidad.» | Técnicamente el acceso del super administrador **no está limitado por la base de datos** a lo necesario: la política permite todas las filas (T2). Cualquier limitación es organizativa, no técnica. **No consta** (no se ha verificado) que sus lecturas de `anamnesis` queden registradas: el registro de accesos (`access_log`, migración 0071) se escribe mediante una función que comprueba que quien llama es el nutricionista del cliente. | **Sí** |
| D3 | `clientes.md` (§2) lista «cuestionarios» entre los datos de salud; `encargado.md` lista «cuestionarios» y marca que hay datos de categoría especial. | La categoría genérica abarca esta pregunta, pero **ningún texto nombra el embarazo ni la lactancia** como dato tratado (el ciclo menstrual sí se nombra). | **Sí** |
| D4 | Ningún texto describe el uso automatizado de la respuesta (T8). | La respuesta no solo se almacena y se muestra: activa reglas que bloquean objetivos y reajustes. Los textos del cuestionario (T11) tampoco lo explican. Es una ayuda a la decisión del profesional, no sustituye su criterio. | **Sí** (si procede informarlo y cómo) |
| D5 | `encargado.md`: la plataforma permite «exportar y eliminar por completo» los datos de un cliente. | Coherente con T9 para `anamnesis`. **No se ha comprobado** la retención en copias de seguridad ni en los registros de Supabase (no hay información en el repositorio). El texto habla de suprimir «incluidas las copias» en un plazo con variable sin rellenar (`{{plazo_supresion}}`). | **Sí** (copias y plazos) |
| D6 | `privacidad.md` §3 y `encargado.md`: el profesional es el responsable y debe informar a sus clientes y obtener las bases legales. | La pregunta se muestra a **todas las personas** que rellenan el cuestionario (T11), con la opción «No (o no me aplica)». Si debe preguntarse solo cuando proceda es una cuestión de minimización que no se ha valorado. | **Sí** |
| D7 | `privacidad.md` §9 (menores): el servicio es para profesionales mayores de edad y la autorización para tratar datos de menores se traslada al profesional. | La calculadora y el reajuste bloquean a menores de 18 años como decisión de producto (no por una norma). Es independiente de lo que dice el texto. | Informativo |

## 3. Respuesta declarada por el cliente frente a estado confirmado por el profesional

- **Declarada:** pregunta cerrada en `anamnesis.answers`; la escribe y puede cambiar el cliente; sin historial (T6).
- **Seleccionada por el profesional en la calculadora:** se usa para ese cálculo y **no se guarda en ningún sitio**.
- **Confirmada y guardada por el profesional:** **no existe.** Requeriría una columna en `clientes` (propuesta en `docs/calculadora-metabolica.md`, Fase B,
  no preparada) y decidir qué hacer cuando ambos valores discrepan.
- La aplicación trata un **error de lectura** del cuestionario como «no comprobado», no como «no hay embarazo ni lactancia».

## 4. Lo que NO se ha comprobado

- Aislamiento entre dos profesionales con **sesiones reales** (solo se ha leído el texto de las políticas).
- Si las lecturas del super administrador sobre `anamnesis` quedan registradas en algún sitio.
- Retención de datos en copias de seguridad y en los registros de la plataforma.
- El contenido final de los textos legales (son borradores sin revisar).

## 5. Puntos que requieren a un especialista en protección de datos

1. Cómo describir (y si hay que limitar técnicamente o registrar) el acceso del rol `super_admin` a datos de salud (D1, D2).
2. Si hay que nombrar expresamente el embarazo y la lactancia entre las categorías de datos de salud (D3).
3. Si hay que informar a la persona del uso automatizado de esa respuesta, y en qué términos (D4).
4. Copias de seguridad, plazos de supresión y la variable `{{plazo_supresion}}` (D5).
5. Minimización: preguntar a todas las personas o solo cuando proceda (D6).
6. Reparto de responsabilidades entre profesional y plataforma para este dato concreto.

Este informe no sustituye ese asesoramiento y no debe leerse como una declaración de cumplimiento.
