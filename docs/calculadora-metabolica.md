# Calculadora metabólica y reajuste: evaluación de seguridad y coherencia

Estado: **Fase A** (sin cambios de base de datos). Auditoría de partida: `origin/main` e026a3a, 2026-11-18.

## Qué hace y qué no

La calculadora metabólica (`src/lib/metabolicCalculator.ts`) y el reajuste del plan (`src/lib/dietAdjustment.ts`) comparten un
motor de evaluación (`src/lib/planSafety.ts`). Separa tres cosas:

1. **Calcular**: se calcula siempre que los datos valgan.
2. **Advertir**: señales visibles junto al resultado (`advertencia`).
3. **Validación profesional**: señales de `revision`. El resultado se muestra, pero para aplicarlo el profesional marca de forma
   explícita que lo ha revisado y lo valida con su criterio.
4. **Bloquear** (`bloqueo`): solo lo que no se puede calcular con sentido. No se presenta ningún resultado como aplicable.

**No hay un mínimo universal de calorías.** 1.200 kcal es un *umbral de revisión* interno, provisional y configurable. Por debajo
se pide revisión; por encima no se afirma nada. Ninguna señal es un diagnóstico ni una garantía de seguridad, y ningún texto de la
interfaz usa «límite seguro» (hay pruebas que lo vigilan).

Cada señal (`PlanSignal`) lleva: `code`, `severity` (`info | advertencia | revision | bloqueo`), `basis` (en qué se apoya),
`title`, `explanation` y `evidence` (los datos concretos que la disparan).

`basis` distingue: `aritmetica` (es una cuenta), `evidencia_solida`, `evidencia_limitada` y `decision_de_producto`.

## Fórmulas y fuentes

Estado de verificación de esta sesión (2026-11-18, búsqueda web; **no se han leído los artículos completos**).

