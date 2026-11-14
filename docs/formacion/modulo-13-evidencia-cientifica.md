# Módulo 13. Investigación científica y medicina basada en la evidencia

Leyenda: **[V]** verificado en esta formación · **[M]** de memoria, sin verificar · **[C]** comprobado en el código o los textos de NutriFit. Examen respondido por la IA, **sin corregir**.

## Objetivos
1. Leer críticamente un estudio y una noticia sobre nutrición.
2. Interpretar medidas de efecto (riesgo relativo, absoluto, NNT) e intervalos de confianza.
3. Aplicar un marco de certeza de la evidencia (GRADE) y distinguir evidencia de recomendación.
4. Establecer criterios para validar contenidos y cálculos de un producto.

## Desarrollo

### Método científico y tipos de estudio
- **Pregunta y formato PICO** (población, intervención, comparación, resultado). Una buena pregunta precede a la búsqueda.
- **Observacionales:** descriptivos, de casos y controles, de cohortes, transversales. Generan hipótesis y miden asociaciones; sufren de confusión y sesgos.
- **Experimentales:** ensayo clínico aleatorizado (el diseño que mejor controla la confusión); en nutrición suele ser difícil (no se puede cegar la dieta, la adherencia varía, el seguimiento es corto).
- **Síntesis:** la **revisión sistemática** reúne estudios con un método explícito; el **metaanálisis** combina sus resultados estadísticamente. Su calidad depende de la de los estudios incluidos («basura entra, basura sale»).
- **Guías de práctica clínica:** recomendaciones elaboradas con evidencia y juicio; deben ser transparentes sobre los dos.
- **Jerarquía de evidencia:** útil como punto de partida, no como regla mecánica: un ensayo mal hecho puede valer menos que una buena cohorte.

### Sesgos, confusión y causalidad
- **Sesgo de selección** (quién entra), **de información** (cómo se mide; el recuerdo de la dieta es poco fiable), **de publicación** (se publican más los resultados positivos), **de supervivencia**.
- **Confusión:** un tercer factor asociado a la exposición y al resultado. En nutrición destaca el **«efecto del consumidor saludable»** (quienes comen más fibra también hacen más ejercicio y fuman menos).
- **Error de medida de la dieta:** los cuestionarios de frecuencia subestiman y clasifican mal; las asociaciones suelen atenuarse.
- **Correlación no es causalidad.** Los criterios de Bradford Hill (fuerza, consistencia, temporalidad, gradiente dosis-respuesta, plausibilidad biológica, evidencia experimental…) ayudan a razonar sobre causalidad **[M]**.
- **Desenlaces sustitutos** (colesterol, glucemia) no equivalen a desenlaces clínicos (infarto, mortalidad).

### Medidas de efecto
- **Riesgo absoluto (RA):** probabilidad de un suceso en un grupo.
- **Riesgo relativo (RR)** = RA expuestos ÷ RA no expuestos. **Reducción absoluta del riesgo (RAR)** = diferencia de riesgos. **NNT** (número necesario a tratar) = 1 ÷ RAR.
- **Odds ratio (OR):** razón de odds; se parece al RR solo si el suceso es poco frecuente.
- **El mismo RR puede ser trivial o enorme según el riesgo de partida.** Un titular de «reduce el riesgo a la mitad» dice poco sin el riesgo absoluto.
- **Intervalo de confianza (IC 95 %):** rango de valores compatibles con los datos bajo los supuestos del modelo. Si incluye el valor de no efecto (RR = 1) no se descarta que no haya efecto, y su amplitud indica la **precisión**.
- **Valor p:** probabilidad de obtener un resultado igual o más extremo si la hipótesis nula fuese cierta; **no** es la probabilidad de que la hipótesis sea cierta ni mide la importancia del efecto. «Significativo» no significa «importante»; «no significativo» no significa «no hay efecto».
- **Relevancia clínica:** el tamaño del efecto debe importar a la persona y al sistema.
- **Heterogeneidad** (en metaanálisis): variabilidad entre estudios; el estadístico I² se lee orientativamente como baja, moderada o alta con umbrales de uso extendido (25, 50 y 75 %) **[M]**, pero requiere explicar sus causas.

