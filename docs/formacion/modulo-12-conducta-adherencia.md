# Módulo 12. Conducta alimentaria, psicología y adherencia

Leyenda: **[V]** verificado en esta formación · **[M]** de memoria, sin verificar · **[C]** comprobado en el código de NutriFit. Examen respondido por la IA, **sin corregir**.

## Objetivos
1. Entender los factores que determinan lo que comemos más allá del conocimiento.
2. Conocer técnicas de cambio de conducta y comunicación con evidencia razonable.
3. Detectar señales de trastornos de la conducta alimentaria y actuar con prudencia.
4. Diseñar seguimiento y mensajes que apoyen la adherencia sin estigmatizar.

## Desarrollo

### Qué determina la conducta alimentaria
- **Hambre y saciedad fisiológicas** (Módulo 1), **entorno alimentario** (disponibilidad, precio, tamaño de porción), **factores sociales y culturales**, **emociones y estrés**, **hábitos** y **aprendizaje**.
- La **educación nutricional** (informar) **no basta** para cambiar la conducta: la información es una condición necesaria pero no suficiente.
- **Alimentación emocional:** comer en respuesta a emociones; no es un fallo moral y conviene explorar qué función cumple.

### Modelos y técnicas
- **Modelo COM-B y Rueda del cambio de conducta (Michie y cols.):** la conducta depende de capacidad, oportunidad y motivación **[M]**. Sirve para analizar qué barrera hay antes de intervenir.
- **Entrevista motivacional (Miller y Rollnick):** estilo colaborativo que explora la ambivalencia, con evidencia de efecto pequeño a moderado en conductas de salud **[M]**. Principios: empatía, evitar la discusión, apoyar la autoeficacia.
- **Teoría de la autodeterminación:** la motivación sostenida se apoya en autonomía, competencia y vínculo **[M]**.
- **Objetivos conductuales:** concretos, pequeños, medibles y elegidos con la persona («añadir una verdura en la comida, 5 días») en lugar de resultados («perder 5 kg»).
- **Intenciones de implementación** («si ocurre X, haré Y»): ayudan a trasladar la intención a la acción **[M]**.
- **Formación de hábitos:** el estudio de Lally et al. (2010) estimó una mediana de unos 66 días con mucha variabilidad (de 18 a 254 días) **[M]**; no existe un plazo mágico.
- **Autoseguimiento:** el registro de peso, comidas o actividad se asocia a mejores resultados en las revisiones sistemáticas **[M]**, pero puede ser incómodo o problemático en personas vulnerables a los trastornos.
- **Mindfulness y atención a las señales de hambre y saciedad:** beneficios en algunos contextos, con evidencia limitada y heterogénea **[M]**.

### Trastornos de la conducta alimentaria (TCA)
- **Tipos:** anorexia nerviosa, bulimia nerviosa, trastorno por atracón, trastorno de evitación o restricción de la ingesta (ARFID) y otros especificados.
- **Señales de alerta:** preocupación intensa por el peso o la forma, restricción marcada, conductas compensatorias (vómitos, laxantes, ejercicio excesivo), atracones, rituales con la comida, pérdida de peso rápida, amenorrea, aislamiento social.
- **Cribado breve:** el cuestionario SCOFF (cinco preguntas) se usa para sospechar TCA; es un cribado, no un diagnóstico **[M]**.
- **Actuación:** **no dar planes de pérdida de peso** ante la sospecha; hablar con respeto y sin juicio; **derivar** a un equipo especializado (médico, psicología o psiquiatría, dietista especializado) y coordinar. Una dieta restrictiva puede desencadenar o agravar un TCA.

### Estigma del peso y comunicación
- El **estigma por el peso** se asocia a evitación de la atención sanitaria, peor bienestar y más conductas alimentarias desadaptativas **[M]**.
- Comunicación: usar lenguaje neutro («peso» o «IMC» más que «obesidad» como etiqueta), pedir permiso antes de hablar del peso, centrarse en conductas y salud, y no culpar.

### Adherencia y éxito más allá del peso
- La adherencia mide lo que la persona **hace**, no lo que debería hacer; una baja adherencia suele indicar barreras (tiempo, coste, cocina, apoyo, emociones), no falta de voluntad.
- **Indicadores útiles:** consistencia de hábitos elegidos, energía y sueño, digestión, rendimiento, analíticas, medidas, percepción de bienestar y control, y la propia relación con la comida. El peso es uno más.
- **Principio de diseño:** un día sin registro **no** es un día fallado; el sistema debe distinguir «no registró» de «no cumplió».

