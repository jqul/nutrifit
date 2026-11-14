# Módulo 16. Auditoría y desarrollo integral de NutriFit

Leyenda: **[V]** verificado en esta formación · **[M]** de memoria, sin verificar · **[C]** comprobado ejecutando o leyendo el código, o consultando la base de datos de NutriFit (2026-11-14, solo lectura). Examen respondido por la IA, **sin corregir**. **Esta auditoría no cambió ni una línea de código ni de datos.**

## Objetivos
1. Auditar un producto de nutrición con método: funciones, datos, cálculos, experiencia de usuario y seguridad.
2. Priorizar por riesgo para las personas, no por comodidad de desarrollo.
3. Definir criterios de aceptación verificables y un plan de pruebas.
4. Evitar duplicar lo que ya existe y no tocar lo que no se entiende.

## Método de auditoría
1. **Inventario** de lo que existe (funciones, pantallas, tablas) antes de proponer nada.
2. **Comprobación** ejecutando el código con casos reales y consultando los datos (solo lectura).
3. **Clasificación** de hallazgos por gravedad: **alta** (puede causar daño a una persona), **media** (resultados incorrectos o engañosos, pérdida de calidad de datos) y **baja** (mejoras de claridad o completitud).
4. **Criterios de aceptación** y prueba por hallazgo.
5. **Orden de ejecución** por riesgo y dependencia, con **decisiones del usuario** señaladas.

## Inventario de lo que ya existe (para no duplicar)
- **Planes y alimentación:** plan por cliente con comidas, opciones y días; historial y versiones; plantillas; fases con cambio automático; reajuste del plan; propuesta de menú diario y semanal; sustituciones y grupos de intercambio; recetario con tipo, etiquetas, alérgenos, raciones y libro del cliente; importación de recetas y de planes; lista de la compra; catálogo de 119 alimentos con 11 nutrientes; calculadora metabólica con tres ecuaciones.
- **Seguimiento:** peso con gráfica por periodos y tendencia, fecha estimada al objetivo, medidas corporales, fotos, check-ins diarios, pasos opcionales, adherencia y racha, revisión semanal, preparar la consulta, informe de progreso, analíticas con rangos y pistas.
- **App del cliente:** hoy, dieta, progreso, más; escáner de productos; extras; opción de ocultar cifras; lo que no le gusta; privacidad y accesos.
- **Gestión:** clientes, bajas, agenda, mensajes, difusión, encuestas, facturación estimada, marca propia, registro de accesos, exportación y eliminación de datos, textos legales.
- Estudios previos de herramientas comparables están en `replica/` (Harbiz, Nutrium, MyFitnessPal, Fitai Labs, MacroFactor).

## Hallazgos priorizados (todos comprobados [C])

### Gravedad alta (riesgo para una persona)
| # | Hallazgo | Evidencia | Módulo |
|---|---|---|---|
| H1 | **El detector de alérgenos tiene falsos negativos graves**: no reconoce el seitán como gluten, ni caballa, dorada, lubina o sardinas como pescado, ni calamar o pulpo como moluscos, ni los piñones como fruto seco; no cubre sésamo, apio, mostaza, sulfitos ni altramuces; el texto «celiaquía» del cliente no se reconoce; avena, cerveza y salsa de soja no avisan de gluten. Además marca la nuez moscada como fruto seco. | Se ejecutó `detectAllergenConflict` con alimentos reales del catálogo | 11 |
| H2 | **La calculadora metabólica no tiene suelo de energía, ni control de edad o de embarazo, y puede devolver macros que suman más que el objetivo.** Un caso real da 1.045 kcal y una persona de 17 años recibe cálculo de adulto sin aviso. | Se ejecutó `computeMetabolicPlan` | 4, 10 |

### Gravedad media
| # | Hallazgo | Módulo |
|---|---|---|
| H3 | **Calidad de datos del catálogo:** fuente genérica «BEDCA / USDA (aproximado)» en 117 de 119 alimentos; «Queso fresco», «Requesón» y «Queso cottage» con valores idénticos; el cacao puro con 228 kcal frente a ≈433 por 4-4-9; ceros que probablemente sean datos ausentes (35 sin fibra, 26 sin azúcares, 8 sin sodio, 5 sin zinc, 3 sin hierro, 1 sin calcio). | 6 |
| H4 | **Modelo de planes:** los ítems no guardan el identificador del alimento, la cantidad es texto y las recetas guardan todos los valores como texto en un JSON. | 15 |
| H5 | **Conversión de medidas caseras** con un único valor por unidad y `ml = g`; no hay estado crudo/cocinado ni rendimientos. | 5 |
| H6 | **Adherencia y racha castigan los días sin registrar:** un día sin check-in cuenta como no cumplido y la racha vuelve a 0; esa adherencia alimenta las alertas y el umbral del reajuste. | 12 |
| H7 | **Las estimaciones se presentan como cifras exactas** (TMB y gasto total sin rango, método ni límites). | 4 |