### GRADE: certeza de la evidencia [M]
- Califica la **certeza** por desenlace: alta, moderada, baja o muy baja.
- Los ensayos parten de certeza alta y los estudios observacionales de baja. Se **baja** por riesgo de sesgo, inconsistencia, evidencia indirecta, imprecisión y sesgo de publicación, y se puede **subir** por gran efecto, gradiente dosis-respuesta o por confusión que iría contra el efecto observado.
- **Recomendación ≠ evidencia:** depende también de valores y preferencias, equilibrio de beneficios y daños, costes y viabilidad. Puede haber una recomendación fuerte con evidencia baja, y al contrario.

### Lectura crítica: preguntas prácticas
1. ¿Qué pregunta hace y qué población incluye?
2. ¿Es un estudio que permite atribuir causalidad? ¿Qué confusión es probable?
3. ¿Cómo se midió la exposición y el desenlace?
4. ¿Cuánto es el efecto (absoluto), con qué precisión y es relevante?
5. ¿Hay conflicto de interés o financiación que condicione?
6. ¿Es coherente con el resto de la evidencia? ¿Se ha replicado?
7. ¿Se puede aplicar a mi paciente?

### Actualización de recomendaciones
- Las guías se actualizan; hay que fechar cada recomendación y revisar periódicamente. Una cifra o texto sin fuente ni fecha es una deuda técnica.

## Fórmulas
- RR = RA₁ ÷ RA₀; RAR = RA₀ − RA₁; NNT = 1 ÷ RAR; reducción relativa del riesgo = (1 − RR) × 100.

## Errores frecuentes
1. Confundir asociación con causalidad.
2. Dar solo el riesgo relativo.
3. Interpretar «p > 0,05» como «no hay efecto».
4. Valorar un estudio solo por su tipo, sin mirar su calidad.
5. Generalizar un resultado de una población a otra.
6. Citar una recomendación sin fecha ni fuente.

## Limitaciones y controversias
- Peso de los estudios observacionales en nutrición; validez de los cuestionarios de frecuencia; qué hacer cuando la evidencia es baja pero hay que decidir.

## Criterios para NutriFit [C]
- **Fuentes:** las ayudas y textos del producto (`src/help`, textos legales) no citan una fuente por afirmación nutricional; la calculadora cita fórmulas en comentarios del código, pero no muestra la fuente al usuario.
- **Reclamos de salud:** en la UE las declaraciones nutricionales y de propiedades saludables están reguladas (Reglamento (CE) 1924/2006) **[M]**. Convendría revisar los textos públicos y de marketing del producto para no atribuir efectos que no estén autorizados.
- **Lo que está bien:** las funciones se describen como ayudas («una ayuda para decidir, no un criterio clínico») y varias reglas son conservadoras por diseño (reajuste con 14 días de espera, mínimo de pesajes y suelo de 1.200 kcal).

## Casos prácticos
Los del examen (secciones B y C).

## Bibliografía
**[M]**: Guyatt et al., serie GRADE (*BMJ* 2008; *J Clin Epidemiol* 2011); Cochrane, *Handbook for Systematic Reviews of Interventions*; Bradford Hill A (1965); Higgins y Thompson sobre I²; Hernán y Robins, *Causal Inference*; AGREE II (calidad de guías); Reglamento (CE) 1924/2006; Ioannidis sobre estudios de nutrición.

## Examen

### A. Teórico (6 preguntas)
1. ¿Por qué un ensayo aleatorizado controla mejor la confusión que una cohorte?
2. Explica el «efecto del consumidor saludable».
3. ¿Qué es y qué no es un valor p?
4. ¿Qué indica la amplitud de un intervalo de confianza?
5. Los dominios que bajan la certeza en GRADE.
6. ¿Por qué una recomendación fuerte puede basarse en evidencia de baja certeza?

### B. Aplicado (3 problemas)
1. Riesgo del 8 % en el grupo control y del 6 % en el de intervención: RR, RAR y NNT.
2. «Reduce el riesgo en un 50 %»: el riesgo de base es de 2 por 1.000. Calcula RAR y NNT.
3. Un estudio da OR = 1,20 (IC 95 %: 0,95 a 1,51). Interpreta.