## Fórmulas y procedimientos
- **Análisis COM-B:** ¿qué falta: capacidad, oportunidad o motivación?
- **Objetivo conductual SMART:** específico, medible, alcanzable, relevante y con plazo.
- **Frecuencia de seguimiento:** adaptar a la persona y revisar si el registro empeora su relación con la comida.

## Errores frecuentes
1. Dar información y dar por hecho que cambiará la conducta.
2. Fijar metas solo en kilos.
3. Culpabilizar por la baja adherencia.
4. Ignorar señales de TCA y dar un plan de adelgazamiento.
5. Usar rachas y puntuaciones que castigan un día perdido.
6. Usar un lenguaje que estigmatiza el peso.

## Limitaciones y controversias
- Eficacia comparada de técnicas psicológicas en nutrición; el autoseguimiento en personas vulnerables a TCA; cómo medir adherencia sin sesgo.

## Qué hace NutriFit hoy [C]
- **Adherencia:** `calcAdherence` cuenta un día **sin check-in como no adherente** (el denominador son todos los días): un olvido baja el porcentaje; los check-ins con «no seguí el plan» también. La racha (`calcStreak`) se **rompe a 0** al faltar un día. Esto contradice el principio de que un día sin registro no es un día fallado y puede producir **culpa por la racha**; además esa adherencia alimenta las alertas del nutricionista y el umbral del 70 % del reajuste.
- **Objetivos:** el cliente tiene un objetivo general (perder peso, ganar masa, mantenimiento, salud, rendimiento) y un peso objetivo; **no hay objetivos conductuales**.
- **Lo que está bien:** opción de **ocultar cifras** de calorías y macros a un cliente, tono neutro en el balance diario y en la fecha estimada (sin mensajes de «vas mal»), check-in con hambre, energía, ánimo y digestión, medidas que el cliente puede apuntar, y pasos opcionales sin objetivo.
- **No hay** cribado de TCA ni banderas de derivación, ni registro de factores conductuales.

## Casos prácticos
Los del examen (secciones B y C).

## Bibliografía
**[M]**: Michie S, van Stralen MM, West R, *The behaviour change wheel* (*Implement Sci* 2011); Miller WR, Rollnick S, *Motivational Interviewing*; Deci y Ryan, teoría de la autodeterminación; Lally et al., *Eur J Soc Psychol* 2010; Gollwitzer, intenciones de implementación; Burke et al., *J Am Diet Assoc* 2011 (autoseguimiento); Morgan et al., cuestionario SCOFF (*BMJ* 1999); American Psychiatric Association, DSM-5-TR; NICE, guía de trastornos de la conducta alimentaria; Puhl y Heuer sobre estigma del peso.

## Examen

### A. Teórico (6 preguntas)
1. ¿Por qué la información nutricional por sí sola no cambia la conducta?
2. Componentes del modelo COM-B.
3. Qué es un objetivo conductual y un ejemplo frente a un objetivo de resultado.
4. Señales de alerta de un trastorno de la conducta alimentaria.
5. Qué haces si sospechas un TCA y por qué.
6. ¿Por qué no es buena práctica medir el éxito solo con el peso?

### B. Aplicado (3 problemas)
1. En una semana, un cliente rellenó el check-in 5 de 7 días: en 4 marcó «sí seguí el plan» y en 1, «parcial». Calcula la adherencia con la regla actual de NutriFit (cuentan «sí» y «parcial», no cuenta «no», y el denominador son los 7 días) y con la misma regla pero **sobre los días registrados**.
2. Un cliente lleva 12 días de racha, olvida un día y la racha pasa a 0. Describe el efecto psicológico probable y una alternativa de diseño.
3. Escribe tres objetivos conductuales SMART para una persona que come poca verdura y cena tarde.

### C. Razonamiento (3 casos)
1. Una clienta de 22 años, con IMC bajo, pide «adelgazar 5 kilos más» y habla de «comidas prohibidas» y de ejercicio diario sin descanso. ¿Qué haces?
2. Un cliente con adherencia del 55 % a las 3 semanas dice que «no tiene fuerza de voluntad». ¿Cómo lo abordas?
3. Se propone una puntuación semanal con puntos y rachas que se pierden al fallar. ¿Qué respondes?

## Respuestas de la IA (sin corregir)

