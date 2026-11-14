# Recuperación del Módulo 16

Leyenda: **[V]** verificado en esta formación · **[M]** de memoria, sin verificar · **[C]** comprobado en el código, los textos o la base de datos de NutriFit (solo lectura, 2026-11-14). Los dos ejercicios están respondidos por la IA y **sin puntuar**: los corrige el usuario.

## Corrección recibida del examen del Módulo 16
La corrección es del usuario y no sustituye a los criterios del módulo; se recoge aquí tal como se recibió, resumida.

| Apartado | Valoración recibida | Observación recibida |
|---|---|---|
| A (fundamentos) | 9,5/10 | Correcta. Matiz en A2: los **falsos positivos tampoco son inocuos** (restricciones innecesarias, ansiedad, menos variedad); la aplicación debe minimizar **ambos** errores. |
| B1 (alérgenos) | correcta con un matiz | «Marisco» es ambiguo: el modelo debe distinguir **crustáceos y moluscos** y no depender solo de las palabras del usuario. Acertado tratar lo desconocido como «sin verificar». |
| B2 (suelo de calorías) | necesita revisión | **1.200 kcal no es un umbral universal**; una confirmación profesional no convierte un objetivo insuficiente en adecuado. Rediseñar. |
| C1 (priorización) | correcta | Falta valorar la **exposición real** (usuarios afectados, si está desplegado, si hay riesgo activo). |
| C2 (incidente) | correcta pero incompleta | Faltan: suspender la función, identificar a **todos** los afectados (no solo por «seitán»), revisar recetas y compuestos, comunicar con urgencia, verificar antes de reactivar, valorar obligaciones de notificación, y **corregir el modelo**, no solo añadir una palabra. |
| Global | 9,0/10 orientativa | Dos ejercicios de recuperación: (1) rediseñar B2 sin 1.200 kcal como umbral universal; (2) protocolo completo de incidentes por alérgenos. |

### Correcciones a mis respuestas, con lo aprendido
- **A2.** Ambos errores cuestan. Falso negativo: exposición al alérgeno (daño potencial grave). Falso positivo: restricciones innecesarias, ansiedad, dieta menos variada y pérdida de confianza en el aviso («fatiga de alertas»: si todo avisa, nada se atiende). La métrica de un detector debe incluir **sensibilidad** (no perder alérgenos reales) y **especificidad** (no avisar de lo inocuo), con una política explícita de qué error se tolera menos en cada gravedad.
- **B1.** El modelo debe separar **crustáceos** y **moluscos** (la UE los lista por separado) y no depender de la palabra «marisco» del texto libre.
- **B2.** Se rehace abajo.
- **C1.** Se mide abajo la exposición real.
- **C2.** Se rehace como protocolo completo abajo.

## Exposición real medida hoy [C]
Consulta de solo lectura a la base de producción (agregados, sin nombres):
- **9 clientes**, todos activos; **1** tiene alergias escritas (frutos secos, almendra); ninguno escribe celiaquía o gluten, pescado, marisco o sésamo.
- Ítems de planes de clientes con alergia que el detector **no sabría marcar** y que chocan con su alergia: **0**. (La primera búsqueda dio 2 coincidencias, pero eran **falsos positivos de mi propia consulta**: «Champiñones» contiene «piñon» y «Crema de verduras» contiene «crema de». Se descartaron revisándolas una a una.)
- **Alcance y límites de esta medida:** solo planes actuales (no versiones anteriores, plantillas, recetas ni catálogo compartido) y solo por el nombre del alimento; un ingrediente compuesto («crema de verduras», salsas, embutidos) puede contener un alérgeno que el nombre no muestra. «Cero hoy» **no** significa «sin riesgo»: significa que **hoy no hay un conflicto demostrable**, pero el defecto está desplegado y el próximo cliente celíaco o alérgico al pescado quedaría expuesto.
- **Conclusión:** riesgo **latente** (defecto conocido y desplegado, con exposición medida nula en este momento). Justifica la prioridad alta de H1 y una **contención ligera** mientras se corrige (ver el protocolo).

