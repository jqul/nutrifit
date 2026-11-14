# Módulo 8. Nutrición clínica y dietoterapia

Leyenda: **[V]** verificado en esta formación · **[M]** de memoria, sin verificar · **[C]** comprobado en el código de NutriFit. Examen respondido por la IA, **sin corregir**.

> **Límite de ámbito.** Este módulo sirve para entender qué consideraciones nutricionales acompañan a cada situación y para diseñar **ayudas y avisos** dentro de una herramienta profesional. **No sustituye el diagnóstico médico ni el criterio clínico**; las pautas terapéuticas concretas deben proceder de guías vigentes (ESPEN, sociedades científicas) y de quien tiene la responsabilidad clínica. Las cifras específicas de guías no se reproducen aquí salvo que se hayan podido verificar.

## Objetivos
1. Reconocer cuándo una situación clínica cambia el planteamiento nutricional.
2. Conocer los principios dietéticos de las patologías más frecuentes y sus límites.
3. Identificar señales que exigen derivación.
4. Diseñar validaciones, advertencias y límites de uso para una herramienta que apoye a profesionales.

## Desarrollo

### Evaluación del estado nutricional en enfermedad
- **Cribado:** herramientas validadas según el entorno (MUST en adultos de la comunidad, NRS-2002 en hospital, MNA en mayores) **[M]**. Detectan riesgo; no diagnostican.
- **Diagnóstico de desnutrición:** los criterios GLIM combinan criterios fenotípicos (pérdida de peso, IMC bajo, masa muscular reducida) y etiológicos (baja ingesta o absorción, inflamación o carga de enfermedad) **[M]**.
- La **inflamación** altera parámetros (albúmina, prealbúmina, ferritina) que no son buenos marcadores del estado nutricional por sí solos.

### Diabetes
- **Tipo 1:** déficit absoluto de insulina; el ajuste del tratamiento se relaciona con la ingesta de hidratos; el conteo de hidratos es una herramienta educativa en manos del equipo de diabetes.
- **Tipo 2 y resistencia a la insulina:** el peso, la calidad de la dieta y la actividad física son pilares; no existe una única dieta óptima y los patrones con evidencia (mediterránea, bajos en hidratos, con control energético) se individualizan **[M]**.
- **Riesgos:** hipoglucemias con insulina o sulfonilureas, que modifican las recomendaciones de ejercicio y ayuno; interacción dieta-fármaco.
- Un software no debe proponer cambios de tratamiento farmacológico.

### Dislipemias y riesgo cardiovascular
- El LDL-colesterol es causal en la aterosclerosis (Módulo 2). La dieta influye en el perfil lipídico (grasas saturadas y trans, fibra soluble, esteroles vegetales, peso); el **tratamiento farmacológico** lo decide el médico según el riesgo.
- **Hipertensión:** reducir sal, aumentar potasio de la dieta, peso, alcohol y actividad; el patrón DASH tiene respaldo de ensayos **[M]**.

### Enfermedad renal
- Las restricciones de proteína, fósforo, potasio y líquidos **dependen del estadio y de la situación** (diálisis o no); una dieta restrictiva inadecuada puede causar desnutrición. **Requiere nefrólogo y dietista especializado**.

### Enfermedades digestivas y hepáticas
- **Celiaquía:** exclusión estricta y de por vida del gluten, con diagnóstico previo (serología y biopsia) y sin retirar el gluten antes de la prueba **[M]**; contaminación cruzada relevante (Módulo 11).
- **Enfermedad inflamatoria intestinal:** la nutrición se ajusta a la fase (brote o remisión), a la desnutrición y a las estenosis.
- **Síndrome de intestino irritable:** la dieta baja en FODMAP tiene evidencia de beneficio en una parte de pacientes y debe hacerse **por fases y con supervisión**, ya que es restrictiva **[M]**.
- **Enfermedad hepática y pancreatitis:** necesidades de energía y proteína suelen ser **altas** en enfermedad hepática crónica y desnutrición; no se restringe proteína de forma sistemática **[M]**.

### Oncología y perioperatorio
- El riesgo de desnutrición y sarcopenia es alto; el objetivo suele ser **mantener ingesta y masa muscular**, y no perder peso. Las dietas «anticáncer» restrictivas carecen de respaldo y pueden dañar.
- **Perioperatorio:** protocolos de recuperación intensificada (ERAS), con ayuno corto y soporte nutricional en desnutridos, a cargo del equipo hospitalario **[M]**.

