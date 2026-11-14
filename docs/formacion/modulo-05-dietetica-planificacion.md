# Módulo 5. Dietética y planificación alimentaria

Leyenda: **[V]** verificado en esta formación · **[M]** de memoria, sin verificar · **[C]** comprobado leyendo o ejecutando el código de NutriFit. Examen respondido por la IA, **sin corregir**.

## Objetivos
1. Diseñar un plan equilibrado, flexible y viable a partir de objetivos y datos de la persona.
2. Manejar raciones, pesos en crudo y cocinado, rendimientos y escalado.
3. Construir equivalencias y sustituciones que mantengan el propósito nutricional.
4. Adaptar un plan a preferencias, horarios, presupuesto y patrones de alimentación (mediterráneo, vegetariano, vegano).

## Desarrollo

### Principios de la planificación
- Un plan es un **instrumento de conducta**, no solo una tabla de cifras: debe ser aplicable por esa persona, en su vida, con su presupuesto y su cultura.
- **Orden de decisiones**: objetivo y energía (Módulo 4) → proteína y grasa → hidratos → fibra y micronutrientes → reparto en comidas → alimentos y recetas → flexibilidad.
- **Una dieta correcta en calorías y macros no es necesariamente adecuada**: hay que mirar micronutrientes, fibra, variedad, calidad de los alimentos, preferencias y contexto.
- **No restringir sin motivo**: eliminar grupos de alimentos requiere una razón (alergia, intolerancia, ética, decisión informada) y vigilar lo que se pierde.

### Distribución de comidas
- No hay un reparto único óptimo. Se parte de horarios, hambre y rutinas. Un reparto de día típico (p. ej. 25 % desayuno, 35 % comida, 10 % merienda, 30 % cena) es un punto de partida práctico **[C]** (así lo hace la propuesta de menú de NutriFit), no una regla.
- La **distribución de la proteína** a lo largo del día se estudia en deporte y en mayores (Módulos 9 y 10); la evidencia sobre un umbral por comida es limitada.

### Raciones, pesos y rendimientos
- **Ración** (cantidad estandarizada que se usa para planificar) distinta de **porción** (lo que se sirve la persona): conviene no confundirlas.
- **Peso en crudo y peso cocinado:** al cocinar cambian el agua y la grasa. Arroz o pasta cocidos pesan más que crudos (absorben agua); carnes y pescados cocinados pesan menos (pierden agua y grasa). Hay que indicar **siempre** en qué estado se pesa; mezclarlos es una fuente de error muy frecuente.
- **Porción comestible:** el peso «bruto» incluye huesos, piel o cáscara; las tablas de composición suelen referirse a la parte comestible.
- **Rendimiento culinario** = peso cocinado ÷ peso crudo. Los factores varían con el método y el tiempo; se usan los de una tabla fiable y se documenta la fuente.
- **Medidas caseras** (cucharada, vaso, taza, puñado): aproximadas y dependientes del alimento (una cucharada de aceite, de harina y de miel pesan distinto).

### Equivalencias y sustituciones
- **Listas de intercambio**: alimentos que cumplen el mismo papel y se cambian por «raciones» definidas por un nutriente clave (p. ej. 20 g de proteína, 25-30 g de hidratos, 10 g de grasa).
- Una buena sustitución mantiene el **propósito** (proteína, hidratos, grasa, fibra), la **energía** y el contexto (alergias, preferencias) y avisa de lo que cambia (un tofu equivalente en proteína puede traer más grasa o menos hierro biodisponible).
- Cuidado con equivalencias de un solo nutriente: igualar proteína no iguala el resto.

### Planificación y variedad
- Plan semanal, **variedad** de verduras, frutas, legumbres, cereales integrales, frutos secos, pescado y fuentes de proteína; **densidad energética** y **densidad nutricional**; **saciedad** (fibra, proteína, volumen).
- Lista de la compra, cocinado por lotes (batch cooking), sobras y presupuesto como parte del diseño.
- **Flexibilidad**: opciones por comida, días de entrenamiento y descanso, comidas fuera de casa y alcohol.

### Patrones de alimentación
- **Mediterránea:** patrón con buena evidencia observacional y algunos ensayos (p. ej. PREDIMED, cuyos resultados fueron revisados y republicados por un problema de aleatorización **[M]**). No es una dieta única, sino un patrón.
- **Vegetariana y vegana:** pueden ser adecuadas si están bien planificadas; atención a B12 (suplementación necesaria en veganos), hierro, zinc, yodo, calcio, vitamina D y ácidos grasos n-3 **[M]**; Módulo 7.
- **Dietas de exclusión** (sin gluten, sin lactosa…): solo cuando están justificadas; el «sin gluten» sin diagnóstico no es más saludable por sí mismo.