---

# Ejercicio 1. Rediseño de B2: control de objetivos energéticos potencialmente demasiado restrictivos

## 1. Principios de diseño
1. **No existe un umbral universal de seguridad.** La necesidad energética depende de la persona, su situación clínica, composición corporal, actividad y objetivo. Ningún valor único garantiza seguridad por encima ni inseguridad por debajo.
2. **El sistema no certifica adecuación.** Su función es **detectar señales de que un objetivo necesita revisión profesional**, hacer **visible** el razonamiento y **registrar** la decisión. No dice «seguro» ni «adecuado».
3. **Una confirmación no arregla un objetivo insuficiente.** Por eso la confirmación va acompañada de **justificación, revisión anticipada y seguimiento**, no sustituye a ellos.
4. **Transparencia:** quien decide ve qué datos se usaron, qué ecuación y factor, cuánta incertidumbre tiene el cálculo y por qué salta el aviso.
5. **Minimizar ambos errores**: demasiados avisos generan fatiga y se ignoran; demasiado pocos dejan pasar situaciones de riesgo. Por eso las señales se combinan y se ajustan con revisión clínica.

## 2. Qué se evalúa: señales, no una cifra
El sistema calcula un conjunto de **señales**. Cada una tiene un identificador, una versión, una fuente y un revisor. Los valores concretos son **parámetros a validar por un revisor clínico**; los que se proponen aquí son **provisionales y no validados**.

| Señal | Qué comprueba | Valor inicial propuesto (provisional, sin validar) |
|---|---|---|
| S1. Contexto de la persona | edad menor de 18 años o mayor (según criterio), embarazo, lactancia, condición clínica declarada, sospecha de trastorno de la conducta alimentaria, medicación relevante, deporte con riesgo de baja disponibilidad de energía | basta una para exigir revisión; en TCA sospechado, ni se calcula pérdida de peso |
| S2. Objetivo frente a la estimación | objetivo ÷ GER estimado, y déficit relativo respecto al gasto total estimado | umbrales a definir con revisor; **el cálculo muestra siempre el rango de incertidumbre de la estimación** |
| S3. Ritmo previsto de cambio | % de peso por semana que implicaría el déficit, frente al rango del reajuste actual (0,3-1 % por semana de pérdida) | usar el mismo rango que ya usa el reajuste, para coherencia |
| S4. Disponibilidad energética | (ingesta − gasto del ejercicio) ÷ masa libre de grasa, si hay datos | citada como orientación en la literatura de RED-S **[M]**; solo si hay masa libre de grasa |
| S5. Valor absoluto | objetivo calórico absoluto | **umbral interno provisional de revisión: 1.200 kcal**, heredado de la práctica y del reajuste actual **[M]**; **no es una referencia clínica**; configurable; con fecha y revisor |
| S6. Coherencia | macros que suman más que el objetivo, hidratos en 0 por restas, proteína o grasa fuera de rango razonable | cualquier incoherencia exige corrección antes de aplicar |
| S7. Calidad de los datos | faltan peso, talla, edad o composición; valores inverosímiles | no calcular, o calcular marcando «datos insuficientes» |
| S8. Duración | tiempo previsto con el objetivo antes de la siguiente revisión | cuanto más restrictivo, más corta la revisión |

## 3. Estados y comportamiento
- **Sin señales:** se muestra el cálculo con rango y método, y se puede aplicar como hasta ahora.
- **Revisión requerida (una o más señales):** el objetivo **no se aplica automáticamente**. Se muestran las señales y su motivo. El profesional puede revisar, ajustar o aplicar con justificación.
- **Fuera de alcance (menor de edad, embarazo, lactancia, TCA sospechado):** no se ofrece cálculo de pérdida de peso; se muestra «requiere valoración especializada» y opciones de derivación y de registro.

