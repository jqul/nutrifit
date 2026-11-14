# Módulo 4. Requerimientos energéticos y cálculos nutricionales

Leyenda: **[V]** verificado en esta formación · **[M]** de memoria, sin verificar · **[C]** comprobado ejecutando el código de NutriFit. Examen respondido por la IA, **sin corregir**.

## Objetivos
1. Calcular el gasto energético con varias ecuaciones y conocer su error.
2. Pasar del gasto al objetivo calórico y al reparto de macronutrientes.
3. Diseñar ajustes basados en la evolución real y no solo en la fórmula.
4. Auditar una calculadora: qué asume, qué ignora y qué muestra al usuario.

## Desarrollo

### Metabolismo basal frente a gasto en reposo
- Se llama **metabolismo basal (TMB)** al gasto en condiciones estrictas (reposo, ayuno de 12 h, termoneutralidad) y **gasto en reposo (GER)** a una medida menos restrictiva. En la práctica las ecuaciones predictivas se ajustan a medidas de reposo; llamarlas «TMB» es una simplificación común.
- La **calorimetría indirecta** mide el GER (consumo de O₂ y producción de CO₂). Es el método de referencia, pero pocas consultas la tienen.

### Ecuaciones predictivas
| Ecuación | Fórmula (kcal/día) | Notas |
|---|---|---|
| Mifflin-St Jeor (1990) **[V]** | varones: 10·P + 6,25·T − 5·E + 5; mujeres: 10·P + 6,25·T − 5·E − 161 (P en kg, T en cm, E en años) | muy usada; en revisiones de evidencia suele figurar entre las más ajustadas en población general **[M]** |
| Harris-Benedict revisada (Roza y Shizgal, 1984) **[V]** | varones: 88,362 + 13,397·P + 4,799·T − 5,677·E; mujeres: 447,593 + 9,247·P + 3,098·T − 4,330·E | las originales (1918-19) tienen otros coeficientes; la tendencia a sobrestimar se describe en la literatura **[M]** |
| Katch-McArdle **[C]** (en el código) | 370 + 21,6 × masa libre de grasa (kg) | necesita el % de grasa; el error de esa medida se traslada al resultado |
| Cunningham **[M]** | 500 + 22 × masa libre de grasa (kg) | alternativa en deportistas |
| Owen **[M]** | varones: 879 + 10,2·P; mujeres: 795 + 7,18·P | solo usa el peso |
| Schofield / FAO-OMS-UNU **[M]** | por grupos de edad y sexo, solo con el peso (y talla en algunos) | base de los informes de FAO/OMS; el informe de 2004 reúne el enfoque **[V]** |

- **Error:** son regresiones poblacionales. Un porcentaje apreciable de personas queda fuera de ±10 % del valor medido; no se puede dar la cifra como «el gasto» de nadie. Ninguna ecuación cubre bien a todos los grupos (muy musculados, obesidad grave, mayores, embarazo, niños).
- **Qué peso usar** en obesidad (real, ajustado, ideal) es **controvertido**; hay que explicitar la elección.

### De GER a gasto total
- **Gasto total = GER × factor de actividad**. FAO/OMS/UNU (2004) define el **nivel de actividad física (PAL)**: sedentario o ligero 1,40-1,69; activo o moderadamente activo 1,70-1,99; vigoroso 2,00-2,39; valores ≥2,40 son difíciles de mantener **[V]**.
- Las calculadoras de consulta suelen usar otra escala (1,2; 1,375; 1,55; 1,725; 1,9) heredada de la práctica clínica **[M]**. Son sistemas distintos: no se pueden mezclar valores de uno con el otro sin explicarlo.
- El factor de actividad es la parte más subjetiva del cálculo: depende de cómo la persona describe su día.

### Objetivo energético
- Se suele expresar como **porcentaje del gasto total** (p. ej. −20 %, +15 %) o como cifra fija (−300 a −500 kcal/día). Un porcentaje escala con el tamaño de la persona; una cifra fija no.
- **No existe un déficit «correcto» universal**: se elige con el objetivo, la adherencia, el tiempo disponible y el riesgo. Se vigilan suelos de seguridad (la práctica clínica suele evitar planes por debajo de unos 1.200 kcal/día salvo supervisión **[M]**; en NutriFit el propio reajuste usa 1.200 kcal como suelo **[C]**).
- La **respuesta real** (peso y medidas a las 2-4 semanas) corrige la estimación; ver Módulos 1 y 3.