### Disfagia y nutrición artificial
- **Disfagia:** ajuste de texturas y de líquidos espesados según valoración logopédica. Una textura inadecuada puede provocar aspiración.
- **Nutrición enteral y parenteral:** indicada por equipos especializados; fuera del alcance de una app de seguimiento.

### Interacciones alimento-medicamento
- Ejemplos: vitamina K y anticoagulantes antagonistas; pomelo y algunas estatinas y otros fármacos (inhibición enzimática); lácteos o calcio con algunas quinolonas y tetraciclinas; alimentos y levotiroxina **[M]**. Siempre con la ficha técnica y el farmacéutico.

## Principios de actuación del nutricionista
1. Trabajar **con** el médico y no en su lugar (derivar y coordinar).
2. Preferir **la intervención más pequeña útil** y reevaluar.
3. Evitar dietas de exclusión sin indicación.
4. Documentar el razonamiento y las fuentes.

## Señales de derivación urgente o preferente [M]
- Pérdida de peso no intencionada y rápida, disfagia, vómitos persistentes, sangrado digestivo, dolor torácico, síntomas de hipoglucemia grave o hiperglucemia, embarazo con complicaciones, sospecha de trastorno de la conducta alimentaria con compromiso físico.

## Errores frecuentes
1. Aplicar una dieta de población general a una persona con enfermedad renal o hepática.
2. Retirar el gluten antes del diagnóstico de celiaquía.
3. Iniciar una dieta baja en FODMAP sin fase de reintroducción.
4. Recomendar suplementos sin revisar la medicación.
5. Usar la albúmina como marcador único de nutrición.
6. Ofrecer «tratamientos» fuera del ámbito profesional.

## Limitaciones y controversias
- Patrón dietético óptimo en diabetes tipo 2; papel de los alimentos ultraprocesados; evidencia de la dieta baja en FODMAP a largo plazo; dietas cetogénicas en distintas patologías.

## Qué hace NutriFit hoy [C]
- Notas clínicas visibles al cliente, analíticas con rangos y avisos de «pista» (`alertLabHints.ts`), anamnesis y ficha del cliente con alergias y notas, y objetivos y planes por cliente.
- **Avisos fármaco-nutriente (`drugNutrientInteractions.ts`) [C]:** cruzan el **texto libre de medicación de la anamnesis** con el nombre de los alimentos del plan, por palabras clave (mismo patrón que los alérgenos), y muestran un icono al profesional; el texto lleva el matiz («mantener constante», no «prohibido»). Heredan las limitaciones de la búsqueda por nombre y del texto libre (Módulo 11).
- **No tiene:** clasificación de patologías, validaciones por enfermedad, cribado nutricional, registro **estructurado** de medicación (solo el texto libre de la anamnesis), ni límites de uso por situación clínica.

## Casos prácticos
Los del examen (secciones B y C).

## Bibliografía
**[M]**: guías ESPEN (cribado, desnutrición y cada patología); criterios GLIM (2018); American Diabetes Association, *Standards of Care* (edición vigente); sociedades españolas (SEEDO, SEEN, SENPE); estudio DASH; guías de celiaquía (ESPGHAN, ACG); Krause, *Dietoterapia*.

## Examen

### A. Teórico (6 preguntas)
1. Diferencia entre cribado y diagnóstico de desnutrición.
2. ¿Por qué no basta la albúmina para valorar el estado nutricional?
3. ¿Por qué no se debe retirar el gluten antes del diagnóstico de celiaquía?
4. Fases de la dieta baja en FODMAP y por qué se hace con supervisión.
5. Dos interacciones alimento-medicamento.
6. Límites del ámbito de un nutricionista frente al de un médico.

### B. Aplicado (2 problemas)
1. Un varón de 70 kg ha perdido 5 kg en 3 meses sin proponérselo. Calcula el porcentaje y razona qué haces.
2. Una persona con enfermedad renal crónica pide un plan de 2 g de proteína por kilo. ¿Qué respondes?

### C. Razonamiento (3 casos)
1. Una clienta con diabetes tipo 1 quiere empezar un ayuno intermitente prolongado. ¿Qué riesgos señalas y cómo actúas?
2. Se diseña un módulo de NutriFit para «dietas por enfermedad». ¿Qué límites y validaciones exiges?
3. Un cliente con sospecha de celiaquía lleva dos semanas sin gluten y pide un plan «sin gluten estricto». ¿Qué le propones?