### C. Razonamiento (2 casos)
1. Un estudio de cohortes encuentra que quien toma más café tiene menor riesgo de una enfermedad y el titular dice «el café previene la enfermedad». Analiza.
2. Una guía recomienda una intervención con evidencia de baja certeza. ¿Cómo la usarías en un producto y cómo lo comunicarías?

## Respuestas de la IA (sin corregir)

**A1.** Porque la asignación al azar reparte entre los grupos, en promedio, los factores conocidos y desconocidos, de modo que las diferencias de resultado pueden atribuirse a la intervención; en una cohorte los grupos se forman por elección y difieren en otros factores.

**A2.** Quienes eligen una dieta «saludable» suelen tener otros hábitos favorables (ejercicio, menos tabaco, mejor nivel socioeconómico), de modo que una asociación observada puede deberse a esos hábitos y no a la dieta.

**A3.** Es la probabilidad de observar un resultado igual o más extremo si la hipótesis nula fuera cierta. No es la probabilidad de que la hipótesis sea cierta, no mide la importancia del efecto ni demuestra que no haya efecto cuando es alto.

**A4.** La precisión de la estimación: un intervalo estrecho indica una estimación precisa; uno ancho, incertidumbre. Si incluye el valor de no efecto, los datos son compatibles con que no lo haya.

**A5.** Riesgo de sesgo, inconsistencia, evidencia indirecta, imprecisión y sesgo de publicación.

**A6.** Porque depende además del equilibrio entre beneficios y daños, los costes, las preferencias y la viabilidad: si el daño potencial es grande y la intervención es barata y sencilla, puede recomendarse con firmeza aunque la certeza sea baja.

**B1.** RR = 6 ÷ 8 = 0,75; RAR = 8 − 6 = 2 puntos porcentuales; NNT = 1 ÷ 0,02 = 50.

**B2.** Riesgo de base 2 por 1.000 (0,2 %); con una reducción relativa del 50 %, el riesgo pasa a 1 por 1.000. RAR = 1 por 1.000 (0,1 %) y NNT = 1 ÷ 0,001 = 1.000.

**B3.** Una asociación con un aumento estimado del 20 % de las odds, pero el IC incluye 1 (de 0,95 a 1,51): los datos son compatibles con ningún efecto, con una reducción pequeña o con un aumento apreciable; la precisión es limitada y no se puede concluir un efecto. Requiere más datos o un diseño con mejor control de la confusión.

**C1.** Es un estudio observacional: muestra asociación, no causa. Posibles confusores (tabaco, ejercicio, nivel socioeconómico, otras dietas), causalidad inversa (quien está enfermo puede dejar el café), error de medida de la ingesta y sesgo de supervivencia. El titular no está justificado; cabría decir «se asocia con». Para causalidad se necesitarían ensayos o evidencia convergente (Bradford Hill).

**C2.** La usaría como una recomendación **condicionada**, con su fuente, fecha y certeza visibles, de forma que sea una ayuda y no una orden; incluiría el criterio profesional, evitaría un lenguaje de certeza y planificaría una revisión cuando salga evidencia nueva. En producto, evitaría automatizar decisiones basadas en ella.

## Criterios de corrección
- **Teórico:** 1 punto por respuesta correcta y completa; 0,5 incompleta; 0 con error conceptual grave.
- **Aplicado:** cálculo correcto e interpretación con riesgo absoluto.
- **Razonamiento:** identifica sesgos y confusión, no sobreafirma y propone comunicación honesta.
- **Nota:** teórico 40 %, aplicado 30 %, razonamiento 30 %. **La corrige el usuario.**

## Aplicaciones a NutriFit
1. **Etiquetar cada contenido y cálculo con fuente, fecha y certeza** (p. ej. «Mifflin-St Jeor, 1990»; «PRI de proteína, EFSA 2012»).
2. **Política de revisión**: fecha de última revisión y responsable por cada texto o regla clínica.
3. **Registro de cambios** de reglas de cálculo, con prueba que lo cubra.
4. **Revisión de textos de marketing** frente a la normativa de declaraciones de salud.
5. **No automatizar decisiones** con evidencia de baja certeza.
