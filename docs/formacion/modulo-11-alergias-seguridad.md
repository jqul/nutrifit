# Módulo 11. Alergias, intolerancias y seguridad alimentaria

Leyenda: **[V]** verificado en esta formación · **[M]** de memoria, sin verificar · **[C]** comprobado ejecutando el código o consultando la base de NutriFit (2026-11-14). Examen respondido por la IA, **sin corregir**.

> Una reacción alérgica puede ser grave. Un aviso de compatibilidad de una aplicación **no es una garantía de seguridad**. La persona alérgica debe leer siempre la etiqueta y seguir las indicaciones de su alergólogo.

## Objetivos
1. Diferenciar alergia, intolerancia, enfermedad celíaca y sensibilidad.
2. Conocer el marco europeo de alérgenos y de etiquetado.
3. Diseñar sistemas de exclusión que **fallen hacia el lado seguro**.
4. Aplicar criterios básicos de seguridad alimentaria a recetas y menús.

## Desarrollo

### Conceptos
- **Alergia alimentaria:** reacción del sistema inmunitario, a menudo mediada por IgE, que puede ser grave (anafilaxia) con cantidades muy pequeñas. Requiere diagnóstico por un alergólogo; el manejo base es evitar el alérgeno y tener un plan de actuación.
- **Intolerancia:** reacción no inmunitaria, normalmente dependiente de la dosis. La **intolerancia a la lactosa** (déficit de lactasa) suele permitir cantidades pequeñas de lactosa; muchas personas toleran lo equivalente a un vaso de leche repartido **[M]**; los productos fermentados y quesos curados contienen menos lactosa.
- **Enfermedad celíaca:** enfermedad autoinmune desencadenada por gluten; tratamiento: dieta sin gluten estricta de por vida con diagnóstico previo (Módulo 8). Es distinta de la alergia al trigo y de la sensibilidad al gluten no celíaca.
- **Sensibilidad alimentaria:** término amplio y poco definido; la evidencia diagnóstica es limitada.

### Alérgenos de declaración obligatoria en la UE [M]
Cereales con gluten, crustáceos, huevos, pescado, cacahuetes, soja, leche, frutos de cáscara, apio, mostaza, granos de sésamo, dióxido de azufre y sulfitos, altramuces y moluscos (14 grupos). El Reglamento (UE) 1169/2011 exige destacarlos en la lista de ingredientes.
- **Trazas:** los avisos «puede contener trazas de…» son **voluntarios** y no tienen un umbral armonizado en la UE **[M]**: la ausencia del aviso no garantiza la ausencia del alérgeno.
- **Sin gluten:** el etiquetado «sin gluten» exige ≤20 mg de gluten por kg de producto (Reglamento de Ejecución (UE) 828/2014) **[M]**.
- **Alimentos no envasados** (restauración): se debe informar de los alérgenos por escrito u oralmente según la normativa nacional **[M]**.

### Contaminación cruzada
- Utensilios, superficies, aceite de fritura, tostadoras y cadenas de producción compartidas. En alergia grave y en celiaquía es un riesgo real, por lo que la cocina doméstica y los menús necesitan medidas (utensilios separados, limpieza).
- **La avena** es naturalmente libre de gluten pero suele contaminarse con trigo, cebada o centeno; solo debe usarse la etiquetada «sin gluten» en celiaquía **[M]**.

### Seguridad alimentaria
- **Peligros biológicos:** Salmonella, Listeria, Campylobacter, E. coli productora de toxina Shiga, norovirus; toxiinfecciones. **Grupos de riesgo:** embarazadas, niños pequeños, mayores y personas inmunodeprimidas.
- **Cadena de frío y temperaturas:** refrigerar a baja temperatura (de forma general ≤4-5 °C), evitar la «zona de peligro» de crecimiento bacteriano (entre unos 5 y 60 °C), cocinar hasta que el centro alcance una temperatura segura (valores según la guía de seguridad alimentaria vigente) y recalentar bien **[M]**.
- **Anisakis:** el pescado que se come crudo o poco cocinado debe congelarse previamente (la normativa española exige ≤−20 °C durante al menos 24 horas) **[M]**.
- **Higiene:** manos, superficies, separación de crudo y cocinado, descongelación en frío, no lavar la carne cruda.
- **Recetas y menús:** indicar conservación (tiempo en nevera y congelación), alérgenos y riesgos en grupos vulnerables.

### Sustituciones seguras
- Una sustitución debe respetar el motivo de la exclusión: **bebida de avena** en lugar de leche para lactosa, pero con avena sin gluten si hay celiaquía; **bebida de almendra** no es válida en alergia a frutos secos; **tofu** no sirve en alergia a la soja; el «sin lactosa» no sirve en alergia a la proteína de leche.
- El **nombre del alimento no basta** para decidir su seguridad (salsa de soja contiene trigo; el chocolate puede contener leche; el embutido puede llevar gluten o lactosa).

