# Módulo 6. Bases de datos de alimentos y composición nutricional

Leyenda: **[V]** verificado en esta formación · **[M]** de memoria, sin verificar · **[C]** comprobado consultando la base de datos o el código de NutriFit (solo lectura, 2026-11-14). Examen respondido por la IA, **sin corregir**.

## Objetivos
1. Conocer las fuentes de composición de alimentos y sus diferencias.
2. Entender el etiquetado europeo y lo que significan sus valores.
3. Diseñar controles de calidad: duplicados, valores ausentes, coherencia, trazabilidad.
4. Valorar la calidad de la base de NutriFit con datos y no con impresiones.

## Desarrollo

### Fuentes de composición
- **BEDCA** (Base de Datos Española de Composición de Alimentos) **[M]**: base oficial española, con datos analíticos y de otras tablas; su cobertura y actualización deben consultarse en la fuente.
- **USDA FoodData Central** **[M]**: la más amplia; distingue tipos de datos (analíticos, de fundación, de legado, de productos de marca).
- **EuroFIR** **[M]**: red europea para armonizar bases nacionales.
- **Etiquetado de productos:** el Reglamento (UE) 1169/2011 obliga a declarar por 100 g o 100 ml la energía, grasa, saturadas, hidratos, azúcares, proteína y sal; el sodio se expresa como sal (sal = sodio × 2,5) **[M]**. Los valores son **medios** de la fabricación (con tolerancias), no medidas de cada unidad.
- **Alérgenos de declaración obligatoria** (14 grupos en la UE): cereales con gluten, crustáceos, huevos, pescado, cacahuetes, soja, leche (con lactosa), frutos de cáscara, apio, mostaza, granos de sésamo, dióxido de azufre y sulfitos, altramuces y moluscos **[M]**.

### Tipos de dato y calidad
- **Dato analítico** (medido en laboratorio), **calculado** a partir de ingredientes, **imputado** de un alimento parecido, **estimado** o **de etiqueta**. Cada uno tiene una fiabilidad distinta y debe poder distinguirse.
- **Variabilidad natural:** variedad, madurez, origen, estación y cocinado cambian la composición; una tabla da un valor central, no el del alimento que se come.
- **Cocinado y conservación:** modifican agua, grasa y vitaminas; los datos «crudo» y «cocinado» son alimentos distintos.
- **Valores ausentes frente a cero:** «0» significa «medido y no hay»; vacío (nulo) significa «no se sabe». Confundirlos es un error grave: una base que rellena con 0 los datos que faltan **subestima** nutrientes.

### Control de calidad de una base de datos
1. **Trazabilidad:** fuente, fecha y versión por alimento o por nutriente.
2. **Coherencia energética:** comparar la energía declarada con la calculada (4·P + 4·H(disponibles) + 9·G + 2·fibra); descartar diferencias por redondeo y revisar el resto.
3. **Rangos plausibles:** ningún macro por encima de 100 g por 100 g; suma de macros + agua + cenizas ≤ 100 g.
4. **Duplicados:** por nombre normalizado (sin tildes ni mayúsculas) y por valores idénticos de alimentos distintos.
5. **Estado de verificación:** «verificado», «estimado», «pendiente».
6. **Normalización de nombres y unidades** y alias de búsqueda.
7. **Control de cambios:** quién y cuándo modificó un valor, y qué planes lo usan (impacto).

## Fórmulas
- Energía calculada = 4·proteína + 4·hidratos disponibles + 9·grasa + 2·fibra (+ 7·alcohol).
- Sal = sodio × 2,5 **[M]**.
- Diferencia energética (%) = (calculada − declarada) ÷ declarada × 100.

## Errores frecuentes
1. Creer que «más alimentos» equivale a «mejor base».
2. Rellenar con ceros los datos que faltan.
3. Mezclar en la misma tabla datos de fuentes y tipos distintos sin marcarlos.
4. Copiar valores de un alimento «parecido» sin dejar constancia.
5. Usar valores de etiqueta como si fueran analíticos.
6. Editar un valor sin saber qué planes lo usan.