### Gravedad baja
| # | Hallazgo | Módulo |
|---|---|---|
| H8 | No hay ficha de evaluación inicial estructurada, ni cribado de riesgo nutricional, ni medicación y suplementos estructurados, ni banderas de derivación (TCA, pérdida de peso no intencionada, RED-S). | 3, 8, 9, 12 |
| H9 | Fibra por defecto de 14 g por 1.000 kcal frente a otra referencia habitual de ≈25 g; el catálogo solo tiene tres micronutrientes. | 4, 7 |
| H10 | Los textos no citan fuente ni fecha por afirmación nutricional; no hay política de revisión de contenidos. | 13 |
| H11 | Cierre de proceso (alta) no distinguido de la baja comercial; informe para otros profesionales con consentimiento. | 14 |

### Lo que está bien (no tocar sin necesidad)
- Seguridad de datos con políticas de acceso en todas las tablas y registro de accesos; exportación y eliminación de datos; textos legales propios y contrato de encargado.
- Más de 970 pruebas unitarias con integración continua; migraciones versionadas y probadas.
- El reajuste del plan es conservador (espera de 14 días, mínimo de pesajes, no recorta si la adherencia es baja, suelo de 1.200 kcal).
- Tono neutro en lo nuevo (balance del día, fecha estimada, pasos sin objetivo) y opción de ocultar cifras.

## Plan de desarrollo propuesto (no iniciado)

### Fase 0. Decisiones del usuario
1. ¿Se acepta que la adherencia distinga «no registró» de «no cumplió» y que la racha tenga días de gracia (H6)?
2. ¿Qué nivel de aviso o bloqueo se quiere en la calculadora fuera de la edad adulta y bajo el suelo de energía (H2)?
3. ¿Quién revisa clínicamente los textos y reglas antes de publicarlos (H10)?

### Fase 1. Seguridad
- **H1.** Criterios de aceptación: (a) existe una tabla de **casos de referencia** con los alimentos del catálogo y sus alérgenos esperados, revisada por una persona cualificada; (b) todos los casos pasan; (c) los alimentos sin información se muestran como **«sin verificar»** y no como compatibles; (d) «celiaquía» y variantes se reconocen; (e) el aviso incluye «no sustituye la lectura de la etiqueta». Prueba: tests con los casos del Módulo 11 y de los 119 alimentos.
- **H2.** Criterios: (a) suelo de energía con aviso y sin aplicación silenciosa por debajo; (b) aviso o bloqueo por edad menor de 18, embarazo o lactancia (campo en la ficha); (c) coherencia de macros: nunca devolver una suma mayor que el objetivo sin avisar; (d) resultado mostrado con **rango y método**. Prueba: los casos del Módulo 4 como tests.

### Fase 2. Datos
- **H3.** Corregir los valores duplicados y el cacao con una fuente; distinguir nulo de cero; fuente y fecha por alimento; controles automáticos de coherencia energética con la fibra y de duplicados.
- **H5.** Estado crudo/cocinado y densidad por alimento para las medidas caseras.

### Fase 3. Modelo
- **H4.** Añadir identificador del alimento y versión de la fuente a los ítems; migrar cantidades de texto a número con informe de excepciones; validar rangos en la base de datos. Cada migración con prueba, informe y reversión.

### Fase 4. Seguimiento y práctica clínica
- **H6.** Cambiar el cálculo de adherencia (con decisión de la Fase 0), probar el efecto sobre alertas y reajuste.
- **H8 y H11.** Ficha de evaluación inicial, medicación y suplementos, cribado y banderas de derivación, cierre de proceso.
- **H7, H9 y H10.** Presentación de rangos, referencias con fuente y política de revisión de contenidos.

### Principios de ejecución
- Un cambio por PR, con prueba que falle antes y pase después; ningún cálculo sin caso de referencia independiente.
- No cambiar datos de producción sin copia previa y registro de qué cambió.
- No duplicar funciones existentes (ver el inventario).
- **Sin IA dentro del producto.**