### Macronutrientes
- **Proteína:** referencia para adultos 0,83 g/kg/día (EFSA) **[V]**; en deportistas y en déficit se usan rangos más altos (aprox. 1,2-2,0 g/kg, Módulo 9) **[M]**. En obesidad, calcular sobre el peso real puede dar cifras elevadas: criterio debatido.
- **Grasa:** el rango de referencia europeo ronda el 20-35 % de la energía, con grasa saturada «tan baja como sea posible» **[M]**.
- **Hidratos:** rango de referencia europeo ≈45-60 % de la energía **[M]**; azúcares libres por debajo del 10 % de la energía (OMS) **[M]**.
- **Reparto por restas:** fijar proteína y grasa por g/kg y dejar los hidratos como lo que queda es un método habitual; exige comprobar que el resto no sea negativo.
- **Fibra:** la referencia europea es una ingesta adecuada de unos 25 g/día para adultos **[M, sin confirmar]**; otra regla frecuente es 14 g por cada 1.000 kcal (IOM) **[M]**. Dan cifras distintas.
- **Agua:** la EFSA fija una ingesta adecuada de agua total (alimentos y bebidas) del orden de 2,0 L en mujeres y 2,5 L en varones **[M]**.

### Incertidumbre y ajuste
- Presentar el resultado como **rango y con el método**, y definir cuándo se revisa.
- Ajustar con tendencia, no con un pesaje; no cambiar dos cosas a la vez.
- La regla de 7.700 kcal/kg es una primera aproximación con amortiguación y límites **[V]** (Hall 2011).

## Fórmulas
- Gasto total = GER × factor de actividad.
- Objetivo = gasto total × (1 + ajuste).
- Proteína (g) = g/kg × peso; grasa (g) = g/kg × peso; hidratos (g) = (objetivo − 4·proteína − 9·grasa) ÷ 4.

## Errores frecuentes
1. Dar una ecuación como medición.
2. Mezclar factores de actividad de escalas distintas.
3. Aplicar una ecuación de adultos a menores o a embarazadas.
4. No comprobar que los macros sumen el objetivo.
5. Fijar el déficit por la fórmula sin mirar la evolución.
6. Calcular la proteína de una persona con obesidad sobre su peso real sin explicitar el criterio.

## Limitaciones y controversias
- Peso a usar en obesidad; validez en grupos concretos; si el déficit por porcentaje o por cifra fija es mejor; rango adecuado de proteína en déficit.

## Auditoría de la calculadora de NutriFit (`metabolicCalculator.ts` y su panel)
Comprobado ejecutando el código; **no se ha modificado nada**.
1. **Sin suelo energético [C]:** una mujer de 50 kg, 160 cm, 50 años, sedentaria y con déficit obtiene un objetivo de **1.045 kcal**. El reajuste del plan sí usa 1.200 kcal como mínimo; la calculadora no.
2. **Sin control de edad ni de situación [C]:** una persona de 17 años recibe el cálculo de adulto sin aviso; no existe embarazo, lactancia ni menores.
3. **Macros inconsistentes [C]:** con proteína 2,5 g/kg y grasa 1,5 g/kg para ese caso, proteína (125 g) y grasa (75 g) superan por sí solas el objetivo; el resultado muestra 0 g de hidratos y deja el objetivo en 1.045 kcal, de modo que la suma real de macros es mayor que ese objetivo.
4. **Escala de actividad no alineada con FAO/OMS/UNU:** 1,2-1,9 frente a 1,40-2,39 (no es un error, pero conviene explicitarlo).
5. **Fibra a 14 g por 1.000 kcal:** puede dar cifras bajas comparadas con una referencia de ≈25 g **[M]**.
6. **Presentación:** el panel muestra «TMB» y «Gasto total» como cifras exactas, sin rango ni aviso de que son estimaciones, y rellena por defecto proteína 2 g/kg y grasa 1 g/kg **[C]**.
7. **Lo que está bien:** permite elegir ecuación, usa coeficientes correctos (Mifflin y Harris revisada **[V]**), devuelve `null` si faltan datos o si Katch no tiene % de grasa, tiene tests de las fórmulas y deja la decisión final al nutricionista («Aplicar al plan»).