| Elemento | Qué usa la app | Fuente | Estado |
|---|---|---|---|
| Mifflin-St Jeor | `10P + 6,25A − 5E + 5` (hombre) / `− 161` (mujer) | Mifflin et al., *Am J Clin Nutr* 1990;51(2):241-247, PMID 2305711. 498 personas sanas de 19 a 78 años (247 mujeres, 251 hombres; 264 de peso normal y 234 con obesidad), calorimetría indirecta. | **Verificada** (resumen). La muestra es de 19 a 78 años. |
| Harris-Benedict revisada | `88,362 + 13,397P + 4,799A − 5,677E` (h) / `447,593 + 9,247P + 3,098A − 4,330E` (m) | Roza y Shizgal, *Am J Clin Nutr* 1984;40(1):168-182 (PMID 6741850). | **Referencia verificada en resúmenes de búsqueda web. Los coeficientes NO se han verificado en la fuente primaria**: PubMed exigió cookies y no se pudo leer; coinciden con fuentes secundarias. Mifflin 1990 vio que la ecuación original de 1919 sobreestimaba un 5 % (resumen). |
| Katch-McArdle | `370 + 21,6 × masa magra` | **Fuente primaria NO localizada.** La única atribución encontrada es a libros de texto (McArdle, *Essentials of Exercise Physiology*, 3.ª ed., 2006, p. 266; Dunford y Doyle, *Nutrition for Sport and Exercise*, 2007), según la lista de referencias de Wikipedia. | **Evidencia limitada.** La relación con la ecuación de Cunningham (1980) **no está establecida**: una fuente consultada dice que ambas fórmulas son la misma y otra (LibreTexts) da `500 + 22 × masa magra` para Cunningham; no se ha podido contrastar con el artículo de Cunningham y **no se atribuye ninguna conclusión**. |
| Precisión de las ecuaciones | — | Frankenfield et al., *J Am Diet Assoc* 2005;105(5):775-789 (PMID 15883556). | **Solo la conclusión cualitativa**, tomada de resúmenes de búsqueda web: Mifflin-St Jeor es la ecuación que con más frecuencia queda dentro del 10 % de lo medido en adultos sanos con y sin obesidad, sin acertar siempre. **No se han verificado los porcentajes, el número de estudios ni las limitaciones** (PubMed exigió cookies). |
| Factores de actividad (1,2 / 1,375 / 1,55 / 1,725 / 1,9) | Multiplican la TMB | Convención de calculadoras derivada de Harris-Benedict. **No son** los PAL de FAO/OMS/UNU 2004. | **Convención, no evidencia.** Ver «Pendiente de decisión». |
| PAL de la FAO/OMS/UNU 2004 | (referencia, la app no los usa) | *Human energy requirements*, FAO Food and Nutrition Technical Report 1. Sedentario o ligero 1,40-1,69; activo o moderadamente activo 1,70-1,99; vigoroso 2,00-2,39. | Banda confirmada en un resumen de la FAO; la tabla del informe final no se ha recuperado. |
| Déficit −20 % / superávit +15 % | Fijos sobre el gasto total | — | **Decisión de producto**, sin fuente. |
| Fibra | 14 g por 1000 kcal | Ingesta Adecuada de las DRI del IOM (informe de 2002/2005). | **Verificada** como AI de las DRI. Usarla como objetivo del plan es decisión de producto. |
| 7700 kcal/kg (reajuste) | Pasa el ritmo de peso a kcal | Hall 2011 (crítica de la regla). | Verificada en la formación; el reajuste la amortigua a la mitad. |
| Energía en embarazo y lactancia | (la app no la modela) | EFSA 2013, *EFSA Journal* 11(1):3005: +70, +260 y +500 kcal/día en el 1.º, 2.º y 3.º trimestre; +500 kcal/día en lactancia exclusiva los primeros 6 meses. | Verificada en resúmenes; sirve solo para justificar por qué se pide valoración. |
| IMC < 18,5 en adultos | Señal contextual | Clasificación de bajo peso de la OMS. La OMS señala que el corte de 18,5 tiene menos validez para delgadez moderada o grave, pero es razonable mientras no haya más estudios; el IMC predice riesgo, no diagnostica. | Verificada en fuentes secundarias y en una página de la OMS. |
| Ecuaciones infantiles | (la app no las implementa) | FAO/OMS/UNU 1985 avala las de Schofield (sexo, edad y peso). | Existen. **No se ha verificado** una fuente que diga que las de adultos «no valen» por debajo de 18: bloquear a menores es una **decisión de producto** apoyada en que Mifflin se derivó de personas de 19 a 78 años. |

### Limitaciones de las ecuaciones predictivas

Estiman el gasto en reposo a partir de una muestra; en una persona concreta pueden errar de forma apreciable y no son una
medición (ni siquiera la mejor, Mifflin-St Jeor, acierta siempre dentro del 10 %). Toda la salida de la calculadora es **un punto de partida que valida el profesional**. El
factor de actividad y el déficit fijo añaden más incertidumbre que la TMB. La TMB comparada con el objetivo es una señal, no un
límite.

## Umbrales y justificación

Todos en `DEFAULT_REVIEW_THRESHOLDS` y `INPUT_RANGES` (`planSafety.ts`). Los de revisión se pueden sobrescribir por llamada
(`thresholds`); **todavía no hay pantalla de ajustes** para hacerlo (ver Fase B).