## Limitaciones y controversias
- Qué alimentos y marcas incluir; cómo representar la variabilidad (un valor o un rango); si los datos de etiqueta son suficientes para una consulta clínica.

## Estado de la base de alimentos de NutriFit [C]
Consulta de solo lectura a la base de producción (2026-11-14):
- **119 alimentos**, todos del sistema; ninguno propio de nutricionistas todavía.
- **Fuente:** 117 filas llevan la misma cadena «BEDCA / USDA (aproximado)» y 2, «Fabricante (aproximado)». No hay fuente ni fecha por alimento: la marca «(aproximado)» informa de que no son datos verificados.
- **Campos:** energía, proteína, hidratos, grasa, fibra, azúcares, sodio, grasa saturada, calcio, hierro y zinc por 100 g; sin vitaminas ni otros minerales.
- **Sin valores nulos, pero con muchos ceros:** 35 alimentos con fibra 0, 26 con azúcares 0, 8 con sodio 0, 5 con zinc 0, 3 con hierro 0 y 1 con calcio 0. No se puede distinguir «no hay» de «no se sabe»; algunos ceros (p. ej. sodio 0 en un alimento con sodio natural) son probablemente datos ausentes.
- **Valores idénticos en alimentos distintos:** «Queso fresco», «Requesón» y «Queso cottage» comparten los mismos valores (98 kcal, 11 g de proteína, 3,4 g de hidratos y 4,3 g de grasa), lo que indica un valor copiado.
- **Coherencia energética con la regla 4-4-9 sin tener en cuenta la fibra:** 15 alimentos difieren más de un 12 % (verduras ricas en fibra, el limón y el cacao); en las verduras es el efecto esperado de la fibra y de que sus hidratos no son todos disponibles, pero **el cacao puro (228 kcal declaradas frente a ≈433 por 4-4-9, con 37 g de fibra) necesita revisión** de fuente.
- **Etiquetado y alérgenos:** el catálogo no guarda alérgenos por alimento; el aviso se calcula por palabras clave sobre el nombre (Módulo 11).

## Casos prácticos
Los del examen (secciones B y C).

## Bibliografía
**[M]**: BEDCA (AESAN/BEDCA); USDA FoodData Central; EuroFIR; Reglamento (UE) 1169/2011 sobre la información alimentaria facilitada al consumidor; Greenfield y Southgate, *Food Composition Data* (FAO/INFOODS); documentos de INFOODS sobre calidad e interoperabilidad de datos.

## Examen

### A. Teórico (6 preguntas)
1. Diferencia entre dato analítico, calculado e imputado.
2. ¿Por qué «0» y «sin dato» no son lo mismo y qué pasa si se confunden?
3. ¿Qué información debe llevar la trazabilidad de un valor?
4. ¿Qué indican los valores de una etiqueta?
5. Cita cinco de los alérgenos de declaración obligatoria en la UE.
6. ¿Por qué una base más grande no es necesariamente mejor?

### B. Aplicado (3 problemas)
1. Alimento con 20 g de proteína, 50 g de hidratos (10 g de fibra), 10 g de grasa y 330 kcal declaradas: energía calculada con la fibra a 2 kcal/g y diferencia con lo declarado.
2. Un producto declara 0,8 g de sal por 100 g: sodio equivalente.
3. Tres alimentos distintos tienen los mismos cuatro valores: ¿qué consultas haces para detectarlo en una base y qué harías con el resultado?

### C. Razonamiento (2 casos)
1. Tienes que añadir 5.000 alimentos importados de otra base. ¿Qué proceso de calidad exiges antes de publicarlos?
2. Un nutricionista cambia el valor de proteína de un alimento del sistema. ¿Qué riesgos hay y cómo se gestionarían?

## Respuestas de la IA (sin corregir)