## Casos prácticos
Los del examen (secciones B y C).

## Bibliografía
**[V]**: Mifflin et al. 1990 y Roza y Shizgal 1984 (coeficientes comprobados en una fuente secundaria); FAO/OMS/UNU 2004, *Human Energy Requirements*; EFSA 2012 (proteína); Hall et al. 2011.
**[M]**: Frankenfield et al., revisión sobre ecuaciones predictivas del gasto en reposo (*J Am Diet Assoc*, 2005); Owen et al. 1986-87; Cunningham 1980; EFSA 2010 (grasas, hidratos y fibra, agua); OMS 2015, guía sobre azúcares; IOM, referencias de macronutrientes (fibra).

## Examen

### A. Teórico (6 preguntas)
1. Diferencia entre metabolismo basal y gasto en reposo.
2. Cita dos ecuaciones y sus limitaciones.
3. ¿Qué es el PAL y por qué no se mezclan escalas?
4. ¿Por qué no se debe dar un gasto como cifra exacta?
5. Ventajas e inconvenientes de un déficit en porcentaje frente a uno fijo.
6. ¿Qué dos comprobaciones harías antes de aplicar un reparto de macros calculado por restas?

### B. Aplicado (4 problemas)
1. Varón de 35 años, 80 kg, 178 cm, factor 1,55, déficit del −20 %, proteína 1,8 g/kg y grasa 0,8 g/kg: objetivo y reparto, con la fibra a 14 g por 1.000 kcal.
2. El mismo caso con Harris-Benedict revisada: GER y gasto total y diferencia con Mifflin.
3. El mismo caso con Katch-McArdle y un 20 % de grasa; repite con un 30 % para ver la sensibilidad.
4. Mujer de 50 años, 50 kg, 160 cm, sedentaria (factor 1,2) con déficit del −20 %: GER, gasto y objetivo; ¿qué problema aparece?

### C. Razonamiento (2 casos)
1. La calculadora de una aplicación da 1.045 kcal a una usuaria y ofrece «Aplicar al plan». Qué cambiarías y por qué.
2. Un cliente con obesidad grave pide calcular la proteína con su peso real (140 kg) a 2 g/kg. ¿Qué cuestionas?

## Respuestas de la IA (sin corregir)

**A1.** El metabolismo basal es el gasto en condiciones estrictas (reposo, ayuno de 12 h, termoneutralidad); el gasto en reposo se mide con condiciones menos restrictivas. Las ecuaciones suelen estar ajustadas a gasto en reposo, por lo que llamarlas «basal» es una simplificación.

**A2.** Mifflin-St Jeor: 10·P + 6,25·T − 5·E + 5 (varones) o −161 (mujeres); limitación: es una regresión poblacional, con error individual relevante y menos fiable en grupos extremos. Harris-Benedict revisada: coeficientes de Roza y Shizgal; tiende a sobrestimar según la literatura [M]. Ninguna es una medición.

**A3.** El nivel de actividad física (gasto total ÷ gasto basal) de FAO/OMS/UNU, con categorías de 1,40-1,69 (sedentario o ligero), 1,70-1,99 (activo) y 2,00-2,39 (vigoroso). No se mezclan escalas porque los factores de las calculadoras clínicas (1,2-1,9) se definieron con otro criterio y los mismos nombres no equivalen al mismo número.

**A4.** Porque es una estimación con error individual (cientos de kcal), el factor de actividad es subjetivo y el gasto real varía entre días y con el peso. Se presenta como rango, con el método y con un plan de revisión.

**A5.** Porcentaje: escala con el tamaño de la persona y es más simple de explicar; puede dar déficits grandes en gasto alto. Cifra fija: más controlable y comparable, pero un mismo número es mayor en términos relativos para una persona de bajo gasto. Ninguno es «correcto»; se elige con el objetivo y la adherencia.

**A6.** Que los hidratos resultantes no sean negativos ni tan bajos que el plan sea inviable, y que la suma de macros reproduzca el objetivo calórico; además, que la proteína y la grasa elegidas sean razonables para esa persona.