| Umbral | Valor | Qué dispara | Justificación |
|---|---|---|---|
| `minKcalReview` | 1.200 kcal | `OBJETIVO_BAJO_UMBRAL` (revisión) | **Decisión de producto**, provisional, heredada del reajuste. No es un mínimo de seguridad. |
| `bmrRatioReview` | 1 (objetivo < TMB) | `OBJETIVO_BAJO_TMB` (revisión) | Producto. Es lógico (consumir menos que el reposo estimado) pero la TMB tiene margen de error: por eso es una señal. Sedentario + déficit del 20 % da siempre 0,96 × TMB. |
| `minCarbsG` | 50 g | `CARBOHIDRATOS_BAJOS` (aviso) | Producto, heredado del reajuste. No es un límite clínico. |
| `bmiLow` | 18,5 kg/m² | `IMC_BAJO`: aviso, y revisión si el objetivo es perder peso | Clasificación de la OMS; solo adultos y solo como contexto. |
| `macroRoundingKcal` | 9 kcal (absoluta) | `MACROS_REDONDEO` (nota): los gramos enteros que se ven suman hasta 9 kcal más que el objetivo; más allá, `MACROS_NO_CUADRAN` | **Aritmética**: 0,5 g de proteína (2 kcal) + 0,5 g de hidratos (2) + 0,5 g de grasa (4,5) + 0,5 kcal del objetivo redondeado. Es la cota del redondeo a gramos enteros. |
| `macroTolerancePct` | 3 % (relativa) | `MACROS_NO_CUADRAN` (aviso) cuando los macros quedan POR DEBAJO del objetivo más de max(9 kcal, 3 %) | Producto: el mismo criterio que ya usa la pantalla del plan («Reparto: x % de las kcal (no suma 100)»). Antes era 5 % y no actuaba en ningún flujo. |
| `ADULT_AGE` | 18 años | `MENOR_DE_EDAD` (bloqueo) | Mayoría de edad; decisión de producto. |
| Muestra de Mifflin | 19-78 años | `EDAD_FUERA_DE_MUESTRA` (aviso, solo con Mifflin) | Mifflin 1990 (verificado). |
| Rangos de entrada | edad 0-110 (usual 18-100), peso 30-400 (usual 40-250), altura 100-250 (usual 140-210), % grasa 2-70 (usual 5-50) | Fuera del rango duro: `DATO_INVEROSIMIL` (bloqueo); fuera del usual: `DATO_INUSUAL` (aviso) | **Validación de entrada, no umbrales clínicos**: pillan metros escritos como centímetros o una edad de 200 años. |

## Señales

| Código | Gravedad | Cuándo |
|---|---|---|
| `SEXO_NO_INFORMADO` | bloqueo | Mifflin o Harris sin sexo (Katch no lo necesita). El sexo **no se supone**: solo se reconoce «mujer/femenino/hembra/female» y «hombre/masculino/varón/male»; «F», «M», «no binario» o vacío quedan sin informar. |
| `EDAD_AUSENTE`, `PESO_AUSENTE`, `ALTURA_AUSENTE`, `GRASA_AUSENTE` | bloqueo | Falta el dato (con Katch, % de grasa entre 0 y 100). En el reajuste (no estricto) solo se anota `EDAD_NO_CONSTA` como información. |
| `FECHA_NACIMIENTO_INVALIDA` | bloqueo si es futura | Fecha de nacimiento posterior a hoy o con formato inválido. |
| `EDAD_INCOHERENTE` | aviso | La edad escrita difiere en un año o más de la de la fecha de nacimiento. |
| `MENOR_DE_EDAD` | bloqueo | Menos de 18 años: no se usan las ecuaciones de adultos. |
| `EMBARAZO_LACTANCIA_PERDIDA_DE_PESO` | bloqueo | Embarazo o lactancia declarados con objetivo de déficit. |
| `EMBARAZO_LACTANCIA_REVISION` | revisión | Embarazo o lactancia declarados con otro objetivo. |
| `EMBARAZO_LACTANCIA_NO_CONSTA` | info | Persona adulta sin dato de embarazo o lactancia. **No depende del sexo ni del género de la ficha**: texto neutro («solo si te aplica»). |
| `DATO_INVEROSIMIL` / `DATO_INUSUAL` / `DATO_INVALIDO` | bloqueo / aviso / bloqueo | Rangos de entrada; actividad, objetivo o g/kg inválidos. |
| `IMC_BAJO` | aviso o revisión | Adulto con IMC < 18,5. |
| `OBJETIVO_BAJO_TMB`, `OBJETIVO_BAJO_UMBRAL` | revisión | Ver umbrales. |
| `CARBOHIDRATOS_BAJOS` | aviso | Menos de 50 g de hidratos. |
| `MACROS_INCOMPATIBLES` | **bloqueo** | Proteína + grasa (g/kg) superan las kcal del objetivo. |
| `MACROS_NO_CUADRAN` | aviso | Kcal y macros incoherentes: por encima del objetivo, más de lo que explica el redondeo (9 kcal); por debajo, más de max(9 kcal, 3 %). Se evalúa en la calculadora (gramos mostrados) y en los planes escritos a mano. |
| `MACROS_REDONDEO` | info | Los gramos enteros que se ven suman hasta 9 kcal más que el objetivo: es redondeo y se dice. |
| `ANAMNESIS_NO_COMPROBADA` | bloqueo (cargando) / revisión (error) | La lectura del cuestionario de salud está en curso o ha fallado. Un error NO se interpreta como «no hay embarazo ni lactancia». |