## Fórmulas y procedimientos
- **Escalar una receta**: factor = kcal objetivo ÷ kcal de la receta; cada ingrediente × factor.
- **Rendimiento** = peso cocinado ÷ peso crudo. **Peso crudo equivalente** = peso cocinado ÷ rendimiento.
- **Ración de intercambio**: gramos del alimento = cantidad objetivo del nutriente ÷ contenido del nutriente por gramo.
- **Sustitución por un macro**: gramos del sustituto = (macro del original) ÷ (macro por gramo del sustituto).

## Errores frecuentes
1. Mezclar pesos en crudo y cocinado.
2. Dar medidas caseras como si fueran exactas.
3. Sustituir igualando un solo macro sin avisar del resto.
4. Planificar variedad sin comprobar la compra y el tiempo reales.
5. Eliminar grupos de alimentos «por si acaso».
6. Ignorar el presupuesto y la cultura de la persona.

## Limitaciones y controversias
- Reparto óptimo de comidas y de la proteína; utilidad real de las listas de intercambio frente al conteo; calidad de la evidencia de los patrones (observacional frente a ensayos).

## Qué hace NutriFit hoy (leído en el código) [C]
- **Intercambios** (`exchangeGroups.ts`): nueve grupos con una ración por un nutriente clave (p. ej. 20 g de proteína, 30 g de hidratos, 10 g de grasa). El propio código aclara que son una convención práctica de la app, no una tabla oficial.
- **Sustituciones**: se puede igualar proteína, hidratos, grasa o energía; el orden de sugerencias minimiza la desviación de los otros macros, y se excluyen alergias y alimentos que el cliente no quiere.
- **Propuesta de menú** (`menuProposal.ts`): reparte las kcal en comidas y elige para cada una una receta propia, escalada con un factor entre 0,5 y 2; sin IA.
- **Medidas caseras** (`foodConversion.ts`): cucharada = 15 g, cucharadita = 5 g, taza = 240 g, vaso = 200 g, puñado = 30 g, y **ml = g**, para cualquier alimento. «Unidad» no es convertible.
- **Lista de la compra** generada a partir del plan.

## Hallazgos de este módulo (sin cambios hechos)
1. **Conversión de medidas caseras a gramos con un único valor por unidad:** una cucharada de aceite de oliva pesa unos 13-14 g y la de miel, bastante más de 15 g **[M]**; ml = g es incorrecto para aceites, miel o leche (densidad ≠ 1). El error es pequeño por ración, pero se acumula y es invisible para el usuario.
2. **El catálogo guarda alimentos cocinados como alimentos separados** (por ejemplo «Arroz integral (cocido)»), pero no hay un **factor de rendimiento** para pasar del peso crudo al cocinado ni una indicación obligatoria de si el peso es crudo o cocinado en el ítem del plan.
3. **Los tamaños de ración de intercambio** son propios de la app; conviene documentarlos y compararlos con una referencia (por ejemplo las raciones de las guías de la Sociedad Española de Nutrición Comunitaria) antes de presentarlos como estándar **[M]**.

## Casos prácticos
Los del examen (secciones B y C).

## Bibliografía
**[M]**: Guías alimentarias de la SENC; AESAN, ingestas de referencia y guías; Estruch et al., ensayo PREDIMED (*N Engl J Med* 2013, republicado 2018); posicionamiento de la Academy of Nutrition and Dietetics sobre dietas vegetarianas (2016); manuales de dietética (Krause; Mataix; Gil, *Tratado de nutrición*).

## Examen

### A. Teórico (6 preguntas)
1. Diferencia entre ración y porción.
2. ¿Por qué es esencial indicar si un peso es en crudo o cocinado?
3. ¿Qué mantiene una buena sustitución alimentaria y qué debe avisar?
4. Dos riesgos de una dieta vegana mal planificada.
5. Por qué «cumplir calorías y macros» no basta para decir que una dieta es adecuada.
6. Ventajas y límites de las listas de intercambio.

### B. Aplicado (3 problemas)
1. 80 g de arroz crudo rinden 200 g cocidos. Calcula el rendimiento y cuántos gramos de arroz crudo corresponden a 250 g cocidos.
2. Una receta aporta 620 kcal y el hueco de la comida es de 700 kcal: factor de escalado y si encaja en el rango 0,5-2.
3. 150 g de pollo con 31 g de proteína por 100 g: ¿cuántos gramos de tofu (8 g de proteína por 100 g) igualan la proteína? ¿Qué otro macro habrá que revisar?