## Diseño de un sistema de exclusiones seguro
1. **Datos estructurados**: lista de alérgenos por alimento y por receta (no inferirlos del nombre), con las 14 categorías de la UE.
2. **Datos del cliente estructurados**: tipo (alergia, intolerancia, celiaquía, preferencia) y gravedad; el texto libre solo como complemento.
3. **Fallar hacia el lado seguro**: si no se sabe el contenido de un alimento, mostrarlo como «sin verificar», no como «compatible».
4. **Sinónimos y variantes** del idioma, con tests de casos positivos y negativos.
5. **Distinguir niveles**: alergia o celiaquía → bloquear o advertir con firmeza; intolerancia → advertir; preferencia → sugerir otra cosa.
6. **Trazas y contaminación cruzada**: campo para productos con aviso de trazas.
7. **Mensajes honestos**: «No sustituye la lectura de la etiqueta».
8. **Auditoría periódica** con un conjunto de casos de referencia.

## Errores frecuentes
1. Inferir el alérgeno por el nombre del alimento.
2. Dar un producto por seguro por la ausencia de un aviso de trazas.
3. Sustituir un alérgeno por otro alimento que lo contiene.
4. Ignorar la contaminación cruzada de la cocina.
5. Retirar un alimento «por si acaso» sin diagnóstico (riesgo nutricional y psicológico).
6. Tratar la preferencia como alergia (o al revés).

## Limitaciones y controversias
- Umbrales de reactividad y etiquetado de trazas; diagnóstico de sensibilidad al gluten no celíaca; introducción de alérgenos en lactantes (Módulo 10).

## Auditoría del detector de alérgenos de NutriFit [C]
Comprobado ejecutando `detectAllergenConflict` (`src/lib/allergens.ts`) con alimentos reales del catálogo; **no se ha modificado nada**. El detector cruza el texto libre de alergias del cliente con el nombre del alimento por palabras clave y cubre 7 categorías (lactosa, frutos secos, gluten, huevo, marisco, pescado, soja). El propio código dice que es un aviso para que el profesional revise.

| Alergia escrita por el cliente | Alimento del catálogo | Resultado | Valoración |
|---|---|---|---|
| celíaco / gluten / trigo | Pan de centeno, Cuscús, Pasta | aviso de gluten | correcto |
| celíaco / gluten | **Seitán** (gluten de trigo puro) | sin aviso | **falso negativo grave** |
| celíaco / gluten | Avena | sin aviso | falso negativo (contaminación habitual) |
| celíaco / gluten | Salsa de soja, Cerveza | sin aviso de gluten | falso negativo |
| **«celiaquía»** o «celiaquia» | cualquiera | sin aviso | el texto no se reconoce: solo «celíaco» y «celiaco» |
| pescado | Salmón | aviso | correcto |
| pescado | **Caballa, Dorada, Lubina, Sardinas** | sin aviso | **falsos negativos** (solo conoce salmón, merluza, atún, bacalao y «pescado») |
| marisco | Gambas, Mejillones | aviso | correcto |
| marisco | **Calamar, Pulpo** | sin aviso | **falsos negativos** (moluscos) |
| frutos secos | Pistachos | aviso | correcto |
| frutos secos | **Piñones** | sin aviso | falso negativo |
| frutos secos | **Nuez moscada** | aviso | falso positivo («nuez» no es fruto seco aquí) |
| sésamo | Tahini | sin aviso | **la categoría no existe** (tampoco apio, mostaza, sulfitos ni altramuces) |
| soja | Salsa de soja | aviso | correcto |
| lactosa | Queso curado | aviso | conservador (poca lactosa); aceptable |
| lactosa | Leche de avena | sin aviso | correcto (lista de seguros) |

**Conclusión:** como ayuda de revisión es una base útil, pero tal como está **puede dar una falsa sensación de seguridad**, sobre todo con celiaquía y alergia a pescado y moluscos. No se debe confiar en él como control único. **Lo que está bien:** gestiona «sin lactosa», una lista de bebidas vegetales seguras, y las recetas pueden llevar etiquetas de alérgenos marcadas por el profesional.

**Otros puntos:** el catálogo no guarda alérgenos por alimento (Módulo 6); las alergias del cliente son texto libre; los alérgenos de una receta los marca el nutricionista a mano; el sistema no distingue gravedad ni trazas.

## Casos prácticos
Los del examen (secciones B y C).

## Bibliografía
**[M]**: Reglamento (UE) 1169/2011; Reglamento de Ejecución (UE) 828/2014 (gluten); EFSA, opiniones sobre alérgenos; AESAN, guías de alérgenos y de seguridad en el hogar; Real Decreto 1420/2006 (Anisakis); EAACI, guías de alergia alimentaria; ESPGHAN, guías de celiaquía; manuales de higiene alimentaria.

## Examen

### A. Teórico (6 preguntas)
1. Diferencia entre alergia y intolerancia, con un ejemplo de cada una.
2. ¿Qué significa el aviso «puede contener trazas» y qué no garantiza su ausencia?
3. ¿Por qué no es suficiente el nombre de un alimento para decidir si es seguro?
4. Cita cinco de los 14 alérgenos de declaración obligatoria.
5. ¿Qué es la contaminación cruzada y dos medidas para evitarla en casa?
6. ¿Por qué hay que congelar el pescado que se come crudo?