## Registro de umbrales (provisionales)

Responsable documental: **responsable del producto NutriFit**. Fecha propuesta de revisión: **18/02/2027** (todos los umbrales). Mientras
no exista una justificación suficiente, ninguno es un mínimo universal ni una garantía de seguridad.

| Umbral | Valor | Naturaleza | Justificación y límites | Revisión |
|---|---|---|---|---|
| Umbral de revisión de kcal | 1.200 | **Decisión de producto, provisional.** Señal de revisión, **nunca un mínimo universal** | Heredado del reajuste anterior, **sin fuente clínica**. Por debajo se pide revisión profesional; por encima no se afirma nada. Configurable por código (`thresholds.minKcalReview`); aún sin pantalla de ajustes. | 18/02/2027 |
| Hidratos | 50 g | **Decisión de producto.** Aviso interno, **nunca un mínimo universal** | Heredado del reajuste anterior, sin fuente clínica. Solo avisa. | 18/02/2027 |
| Objetivo frente a TMB | objetivo < TMB | Producto (con base aritmética) | La TMB estimada tiene margen de error individual: es una señal, no una medición. | 18/02/2027 |
| IMC bajo en adultos | 18,5 | Clasificación de la OMS (secundaria), solo contexto | No es un diagnóstico; revisar con la fuente primaria. | 18/02/2027 |
| Mayoría de edad / rangos de entrada | 18 años / ver tabla de umbrales | Producto | Validación de datos, no umbrales clínicos. | 18/02/2027 |
| Tolerancia de redondeo / de incoherencia | 9 kcal / 3 % | Aritmética / producto | Ver «Macros: dos tolerancias». | 18/02/2027 |

## Flujos: qué protege el motor y qué no

| Flujo | ¿Pasa por `planSafety`? | Cómo |
|---|---|---|
| Calculadora metabólica | Sí | Bloqueo o revisión; «Aplicar al plan» exige la confirmación visual cuando hay señales de revisión. |
| Reajuste del plan | Sí | Perfil, estado del cuestionario y umbrales; no propone mientras no pueda comprobar el embarazo o la lactancia. |
| Entrada manual de kcal y macros + guardar (`PlanDietaTab`) | Sí | Se evalúa el formulario; `decideSave` bloquea lo incompatible o incalculable y exige confirmar las señales de revisión **solo si los objetivos cambian** respecto a los guardados. La confirmación vale para la huella exacta del objetivo: si se cambia algo después, hay que confirmar de nuevo. |
| Aplicar una plantilla (interfaz) | Sí, **antes** de aplicarla | Se evalúa con los datos de hoy del cliente; se rechaza si queda bloqueada (menor, embarazo con déficit, macros incompatibles…). Con señales de revisión se aplica y se exige confirmar al guardar. |
| Restaurar una versión (interfaz) | Sí, **antes** de restaurar | Se evalúa en el diálogo de restauración; se bloquea o exige confirmar. Restaurar guarda en el servidor de inmediato, por eso la comprobación es previa. |
| **Fases con aplicación automática** (cron en el servidor, migración 0068: `apply_phase_template` → `save_diet_plan`) | **No** | **No pasan por el motor ni por ninguna comprobación de la app.** El cron no se ha modificado y **no se afirma que esté protegido**: aplica la plantilla de la fase cada mañana sin evaluar los datos actuales del cliente. Se ha añadido un aviso en la pantalla de fases. Protegerlo exige un cambio de servidor (función o esquema): fuera de este alcance. |
| `save_diet_plan` / `restore_plan_version` llamados directamente al servidor | No | El servidor **no valida rangos** (`save_diet_plan` acepta cualquier `numeric`): la protección es de la interfaz, no del servidor. |