**B1.** GER (Mifflin) = 10·80 + 6,25·178 − 5·35 + 5 = 800 + 1.112,5 − 175 + 5 = 1.742,5 kcal. Gasto total = 1.742,5 × 1,55 ≈ 2.701 kcal. Objetivo = 2.701 × 0,8 ≈ 2.161 kcal. Proteína 1,8 × 80 = 144 g (576 kcal); grasa 0,8 × 80 = 64 g (576 kcal); hidratos = (2.161 − 1.152) ÷ 4 ≈ 252 g. Fibra = 14 × 2,161 ≈ 30 g. Reparto energético ≈ proteína 27 %, grasa 27 %, hidratos 47 %.

**B2.** GER = 88,362 + 13,397·80 + 4,799·178 − 5,677·35 = 88,362 + 1.071,76 + 854,22 − 198,70 ≈ 1.816 kcal. Gasto total = 1.816 × 1,55 ≈ 2.814 kcal. Diferencia con Mifflin ≈ +113 kcal (≈+4 %), dentro del error esperable entre ecuaciones.

**B3.** Con 20 % de grasa: masa libre de grasa = 64 kg → GER = 370 + 21,6·64 ≈ 1.752 kcal (muy cercano a Mifflin). Con 30 %: masa libre de grasa = 56 kg → 370 + 21,6·56 ≈ 1.580 kcal. Un error de 10 puntos en el % de grasa cambia el GER en ≈170 kcal (≈10 %): la precisión de Katch depende de la medida de composición corporal.

**B4.** GER = 10·50 + 6,25·160 − 5·50 − 161 = 500 + 1.000 − 250 − 161 = 1.089 kcal. Gasto total = 1.089 × 1,2 ≈ 1.307 kcal. Objetivo = 1.307 × 0,8 ≈ 1.045 kcal. Problema: queda por debajo del suelo habitual de 1.200 kcal; con ese objetivo, proteína 1,6 g/kg y grasa 1 g/kg dejan solo ≈69 g de hidratos. Habría que revisar el déficit (menor o fijo), mirar si el factor de actividad es realista y plantear supervisión.

**C1.** Añadiría un suelo energético con aviso (y no permitiría aplicar por debajo sin decisión explícita del profesional), mostraría el resultado como rango y con el método, avisaría de edad no adulta, embarazo, lactancia y otras situaciones fuera del alcance, y comprobaría que los macros sumen el objetivo antes de ofrecer «Aplicar». Se haría en una tarea de desarrollo con pruebas, no durante la formación.

**C2.** Cuestiono usar el peso real sin criterio: en obesidad grave, 2 g/kg sobre 140 kg son 280 g de proteína, una cifra muy alta y sin respaldo claro; los criterios más habituales usan peso ajustado o ideal o ajustan por masa libre de grasa, y la elección es debatida. Pediría el objetivo, la función renal si hay dudas, la composición corporal si está disponible y fijaría un rango razonado con la fuente, ajustándolo con la evolución.

## Criterios de corrección
- **Teórico:** 1 punto por respuesta correcta y completa; 0,5 incompleta; 0 con error conceptual grave.
- **Aplicado:** planteamiento, unidades y resultado; si usa una ecuación, que la escriba bien; supuestos explícitos.
- **Razonamiento:** identifica riesgos de seguridad, explicita la incertidumbre y propone una intervención proporcionada.
- **Nota:** teórico 40 %, aplicado 30 %, razonamiento 30 %. **La corrige el usuario.**

## Aplicaciones a NutriFit
- Todas las de la auditoría anterior, ordenadas por seguridad: (1) suelo energético y avisos de edad o embarazo; (2) coherencia de macros con el objetivo; (3) mostrar rango, método y límites; (4) alinear o explicar la escala de actividad; (5) revisar la fibra por defecto.
- Alinear `dietAdjustment.ts` y la calculadora para que compartan los mismos límites (suelo de 1.200 kcal, mínimo de hidratos).
- Guardar, junto a cada plan, **qué ecuación, qué factor de actividad y qué peso se usaron** para poder auditar y reproducir el cálculo.
