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
| Harris-Benedict revisada | `88,362 + 13,397P + 4,799A − 5,677E` (h) / `447,593 + 9,247P + 3,098A − 4,330E` (m) | Roza y Shizgal, *Am J Clin Nutr* 1984;40(1):168-182, PMID 6741850. n = 337. Precisión del 14 %. | **Autoría y dato verificados**; los coeficientes coinciden con fuentes secundarias, no con el artículo. Mifflin 1990 vio que la ecuación original de 1919 sobreestimaba un 5 %. |
| Katch-McArdle | `370 + 21,6 × masa magra` | Atribuida al manual McArdle, Katch y Katch (*Exercise Physiology*). | **Evidencia limitada**: no se ha localizado la fuente primaria. Cunningham propone `500 + 22 × masa magra`. |
| Precisión de las ecuaciones | — | Frankenfield et al., *J Am Diet Assoc* 2005;105(5):775-789: Mifflin-St Jeor es la ecuación que con más frecuencia queda dentro del 10 % de lo medido en adultos sanos con y sin obesidad, sin acertar siempre; ancianos y minorías están poco representados. | **Verificada** (resumen); los porcentajes por ecuación no se han recuperado. |
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
| `macroTolerancePct` | 5 % | `MACROS_NO_CUADRAN` (aviso) | Producto: absorbe el redondeo a gramos enteros. |
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
| `EMBARAZO_LACTANCIA_NO_CONSTA` | info | Mujer adulta sin dato de embarazo o lactancia. |
| `DATO_INVEROSIMIL` / `DATO_INUSUAL` / `DATO_INVALIDO` | bloqueo / aviso / bloqueo | Rangos de entrada; actividad, objetivo o g/kg inválidos. |
| `IMC_BAJO` | aviso o revisión | Adulto con IMC < 18,5. |
| `OBJETIVO_BAJO_TMB`, `OBJETIVO_BAJO_UMBRAL` | revisión | Ver umbrales. |
| `CARBOHIDRATOS_BAJOS` | aviso | Menos de 50 g de hidratos. |
| `MACROS_INCOMPATIBLES` | **bloqueo** | Proteína + grasa (g/kg) superan las kcal del objetivo. |
| `MACROS_NO_CUADRAN` | aviso | En planes escritos a mano, kcal y macros difieren más del 5 %. |

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
- **Planes escritos a mano**: los campos del plan no pasan por el motor (`MACROS_NO_CUADRAN` y las señales de umbral existen pero
  no están conectados a esa pantalla).

## Propuesta de migración (Fase B, **no aplicada ni preparada**)

Solo si se quiere ir más allá del cuestionario:

1. `clientes.reproductive_status text null check (reproductive_status in ('embarazo','lactancia','ninguno'))` y
   `reproductive_status_updated_at timestamptz`: dato estructurado confirmado por el profesional (la respuesta del cuestionario la da
   el cliente y puede estar desfasada). Hay que revisar `get_my_client_profile` y la exportación RGPD antes de exponerlo.
2. Tabla `plan_reviews` de solo inserción (plan, señales en `jsonb`, motivo, fecha de la próxima revisión, quién): registro de las
   validaciones profesionales. Necesita políticas RLS propias.
3. `nutricionistas.review_thresholds jsonb` (con fuente y revisor) para configurar los umbrales por profesional.

## Pruebas

`planSafety.test.ts`, `metabolicCalculator.regresion.test.ts` (casos de la auditoría y rejilla de 30.000 combinaciones),
`dietAdjustment.test.ts`, `MetabolicCalculatorPanel.test.tsx` y `anamnesis.test.ts`. Sin navegador (no hay jsdom): el flujo con
cifras (aplicar, confirmar) se comprueba en la demo.