## 4. Qué debe ocurrir al aplicar con señales
1. **Justificación obligatoria:** motivo estructurado (lista cerrada) más texto libre.
2. **Revisión anticipada obligatoria:** una fecha de revisión más temprana que la habitual.
3. **Plan de monitorización:** qué se va a vigilar (síntomas, energía, hambre, adherencia, señales de alerta) y qué hará que se detenga.
4. **Registro de auditoría inmutable:** quién, cuándo, valores anteriores y nuevos, señales activas, **versión de la regla**, justificación y fecha de revisión.
5. **Reversibilidad:** volver al objetivo anterior debe ser fácil y quedar registrado.
6. **Lenguaje:** «Este objetivo requiere revisión profesional. NutriFit no valida que sea adecuado.» Nunca «seguro», «recomendado» ni «dentro de lo saludable».

## 5. Modelo de datos y reglas (propuesta)
- **Reglas versionadas:** `id`, `version`, `descripción`, `fuente` (citada), `fecha`, `revisado_por`, `parámetros`.
- **Parámetros por cuenta** con valores por defecto, para que el profesional o su revisor clínico los ajusten con registro de cambios.
- **Tabla de revisiones de objetivo:** plan, usuario, instante, señales activas con sus valores, versión de reglas, decisión, justificación, fecha de revisión.

## 6. Relación con lo que existe [C]
- `dietAdjustment.ts` ya usa **1.200 kcal** como suelo; con este rediseño pasaría a ser el **mismo umbral interno provisional** (S5) y no un suelo «de seguridad».
- La calculadora debe usar el mismo motor de señales que el reajuste, para que las dos rutas apliquen la misma política.

## 7. Criterios de aceptación y pruebas
Criterios:
1. Ningún objetivo con señales activas se aplica sin justificación y fecha de revisión.
2. Todas las decisiones dejan registro con la versión de las reglas.
3. El cálculo original no cambia (las fórmulas y sus tests siguen pasando).
4. Ningún texto afirma que un valor es «seguro».
5. Las señales de contexto (S1) impiden el cálculo de pérdida de peso.

Casos de prueba: mujer de 50 kg sedentaria (1.045 kcal) → revisión requerida (S5, y S2 según parámetros); un objetivo justo en el umbral provisional y uno justo por encima → mismos mensajes sin falsa sensación de seguridad; 17 años → fuera de alcance; embarazo → fuera de alcance; macros incoherentes → no aplicar; datos faltantes → «datos insuficientes»; deportista con baja disponibilidad (S4); parámetros modificados por el profesional → el cambio queda registrado. Propiedades: «aplicar con señales sin justificación siempre falla» y «cada aplicación crea exactamente un registro».

## 8. Decisiones pendientes y límites
- **Revisor clínico** que valide las señales y sus parámetros (no las puede validar la IA).
- ¿El umbral absoluto es por defecto activo o configurable por el profesional?
- Qué es «fuera de alcance» exactamente en cada edad y situación.
- Este diseño reduce riesgo pero **no garantiza adecuación**; la responsabilidad clínica sigue siendo del profesional.

---

# Ejercicio 2. Protocolo de gestión de incidentes por alérgenos

Un **incidente por alérgenos** es cualquier situación en la que NutriFit pudo presentar como compatible un alimento o plan que contiene un alérgeno de una persona, o no avisó de él (falso negativo), o bloqueó sin motivo alimentos inocuos de forma sistemática (falso positivo con daño real).

## 0. Preparación (antes de que ocurra)
- **Roles:** responsable del incidente (decide), responsable técnico (corrige), responsable de comunicación (profesionales y clientes), revisor clínico (valida), y apoyo jurídico o de protección de datos. En NutriFit, de entrada son pocas personas: hay que **nombrarlas por escrito**.
- **Canales de detección:** pruebas automáticas de casos de referencia; auditoría periódica del catálogo; informes de profesionales y clientes (un botón o correo visible de «avisar de un problema con una alergia»); lecturas del código y de datos.
- **Plantilla de registro y matriz de gravedad** (abajo), contactos y plazos conocidos.

## 1. Detección y registro (inmediato)
- Abrir un **registro de incidente** con fecha, quién lo detecta, cómo y qué se sabe.
- No borrar ni «arreglar en silencio» antes de registrar el estado inicial (capturas, versión del código, fecha del despliegue).