**A1.** Porque la conducta depende además de capacidad (habilidades), oportunidad (entorno, tiempo, dinero) y motivación; la información solo mejora el conocimiento, que es una condición necesaria pero no suficiente.

**A2.** Capacidad (física y psicológica), oportunidad (física y social) y motivación (reflexiva y automática), que determinan la conducta.

**A3.** Un objetivo conductual es una acción concreta y controlable por la persona («añadir una ración de verdura en la comida 5 días a la semana»), frente a un objetivo de resultado, que depende de muchas variables («perder 5 kg»).

**A4.** Preocupación intensa por peso y forma, restricción marcada, conductas compensatorias, atracones, rituales con la comida, pérdida de peso rápida, alteraciones menstruales y aislamiento social.

**A5.** No doy un plan de pérdida de peso: me comunico con respeto, valoro riesgo físico y derivo a un equipo especializado, coordinándome con él; una dieta restrictiva podría desencadenar o agravar el cuadro.

**A6.** Porque el peso fluctúa y no refleja conductas, salud ni bienestar; centrarse solo en él puede desmotivar, favorecer conductas extremas y ocultar mejoras en energía, analíticas o hábitos.

**B1.** Regla actual (`calcAdherence`): los 5 días con check-in cuentan como adherentes (4 «sí» y 1 «parcial»; solo «no» no cuenta) y los 2 sin check-in no cuentan; el denominador son los 7 días: 5 ÷ 7 ≈ 71 %. Con la misma regla sobre los días registrados: 5 ÷ 5 = 100 %. Si solo contara el «sí» sobre los días registrados, serían 4 ÷ 5 = 80 %. La diferencia (71 % frente a 100 %) muestra cómo los olvidos penalizan: dos días sin registrar bajan casi 30 puntos aunque todo lo anotado fuese bueno.

**B2.** Es probable que la persona sienta frustración o culpa y abandone el registro; una alternativa es una racha con «días de gracia» (por ejemplo 1 por semana) o medir «días con registro en las últimas 4 semanas», sin reiniciar a 0.

**B3.** (1) «Añadir una verdura en la comida y otra en la cena 4 días a la semana, durante 3 semanas». (2) «Cenar antes de las 21:30 al menos 3 noches por semana, preparando la cena el día anterior». (3) «Llevar una pieza de fruta o verdura cruda para la media mañana 5 días a la semana».

**C1.** No le doy un plan de pérdida de peso. Con IMC bajo y señales de restricción y ejercicio compulsivo hay sospecha de TCA: hablo sin juicio, valoro el riesgo físico (pérdida de peso, menstruación, síntomas) con un cribado como el SCOFF y derivo a su médico y a un equipo especializado, coordinando mi intervención con ellos.

**C2.** Reformulo: la baja adherencia indica barreras, no falta de fuerza de voluntad. Exploro con preguntas abiertas qué dificulta seguir el plan (tiempo, cocina, hambre, entorno, emociones), pruebo con un análisis COM-B, simplifico el plan, pacto un objetivo conductual pequeño y reviso en una semana.

**C3.** Que no recomiendo puntuaciones que se pierden al fallar: pueden generar culpa y abandono. Sugeriría un reconocimiento del esfuerzo y la consistencia a lo largo de un periodo (con días de gracia), sin penalizar un día sin registro, y revisar con un profesional de la conducta si hay riesgo de TCA.

## Criterios de corrección
- **Teórico:** 1 punto por respuesta correcta y completa; 0,5 incompleta; 0 con error conceptual grave.
- **Aplicado:** cálculo correcto con la regla indicada; propuestas concretas y medibles.
- **Razonamiento:** evita culpabilizar, prioriza la seguridad en TCA y propone diseño de bajo riesgo.
- **Nota:** teórico 40 %, aplicado 30 %, razonamiento 30 %. **La corrige el usuario.**

## Aplicaciones a NutriFit
- **Decisión pendiente (M2 del informe de MacroFactor):** que la adherencia distinga «no registró» de «no cumplió» y que la racha admita días de gracia; revisar el efecto sobre las alertas y el umbral del reajuste.
- **Objetivos conductuales** además del peso, con seguimiento propio.
- **Cribado de TCA y banderas de derivación** configurables, y **no ofrecer cálculo de pérdida de peso** si el profesional marca la sospecha.
- **Mensajes revisados**: lenguaje neutro, sin reproche; evitar puntuaciones punitivas.