No se ha revisado de forma exhaustiva ningún otro camino de escritura de objetivos distinto de los de la tabla.

## Macros: dos tolerancias

1. **Redondeo (absoluta, 9 kcal).** Los gramos se enseñan enteros: la suma de lo que ves puede diferir del objetivo. Por **encima**, hasta 9 kcal es redondeo (`MACROS_REDONDEO`, nota); más allá es incoherencia.
2. **Incoherencia energética.** Por encima del objetivo: lo que pase del redondeo. Por debajo: lo que pase de max(9 kcal, 3 %).

La calculadora evalúa los **gramos enteros mostrados**; la comparación «proteína + grasa por encima del objetivo» sigue usando las cuentas
exactas (con ellas, ningún reparto presentado supera el objetivo). **Cuantificación sobre la rejilla de 30.000 combinaciones** (adultos,
Mifflin; `MetabolicInput` en las pruebas): 2.872 (9,6 %) quedan bloqueadas por macros incompatibles y de las 27.128 presentadas, **12.857
(47,4 %) muestran gramos enteros que suman más que el objetivo mostrado**: 10.577 por 1-5 kcal y 2.280 por 6-8 kcal, máximo 8. **Todas
llevan ahora la nota `MACROS_REDONDEO`** (antes ninguna llevaba señal alguna).

## Confirmación visual no auditada

La casilla «Confirmación visual en pantalla, no auditada» **no genera ningún registro**: vive en el estado de la pantalla y no se guarda en
ningún sitio. **No es una validación profesional auditada ni promete trazabilidad.** `diet_plan_changes` registra el objetivo aprobado, quién y
cuándo, pero no las señales ni que se confirmó; `change_reason` es un texto libre y opcional que **no sustituye** a un registro completo y no
se rellena desde la confirmación. Un registro real (`plan_reviews`: señales, motivo obligatorio, versión del motor, umbrales, próxima
revisión, escrito dentro de `save_diet_plan`) queda para una fase posterior y necesita migración.

## Embarazo y lactancia: declarado y confirmado

- **Respuesta declarada por el cliente**: pregunta cerrada del cuestionario de salud («¿Estás ahora mismo en embarazo o en periodo de lactancia? (solo si te aplica)»), redactada en neutro, que se muestra a todas las personas. Se guarda en `anamnesis.answers` (RLS: la lee el nutricionista del cliente o un super administrador; el cliente la gestiona; se exporta y se borra con el cliente). El cliente puede cambiarla sin que quede historial.
- **Estado confirmado por el profesional**: **no existe**. En la calculadora el profesional puede elegirlo a mano (el selector parte de la respuesta del cliente), pero esa selección tampoco se guarda. Requiere la columna `clientes.reproductive_status` de la Fase B.
- **«No consta»** es una nota neutra para cualquier persona adulta, sin depender del sexo ni del género de la ficha.
- **Lectura del cuestionario con tres estados** (cargando, leído, error): un error de consulta **no** se interpreta como «no hay embarazo ni lactancia»; el reajuste no propone nada y la calculadora y el guardado piden revisión.

### Textos legales (`src/legal`): carencias detectadas, sin modificar

- `privacidad.md` (§3) y `clientes.md` citan «datos de salud» y «cuestionarios» de forma genérica, y `encargado.md` enumera categorías de salud, pero **ninguno menciona expresamente el embarazo o la lactancia** como dato tratado. Conviene valorar con asesoría jurídica si hace falta nombrarlo.
- Ningún texto dice que **un super administrador puede leer las respuestas** por las políticas RLS (`private.is_super_admin()`), mientras `privacidad.md` (§ de seguridad) afirma la separación de datos por profesional.
- No se han tocado `privacy`/`legal`: son borradores pendientes de revisión legal (`LEGAL_REVIEWED`).

## Cómo se integra