## 2. Clasificación de la gravedad (en horas)
| Nivel | Situación | Respuesta |
|---|---|---|
| **Crítico** | exposición real probable a un alérgeno de una persona con alergia grave o celiaquía | contención inmediata, comunicación urgente a los afectados |
| **Alto** | defecto confirmado con riesgo de exposición, sin exposición demostrada | contención, análisis de impacto, comunicación a profesionales, corrección prioritaria |
| **Medio** | falsos positivos sistemáticos o información incompleta sin riesgo de exposición | corrección planificada, aviso informativo |
| **Bajo** | defecto de presentación sin efecto sobre decisiones | registro y corrección rutinaria |

## 3. Contención (inmediata, antes de la corrección completa)
Elegir la **medida mínima que reduzca el riesgo ya**, de menor a mayor impacto:
1. **Aviso visible** en el detector: «Comprobación orientativa: no sustituye la lectura de la etiqueta ni el criterio del profesional» (y, si procede, estado «sin verificar» para lo que no se puede asegurar).
2. **Marcar como «sin verificar»** las categorías afectadas hasta que se corrijan (en vez de «sin aviso»).
3. **Bloquear la aplicación o el envío de planes nuevos** a personas con alergias en las categorías afectadas hasta que el profesional confirme.
4. **Suspender la función** si no hay una medida intermedia segura.
Mientras dure, **no reactivar sin la verificación del punto 8**.

## 4. Análisis de impacto (identificar a TODOS los posibles afectados)
- **Personas:** todos los clientes con alergia, intolerancia o celiaquía **escritas o estructuradas**, con sus **variantes** y sinónimos («celiaquía», «celíaco», «sin gluten», «alergia al marisco», «moluscos»…), no solo los que contengan literalmente el alimento del defecto.
- **Contenido:** planes actuales **y versiones anteriores**, plantillas, recetas (propias y del sistema), ingredientes compuestos, alimentos propios, extras registrados por el cliente y listas de sustitución.
- **Alcance por categoría, no por palabra:** si el defecto es «seitán», revisar **todo el gluten** (avena, cerveza, salsas, embutidos, productos de trigo) y comprobar el resto de categorías con la misma tabla de casos.
- **Ventana de tiempo:** desde cuándo existe el defecto (historial de código y de despliegues) y qué planes se crearon o enviaron en ese periodo.
- **Qué vio el cliente:** si su app mostró un estado «compatible» o simplemente no mostró aviso; si recibió notificaciones.
- **Resultado:** lista de personas y planes con una de tres etiquetas: **conflicto confirmado**, **posible** (ingrediente compuesto o dato incompleto) y **sin conflicto**.

## 5. Comunicación
- **Primero a los profesionales responsables** de las personas posiblemente afectadas, con la lista concreta y la acción pedida («revisar este plan hoy»).
- **A la persona afectada**, de forma clara y urgente, a través del profesional o directamente si procede: qué pasó, qué alimento evitar, qué hacer si ya lo tomó (síntomas, a quién acudir) y que **no deje de seguir las indicaciones de su alergólogo ni de leer la etiqueta**. Sin alarma innecesaria y sin ocultar información.
- **Obligaciones de notificación:** un defecto de seguridad alimentaria de la aplicación **no es necesariamente una «violación de la seguridad de los datos»**. Aun así, **debe valorarse con apoyo jurídico**: (a) si afecta a la disponibilidad, integridad o confidencialidad de datos personales, aplica el mecanismo de brechas (el contrato de encargado de NutriFit obliga a avisar al responsable en un máximo de **48 horas** desde que se tenga constancia de una violación de la seguridad de los datos **[C]**); (b) los profesionales, como responsables, tienen sus propias obligaciones hacia sus pacientes; (c) si alguna función se considerase producto sanitario, habría obligaciones regulatorias adicionales **[M]**. **No se asume ninguna de las tres: se decide con asesoramiento.**
- **Registro** de qué se comunicó, a quién y cuándo.