### B. Aplicado (3 problemas)
1. Un producto «sin gluten» contiene el máximo permitido (20 mg/kg) y se come una ración de 200 g: ¿cuántos miligramos de gluten?
2. Un vaso de 250 mL de leche con 4,8 g de lactosa por 100 mL: ¿cuánta lactosa?
3. Diseña seis casos de prueba para un detector de alérgenos, con su resultado esperado (incluye falsos negativos y positivos posibles).

### C. Razonamiento (3 casos)
1. Una clienta con alergia a frutos secos recibe del sistema un plan con «tahini» marcado como compatible. ¿Qué analizas y qué cambias?
2. Un cliente celíaco usa avena de un supermercado. ¿Qué le indicas?
3. Se plantea sustituir el detector por palabras clave por uno «más inteligente». ¿Qué respondes?

## Respuestas de la IA (sin corregir)

**A1.** La alergia es inmunitaria y puede ser grave con cantidades mínimas (p. ej. alergia al cacahuete); la intolerancia no es inmunitaria y suele depender de la dosis (p. ej. intolerancia a la lactosa).

**A2.** Es un aviso voluntario de posible contaminación cruzada sin umbral armonizado en la UE; su ausencia no garantiza que el producto esté libre del alérgeno.

**A3.** Porque el nombre no refleja los ingredientes: una salsa de soja contiene trigo, un chocolate puede tener leche, un embutido gluten o lactosa. Se necesita la lista de ingredientes y los alérgenos declarados.

**A4.** Cereales con gluten, crustáceos, huevos, pescado, cacahuetes, soja, leche, frutos de cáscara, apio, mostaza, sésamo, sulfitos, altramuces y moluscos (cinco de ellos).

**A5.** Es el paso de un alérgeno a un alimento que no lo contiene por utensilios, superficies o aceite compartidos. Medidas: utensilios y tablas separados y limpieza cuidadosa; preparar antes el plato sin alérgeno.

**A6.** Para eliminar las larvas de Anisakis; la normativa española exige congelar a −20 °C o menos durante al menos 24 horas [M].

**B1.** 0,2 kg × 20 mg/kg = 4 mg de gluten como máximo.

**B2.** 250 mL × 4,8 g/100 mL = 12 g de lactosa.

**B3.** Casos: (1) cliente «celíaco» + «Seitán» → aviso de gluten; (2) «alergia al pescado» + «Caballa» → aviso; (3) «alergia al marisco» + «Calamar» → aviso (molusco); (4) «alergia a frutos secos» + «Nuez moscada» → sin aviso (no es un fruto seco); (5) «celiaquía» (con esta ortografía) + «Pasta» → aviso; (6) «alergia al sésamo» + «Tahini» → aviso. Con el estado actual del código, los casos 1, 2, 3, 5 y 6 darían falsos negativos y el 4 un falso positivo.

**C1.** El sistema no reconoce el sésamo; el tahini no está cubierto y su cruce con frutos secos es solo por nombre. Cambiaría a alérgenos estructurados por alimento (categoría de sésamo incluida), marcaría los alimentos sin información como «sin verificar», avisaría a la clienta y al profesional y revisaría el plan.

**C2.** Que solo use avena etiquetada «sin gluten» (por contaminación cruzada habitual) y, si tiene dudas o síntomas, que lo consulte con su equipo médico y de dietética.

**C3.** Que primero hay que definir el comportamiento correcto con datos estructurados y casos de prueba, porque un mecanismo más «inteligente» no garantiza seguridad y es más difícil de auditar; además, la decisión de producto es que NutriFit no incorpora IA. Se debería mejorar con datos y reglas explícitas y probarlas.

## Criterios de corrección
- **Teórico:** 1 punto por respuesta correcta y completa; 0,5 incompleta; 0 con error conceptual grave.
- **Aplicado:** cálculos correctos; casos de prueba que incluyan positivos, negativos y falsos negativos.
- **Razonamiento:** prioriza la seguridad, falla hacia el lado seguro y mantiene la responsabilidad profesional.
- **Nota:** teórico 40 %, aplicado 30 %, razonamiento 30 %. **La corrige el usuario.**

## Aplicaciones a NutriFit
Propuestas por prioridad de seguridad (nada implementado):
1. Cubrir en el detector **todos los alimentos del catálogo** con pruebas (seitán, caballa, dorada, lubina, sardinas, calamar, pulpo, piñones, avena, cerveza, salsa de soja) y reconocer «celiaquía».
2. **Alérgenos estructurados** por alimento, receta e ingrediente, con las 14 categorías de la UE.
3. **Estado «sin verificar»** para alimentos sin datos, en lugar de «sin aviso».
4. Alergias del cliente **estructuradas** (tipo y gravedad) además del texto libre.
5. Corregir el falso positivo de la nuez moscada.
6. Texto fijo: «Esta comprobación no sustituye la lectura de la etiqueta».