- **Calculadora** (`calculateMetabolicPlan`): devuelve `{ energy, plan, macros, evaluation }`. `plan` es `null` si algo bloquea
  (`computeMetabolicPlan` sigue existiendo como atajo y devuelve `plan`). Los hidratos ya **no se recortan a 0 en silencio**: si
  proteína y grasa exceden el objetivo, el reparto se marca incompatible y no se muestra ni se puede aplicar. En la pantalla: el
  sexo parte de la ficha solo si es inequívoco (si no, «Sin indicar»), hay un selector de embarazo/lactancia (parte de la
  respuesta del cuestionario), se listan las señales y, con señales de revisión, «Aplicar al plan» exige la casilla de validación.
- **Reajuste** (`suggestDietAdjustment`): acepta `profile` y `thresholds` opcionales; sin ellos funciona como antes. No propone
  reajustes automáticos para menores de 18 años ni con embarazo o lactancia declarados. Sigue sin **proponer** bajar de los
  umbrales de revisión, pero ya no dice «límite seguro»: dice «umbral de revisión interno… provisional y no garantiza seguridad».
  Devuelve `signals` sobre el plan o la propuesta, y la tarjeta evalúa también la cifra que edite el profesional.
- **Cuestionario de salud**: nueva pregunta cerrada `embarazo_lactancia` (se guarda en el JSON `answers`, **sin cambios de esquema**).

## Compatibilidad con planes existentes

- **No se modifica ni recalcula ningún plan guardado.** Todo ocurre en el momento de calcular o de proponer un reajuste.
- Para adultos con un objetivo habitual, **las cifras no cambian** (una prueba compara 30.000 combinaciones con la fórmula anterior).
- Los clientes sin respuesta a la pregunta nueva figuran como «no consta»: solo una nota informativa para mujeres adultas.
- Para los menores y los casos con embarazo o lactancia declarados, el reajuste pasa de proponer a explicar por qué no propone.

## Pendiente de decisión (no se ha cambiado)

- **Factores de actividad.** Son una convención de calculadoras y quedan por debajo de los PAL de la FAO para la misma persona
  (p. ej. 1,2 frente a la banda 1,40-1,69 del sedentario). Cambiarlos modifica **todas** las cifras: requiere decisión y fuente.
- **Déficit fijo del 20 %**, sin relación con el ritmo de pérdida deseado.
- **Planes escritos a mano**: ya pasan por el motor al guardar (ver «Flujos»). Lo que no hacen es quedar registrados: ver «Confirmación visual no auditada».

## Propuesta de migración (Fase B, **no aplicada ni preparada**)

Solo si se quiere ir más allá del cuestionario:

1. `clientes.reproductive_status text null check (reproductive_status in ('embarazo','lactancia','ninguno'))` y
   `reproductive_status_updated_at timestamptz`: dato estructurado confirmado por el profesional (la respuesta del cuestionario la da
   el cliente y puede estar desfasada). Hay que revisar `get_my_client_profile` y la exportación RGPD antes de exponerlo.
2. Tabla `plan_reviews` de solo inserción (plan, señales en `jsonb`, motivo, fecha de la próxima revisión, quién): registro de las
   validaciones profesionales. Necesita políticas RLS propias.
3. `nutricionistas.review_thresholds jsonb` (con fuente y revisor) para configurar los umbrales por profesional.

## Pruebas

`planSafety.test.ts`, `planSafety.redondeo.test.ts` (tolerancias, gramos enteros, estado del cuestionario), `planGuard.test.ts` (entrada manual,
huella, confirmación, plantillas y restauraciones), `metabolicCalculator.regresion.test.ts` (casos de la auditoría y rejilla de 30.000
combinaciones), `dietAdjustment.test.ts` y `dietAdjustment.anamnesis.test.ts`, `MetabolicCalculatorPanel*.test.tsx`, `ProfessionalConfirmation.test.tsx`
(la confirmación no se persiste) y `anamnesis.test.ts`. Sin navegador (no hay jsdom): el flujo con cifras (aplicar, guardar, confirmar) se
comprueba en la demo.