## 6. Análisis de causa raíz
- **Más allá de «falta una palabra».** Preguntas: ¿por qué el sistema deduce alérgenos del nombre?, ¿por qué un alimento sin información aparece como compatible?, ¿por qué no había casos de referencia para todo el catálogo?, ¿por qué un nuevo alimento puede publicarse sin clasificación de alérgenos?
- **Causas típicas:** modelo basado en palabras clave, datos de alérgenos ausentes, falta de pruebas con el catálogo real, ausencia de un estado «sin verificar» y de revisión periódica.

## 7. Corrección (primero la prueba, después el cambio)
1. Escribir **pruebas que fallen** con los casos del incidente (y con todo el catálogo).
2. Corregir **el modelo**: alérgenos **estructurados** por alimento, receta e ingrediente con las 14 categorías de la UE (crustáceos y moluscos separados), alergias del cliente estructuradas (tipo y gravedad), estado **«sin verificar»** por defecto, y reglas de equivalencias y sinónimos.
3. **Puerta de calidad:** ningún alimento nuevo se publica sin clasificación de alérgenos o con el estado «sin verificar» visible.
4. Revisión del cambio por una **persona cualificada** (alérgenos y gluten no se validan solo con tests automáticos).

## 8. Verificación antes de reactivar
- Todas las pruebas, incluidos los casos de referencia del catálogo completo, en verde.
- **Barrido comparativo:** ejecutar la versión antigua y la nueva sobre **todos los planes y recetas existentes** y revisar cada diferencia.
- **Muestra revisada a mano** por el revisor clínico (incluidos compuestos y casos límite).
- Prueba en un entorno de ensayo con perfiles de alergia reales (anonimizados).
- Comprobar que **la contención se retira solo cuando** la verificación está firmada.
- Plan de **vuelta atrás** si aparece un fallo tras el despliegue.

## 9. Reactivación y cierre
- Reactivar, **vigilar** las primeras semanas (informes, registros) y **comunicar el cierre** a profesionales y afectados.

## 10. Revisión posterior
- Cronología, qué funcionó y qué no, causa raíz, acciones preventivas con responsable y fecha, y **actualización de la matriz y de los casos de referencia**. Auditoría periódica del catálogo (por ejemplo trimestral) y tras cada importación grande.

## Plantilla de registro de incidente
- Identificador y fecha de apertura; quién detecta y cómo.
- Descripción y categoría de alérgeno; gravedad (crítico, alto, medio o bajo).
- Versión del código y fecha del despliegue afectado; ventana de exposición.
- Contención aplicada y hora.
- Personas y planes afectados (con etiqueta: confirmado, posible, sin conflicto).
- Comunicaciones realizadas (a quién, cuándo, contenido).
- Causa raíz; acciones correctivas y preventivas con responsable y fecha.
- Verificación realizada y quién la firma; fecha de cierre; lecciones.

## Aplicación al hallazgo H1 de hoy
- **Clasificación propuesta:** **alto (riesgo latente)**: defecto confirmado y desplegado, exposición medida nula hoy.
- **Contención ligera recomendada ya** (decisión del usuario): aviso visible «orientativo, no sustituye la etiqueta» y estado «sin verificar» para las categorías sin cobertura, hasta corregir el modelo.
- **Comunicación:** informar a los cuatro profesionales con clientes de que la comprobación es orientativa y de las categorías sin cobertura; no hay cliente afectado hoy.
- **Corrección:** Fase 1 del Módulo 16 (modelo estructurado, casos de referencia, revisión cualificada).
- **Nada de esto se ha iniciado**: espera la decisión del usuario.

## Bibliografía
**[M]**: Reglamento (UE) 1169/2011 (alérgenos, crustáceos y moluscos como grupos distintos); RGPD, arts. 33-34 (brechas de seguridad); EAACI, guías de alergia alimentaria; buenas prácticas de gestión de incidentes y análisis causal (por ejemplo, los «cinco porqués»); ISO 14971 como referencia conceptual de gestión de riesgos **[M]**. **[C]**: contrato de encargado de tratamiento de NutriFit, cláusula de notificación de brechas (48 horas).