## Casos prácticos
Los del examen (secciones B y C).

## Bibliografía
**[M]**: Nielsen, heurísticas de usabilidad; ISO/IEC 25010 (calidad de producto de software); OWASP, ASVS; ISO 14971 como referencia conceptual de gestión de riesgos en productos sanitarios (NutriFit no es un producto sanitario certificado; la cuestión de si alguna función lo sería debe consultarse al responsable regulatorio) **[M]**; guías de seguridad del paciente.

## Examen

### A. Teórico (4 preguntas)
1. ¿Por qué se prioriza por riesgo para las personas y no por esfuerzo de desarrollo?
2. Diferencia entre un falso negativo y un falso positivo en un detector de alérgenos, y cuál es más grave.
3. ¿Qué significa «fallar hacia el lado seguro»?
4. ¿Por qué hay que auditar antes de proponer una función?

### B. Aplicado (2 problemas)
1. Redacta cinco casos de referencia para probar el detector de alérgenos tras el arreglo, con su resultado esperado.
2. Define criterios de aceptación y pruebas para «suelo de energía en la calculadora».

### C. Razonamiento (2 casos)
1. Solo tienes tiempo para un cambio esta semana: ¿cuál eliges entre H1, H3 y H6, y por qué?
2. Un cliente celíaco recibe un plan con seitán. ¿Cómo gestionas el incidente?

## Respuestas de la IA (sin corregir)

**A1.** Porque el daño potencial recae en las personas (alergias, planes inadecuados), y un fallo grave y poco frecuente importa más que una mejora cómoda de hacer; el esfuerzo de desarrollo influye en el orden entre cambios de riesgo parecido, no en el riesgo.

**A2.** Falso negativo: el detector no avisa de un alérgeno presente; falso positivo: avisa de un alérgeno que no está. El falso negativo es el más grave porque la persona puede tomar el alimento; el falso positivo solo molesta o limita la elección.

**A3.** Que ante la duda o falta de datos el sistema adopte la opción que protege a la persona (por ejemplo, mostrar «sin verificar» o bloquear), en lugar de la que parece cómoda («compatible»).

**A4.** Para no duplicar lo que existe, no romper dependencias que no se entienden y asegurar que el problema que se resuelve es real y medido.

**B1.** (1) «celiaquía» + «Seitán» → aviso de gluten. (2) «alergia al pescado» + «Caballa» → aviso de pescado. (3) «alergia al marisco» + «Calamar» → aviso (molusco). (4) «alergia al sésamo» + «Tahini» → aviso de sésamo. (5) «alergia a frutos secos» + «Nuez moscada» → sin aviso (no es fruto seco). Más un caso de alimento sin información que debe mostrarse como «sin verificar».

**B2.** Criterios: ningún objetivo calculado por debajo del suelo (p. ej. 1.200 kcal) se aplica sin una confirmación explícita del profesional; el aviso indica el motivo y el valor; el cálculo base no cambia. Pruebas: la mujer de 50 kg del Módulo 4 (1.045 kcal) muestra el aviso; un caso justo en el suelo (1.200) no lo muestra; un caso por encima no lo muestra; la ayuda de «aplicar» exige confirmación; y los tests existentes de las fórmulas siguen pasando.

**C1.** Elegiría H1: es la única con riesgo de daño directo a una persona (alergia, celiaquía), la solución es acotada y comprobable con casos de referencia, y no depende de decisiones pendientes; H3 y H6 son importantes pero menos urgentes o requieren decisiones del usuario.

**C2.** Contención: avisar al profesional responsable, localizar los planes con seitán y gluten (por nombre y por receta) y contactar con el cliente afectado para que no lo tome. Causa: el detector no reconoce el seitán. Corrección: añadirlo a los casos de referencia con una prueba que falle antes y pase después, revisar el resto del catálogo, desplegar y verificar. Registro del incidente y comunicación a las partes afectadas según corresponda.

## Criterios de corrección
- **Teórico:** 1 punto por respuesta correcta y completa; 0,5 incompleta; 0 con error conceptual grave.
- **Aplicado:** casos y criterios concretos, verificables y reproducibles.
- **Razonamiento:** prioriza por riesgo, respeta decisiones pendientes y propone una gestión de incidentes responsable.
- **Nota:** teórico 40 %, aplicado 30 %, razonamiento 30 %. **La corrige el usuario.**