## Respuestas de la IA (sin corregir)

**A1.** El cribado detecta riesgo de desnutrición con una herramienta rápida (MUST, NRS-2002, MNA); el diagnóstico confirma la desnutrición con criterios (GLIM: fenotípicos y etiológicos) y orienta el tratamiento.

**A2.** Porque la albúmina es un reactante de fase aguda negativo: baja con la inflamación, la hidratación y la enfermedad, y tiene una vida media larga, de modo que refleja más la inflamación que la ingesta reciente.

**A3.** Porque las pruebas diagnósticas (serología y biopsia) pueden dar falsos negativos si no se consume gluten; retirarlo antes puede impedir el diagnóstico y dejar a la persona con una dieta estricta innecesaria o sin confirmar.

**A4.** Restricción temporal de alimentos ricos en FODMAP, reintroducción por grupos para identificar los que provocan síntomas y personalización a largo plazo. Se supervisa porque es restrictiva (riesgo de ingesta baja de fibra y calcio, impacto en la microbiota) y porque algunos síntomas requieren descartar otras causas [M].

**A5.** Vitamina K y anticoagulantes antagonistas (consumo estable de verdura de hoja verde); pomelo y ciertas estatinas, por inhibición enzimática [M].

**A6.** El nutricionista valora el estado nutricional, planifica la alimentación y educa; no diagnostica enfermedades ni prescribe o modifica fármacos; debe derivar y coordinar con el médico cuando hay indicios de patología o riesgo.

**B1.** 5 ÷ 70 × 100 ≈ 7,1 % en 3 meses (pérdida no intencionada). Es una señal de riesgo: derivo a valoración médica y hago cribado de desnutrición, reviso ingesta, apetito, dentición, fármacos y estado de ánimo, y el objetivo pasa a ser asegurar energía y proteína, no perder peso.

**B2.** Que no es adecuado fijarlo sin más: las restricciones o el aporte de proteína en enfermedad renal dependen del estadio, de si hay diálisis y de otros factores; la decisión debe tomarla el nefrólogo con un dietista especializado. Le pido el informe médico y los valores de función renal y lo coordino con su equipo.

**C1.** Riesgos: hipoglucemia (con insulina), cetoacidosis si falta insulina, descompensación y confusión con ejercicio y medicación. Actúo: no proponer ayuno prolongado sin supervisión del equipo de diabetes, explicar los riesgos, recomendar que lo hable con su endocrinólogo y, si se acuerda, un protocolo individualizado con monitorización.

**C2.** Exigiría: alcance limitado a ayudas y avisos para profesionales; contenido basado en guías vigentes con fuente; validaciones por situación (renal, hepática, diabetes, embarazo) que avisen y no autoricen automáticamente; registro de medicación y alergias; texto de «esto no sustituye el criterio clínico»; derivación en señales de alarma; y revisión por un profesional sanitario antes de publicar.

**C3.** Le explico que retirar el gluten antes de la prueba puede falsear el diagnóstico; le propongo que lo hable con su médico, que consulte si debe reintroducir gluten un tiempo antes de las pruebas y, mientras, no diseñar un plan estricto «de por vida» hasta confirmar el diagnóstico; si hay síntomas graves, derivar.

## Criterios de corrección
- **Teórico:** 1 punto por respuesta correcta y completa; 0,5 incompleta; 0 con error conceptual grave.
- **Aplicado:** cálculo correcto y actitud prudente (derivar).
- **Razonamiento:** identifica riesgos, respeta el ámbito profesional, propone controles proporcionados.
- **Nota:** teórico 40 %, aplicado 30 %, razonamiento 30 %. **La corrige el usuario.**

## Aplicaciones a NutriFit
- **Registro estructurado de condiciones y medicación** (hoy es texto libre en la anamnesis, con avisos por palabras clave) con avisos de revisión por el profesional (no de decisión automática).
- **Cribado de riesgo nutricional** y alerta de pérdida de peso no intencionada.
- **Banderas de derivación** configurables (síntomas de alarma en el check-in).
- **Bloqueos y avisos** en la calculadora para situaciones fuera de alcance (embarazo, menores, patología renal o hepática, trastornos de la conducta alimentaria).
- Contenido clínico solo con fuente y revisado por un sanitario.