**A1.** Analítico: medido en laboratorio sobre el alimento. Calculado: obtenido a partir de la composición de los ingredientes y sus rendimientos. Imputado: copiado o derivado de un alimento parecido porque no se midió. Cada tipo tiene fiabilidad distinta y debe marcarse.

**A2.** «0» significa medido y ausente; «sin dato» significa desconocido. Si se confunden, los datos ausentes se cuentan como cero y los planes subestiman ese nutriente, con el riesgo de concluir que no hay problema o que hay un déficit que no existe.

**A3.** Fuente concreta (tabla, laboratorio o etiqueta), fecha o versión, tipo de dato (analítico, calculado, imputado, etiqueta), quién lo introdujo y cuándo, y, si hubo cambios, el valor anterior.

**A4.** Valores medios declarados por el fabricante por 100 g o 100 ml, con tolerancias; no son medidas de cada unidad ni una garantía analítica de cada lote.

**A5.** Cereales con gluten, crustáceos, huevos, pescado, cacahuetes, soja, leche, frutos de cáscara, apio, mostaza, sésamo, sulfitos, altramuces y moluscos [M].

**A6.** Porque más registros sin verificación aumentan duplicados, errores y valores sin fuente; una base útil prioriza información verificada, bien clasificada y trazable, y crece de forma controlada.

**B1.** Hidratos disponibles = 50 − 10 = 40 g. Energía = 20·4 + 40·4 + 10·9 + 10·2 = 80 + 160 + 90 + 20 = 350 kcal. Diferencia con 330 = +20 kcal (+6 %): dentro de una variación razonable por redondeos y factores específicos.

**B2.** Sodio = 0,8 ÷ 2,5 = 0,32 g = 320 mg por 100 g.

**B3.** Consulta de agrupación por los cuatro valores con recuento mayor que 1 y revisión manual de los grupos. Con el resultado: ver si son realmente equivalentes (por ejemplo, subproductos del mismo alimento) o si son valores copiados, buscar el dato correcto en una fuente y marcar los cambios; mientras, señalar «pendiente de verificar».

**C1.** Exigiría: licencia y fuente documentadas; mapeo de nutrientes y unidades; normalización de nombres; detección de duplicados; reglas automáticas (rangos, coherencia energética, suma ≤ 100 g); muestreo manual de una parte (p. ej. 5-10 %) por una persona cualificada; estado de verificación por registro; publicación por lotes con posibilidad de revertir; y prueba de que no cambia el cálculo de los planes existentes.

**C2.** Riesgos: alterar planes de otros clientes y nutricionistas (si es un alimento compartido), perder trazabilidad y no poder revertir. Gestión: los alimentos del sistema no se editan por los usuarios (copia propia con su versión), registro de cambios con valor anterior, aviso de qué planes lo usan y fecha de verificación.

## Criterios de corrección
- **Teórico:** 1 punto por respuesta correcta y completa; 0,5 incompleta; 0 con error conceptual grave.
- **Aplicado:** planteamiento, unidades y resultado; interpretación de la diferencia.
- **Razonamiento:** describe controles verificables y reversibles; reconoce que automatizar no sustituye a la verificación humana.
- **Nota:** teórico 40 %, aplicado 30 %, razonamiento 30 %. **La corrige el usuario.**

## Aplicaciones a NutriFit
Ordenadas por impacto (propuestas; nada implementado):
1. **Distinguir «no se sabe» de «0»** (permitir nulos en nutrientes opcionales y no sumarlos como cero; avisar en el plan cuando falten datos).
2. **Fuente, tipo de dato y fecha por alimento** (y estado «verificado»/«pendiente»).
3. **Corregir los valores duplicados** de queso fresco, requesón y queso cottage y revisar el cacao.
4. **Controles automáticos** de coherencia energética (con la fibra), rangos y duplicados antes de publicar alimentos.
5. **Alérgenos por alimento** (campo estructurado) en vez de deducirlos por el nombre.
6. **Control de cambios** y de impacto para alimentos modificados.
7. Ampliar el catálogo solo con datos verificables; la calidad pesa más que el volumen.