### C. Razonamiento (2 casos)
1. Una clienta pesa el arroz cocinado pero su plan está calculado con peso crudo. ¿Qué consecuencias tiene y cómo lo resolverías en el producto?
2. Un cliente vegano quiere «igualar la proteína» con cereales y legumbres. ¿Qué compruebas además?

## Respuestas de la IA (sin corregir)

**A1.** La ración es una cantidad estandarizada que se usa para planificar y comparar; la porción es lo que realmente se sirve cada persona, que puede ser mayor o menor que la ración.

**A2.** Porque el cocinado cambia el peso (agua y grasa): el arroz o la pasta cocidos pesan más que crudos y la carne cocinada menos. Mezclar estados produce errores grandes de energía (un plato de arroz cocido pesado como si fuera crudo infravalora la energía por gramo y a la inversa).

**A3.** Mantiene el propósito nutricional (proteína, hidratos, grasa y fibra de un grupo), la energía aproximada y el contexto (alergias, preferencias, cultura). Debe avisar de lo que cambia: grasa o hidratos extra, micronutrientes, saciedad o preparación.

**A4.** Déficit de vitamina B12 si no se suplementa, y riesgo de ingestas bajas de hierro, zinc, yodo, calcio, vitamina D y ácidos grasos n-3 [M].

**A5.** Porque una dieta puede cumplir energía y macros y aun así ser pobre en fibra, hierro, calcio o vitaminas, poco variada, difícil de seguir o inadecuada para las preferencias de la persona; la adecuación incluye micronutrientes, calidad, variedad y contexto.

**A6.** Ventajas: simples, flexibles y fáciles de enseñar. Límites: cada grupo se define por un nutriente y las demás diferencias se pierden, los tamaños de ración son una convención, y exigen que la persona entienda el sistema.

**B1.** Rendimiento = 200 ÷ 80 = 2,5. 250 g cocidos ÷ 2,5 = 100 g de arroz crudo.

**B2.** Factor = 700 ÷ 620 ≈ 1,13. Entra en el rango 0,5-2 (aumento del 13 %).

**B3.** Proteína del pollo = 31 × 1,5 = 46,5 g. Tofu: 46,5 ÷ 0,08 = 581 g. Cantidad muy grande (para igualar solo la proteína); habrá que revisar la energía y la grasa, que cambian de forma notable (con 76 kcal y 4,8 g de grasa por 100 g en el catálogo, 581 g de tofu darían ≈440 kcal y ≈28 g de grasa frente a ≈250 kcal y ≈5 g del pollo). Probablemente convenga combinar con otra fuente proteica.

**C1.** Si el plan indica 100 g de arroz crudo y ella pesa 100 g cocidos, toma menos de la mitad de la energía prevista (y lo contrario si invierte el error), lo que distorsiona el seguimiento y la evolución. Se resolvería con: indicación obligatoria de «crudo» o «cocinado» en cada ítem, mostrar la equivalencia (80 g crudo ≈ 200 g cocido) y un factor de rendimiento por alimento con fuente. Es una propuesta de desarrollo; no se ha implementado.

**C2.** Compruebo que se cubren los aminoácidos limitantes (cereales y legumbres se complementan), la energía y la grasa del plato, y los micronutrientes críticos (B12, hierro, zinc, yodo, calcio, vitamina D, n-3); además cuestiono si igualar solo la proteína es el objetivo y reviso la tolerancia digestiva a la fibra de las legumbres.

## Criterios de corrección
- **Teórico:** 1 punto por respuesta correcta y completa; 0,5 incompleta; 0 con error conceptual grave.
- **Aplicado:** planteamiento, unidades y resultado; análisis del macro no igualado.
- **Razonamiento:** identifica la consecuencia práctica y propone una solución proporcionada y verificable.
- **Nota:** teórico 40 %, aplicado 30 %, razonamiento 30 %. **La corrige el usuario.**

## Aplicaciones a NutriFit
- Estado crudo/cocinado explícito en cada ítem y factores de rendimiento con fuente (mejora de seguridad de cálculo).
- Conversión de medidas caseras **por alimento** (densidad) en lugar de una tabla única, o avisar de que es aproximada.
- Documentar y revisar los tamaños de ración de los grupos de intercambio y mostrar, al sustituir, el resto de nutrientes que cambian (ya se muestran las diferencias de energía y macros; ampliar a fibra y micronutrientes cuando existan datos).
- Mostrar la variedad semanal de un plan (grupos de alimentos cubiertos) como ayuda de revisión, sin puntuarla.
