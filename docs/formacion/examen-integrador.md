# Examen integrador

Combina nutrición, dietética, práctica profesional e ingeniería de software. Leyenda: **[V]** verificado en esta formación · **[M]** de memoria, sin verificar · **[C]** comprobado en NutriFit. Examen respondido por la IA, **sin corregir**: lo corrige el usuario.

## Instrucciones
- Cada respuesta separa **dato, hipótesis y decisión**, indica **supuestos** y señala **cuándo derivar**.
- Los cálculos muestran el procedimiento. Las referencias llevan su nivel de verificación.

## A. Teórico integrado (6 preguntas)
1. Explica por qué un objetivo calórico calculado con una ecuación debe revisarse con la evolución real, conectando fisiología (Módulo 1) y diseño de producto (Módulos 4 y 15).
2. ¿Qué significa que una dieta sea «adecuada» más allá de energía y macros? Incluye micronutrientes, seguridad y contexto.
3. ¿Qué principios deben guiar un sistema de exclusión de alérgenos y por qué?
4. ¿Cómo se debe medir el éxito de una intervención y qué indicadores evitarías como único criterio?
5. Distingue evidencia, recomendación y regla de producto, con un ejemplo de NutriFit.
6. ¿Qué obligaciones y riesgos de datos de salud debe tener presentes un profesional que usa una plataforma?

## B. Aplicado integrado (4 problemas)
1. **Cálculo.** Mujer de 34 años, 68 kg, 165 cm, trabajo sedentario y entrenamiento de fuerza 3 días por semana. Objetivo: perder 4 kg. Usa Mifflin-St Jeor y un factor de actividad de 1,55 con un déficit del −15 %; proteína 1,6 g/kg y grasa 0,9 g/kg. Da energía, macros y fibra por 14 g por 1.000 kcal, y la pérdida semanal teórica con la regla de 7.700 kcal/kg.
2. **Micronutrientes.** La misma mujer, vegetariana, ingiere unos 11 mg de hierro al día. Compara con el PRI citado y explica qué harías.
3. **Evidencia.** Un estudio dice que una dieta reduce el riesgo de un suceso del 4 % al 3 %. Calcula RR, RAR y NNT.
4. **Software.** Un plan tiene tres ítems con 12,4 g de grasa cada uno, que el sistema redondea a entero antes de sumar. Calcula la diferencia con el total exacto y propone un test.

## C. Casos integrados (3)
1. **Caso clínico y de consulta.** La misma mujer tiene antecedente de anemia ferropénica, alergia a los frutos secos y refiere que «lleva años de dietas». Plantea evaluación, objetivos conductuales, plan, seguimiento y señales de derivación.
2. **Caso de seguridad de producto.** Se descubre que el detector de alérgenos no avisa del seitán a una persona celíaca. Plantea gestión del incidente, corrección, pruebas y prevención.
3. **Caso de priorización.** Tienes una lista de mejoras (alérgenos, calculadora, calidad del catálogo, adherencia, modelo de datos, ficha inicial) y poco tiempo: ordena con criterios, dependencias y decisiones del usuario.

## Respuestas de la IA (sin corregir)

### A. Teórico integrado

**A1.** Las ecuaciones estiman el gasto con un error individual de cientos de kcal; además el gasto cambia al perder peso y existe adaptación metabólica, y el factor de actividad es subjetivo (Módulos 1 y 4). Por eso el objetivo es una hipótesis de partida y debe corregirse con la evolución (tendencia de peso, medidas, hambre, energía) en 2-4 semanas, con cambios pequeños y sin tocar dos cosas a la vez. En el producto, esto se traduce en mostrar rangos y método, en reajustes conservadores (espera, mínimo de datos, suelo de energía) y en registrar qué ecuación y factor se usaron.

**A2.** Adecuada incluye: energía acorde al objetivo; proteína suficiente; grasa e hidratos de calidad; **fibra**; **micronutrientes** cubiertos (hierro, calcio, yodo, B12, vitamina D según el caso); **variedad**; **seguridad** (alergias, intolerancias, medicación, situación fisiológica); **viabilidad** (preferencias, cultura, presupuesto, tiempo) y **adherencia**. Cumplir calorías y macros no garantiza nada de lo demás.

**A3.** Principios: datos **estructurados** (no deducir del nombre); cubrir las 14 categorías de la UE; **fallar hacia el lado seguro** (sin información = «sin verificar»); distinguir alergia, intolerancia y preferencia; considerar trazas y contaminación cruzada; mensajes honestos («no sustituye la etiqueta»); casos de referencia con revisión cualificada y pruebas automáticas. La razón: el falso negativo puede causar un daño grave a una persona.

**A4.** Con varios indicadores: hábitos elegidos y sostenidos, energía y sueño, digestión, rendimiento, analíticas, medidas y la relación con la comida; el peso es uno más. Evitaría el peso como único criterio (fluctúa, no refleja conducta ni salud, puede favorecer conductas extremas) y la adherencia calculada penalizando días sin registro.

**A5.** Evidencia: lo que muestran los estudios con una certeza concreta (por ejemplo, Hall 2011 sobre la dinámica del peso). Recomendación: lo que se aconseja, incorporando valores, daños y costes (por ejemplo, un déficit moderado y un suelo de 1.200 kcal). Regla de producto: la decisión técnica que lo implementa (el reajuste de NutriFit amortigua a la mitad, limita a ±250 kcal y espera 14 días). Cada una debe indicar su fuente, fecha y límites.

**A6.** Los datos de salud son una categoría especial del RGPD: exigen base legal, información, minimización, seguridad, contrato de encargado con el proveedor, derechos del interesado y registro. Hay deber de conservar la historia clínica (con plazos) y de confidencialidad, y la plataforma no es un archivo oficial, por lo que hay que exportar y conservar la documentación. Riesgos: canales inseguros, notificaciones con datos clínicos, borrados irreversibles y accesos no controlados.

### B. Aplicado integrado

**B1.** GER (Mifflin, mujer) = 10·68 + 6,25·165 − 5·34 − 161 = 680 + 1.031,25 − 170 − 161 = **1.380,25 kcal**. Gasto total = 1.380,25 × 1,55 ≈ **2.139 kcal**. Objetivo = 2.139 × 0,85 ≈ **1.818 kcal**. Proteína = 1,6 × 68 = **109 g** (436 kcal). Grasa = 0,9 × 68 ≈ **61 g** (551 kcal). Hidratos = (1.818 − 436 − 551) ÷ 4 ≈ **208 g**. Fibra = 14 × 1,818 ≈ **25 g**. Déficit = 2.139 − 1.818 = 321 kcal/día → 321 × 7 = 2.247 kcal/semana → ÷ 7.700 ≈ **0,29 kg/semana** (≈0,43 % del peso por semana); es una estimación estática que probablemente sobrestima la pérdida a largo plazo. Revisión a las 3-4 semanas con tendencia de peso, medidas y adherencia.

**B2.** El PRI citado para mujeres premenopáusicas es de 16 mg/día [V parcial]; 11 mg está por debajo, pero eso no basta para hablar de déficit. Con antecedente de anemia ferropénica y dieta vegetariana, pido analítica reciente al médico (hemoglobina, ferritina interpretada con la inflamación), valoro pérdidas menstruales, mejoro el hierro no hemo (legumbres, cereales integrales, verduras de hoja) combinado con vitamina C y separo té o café de las comidas, y derivo para valorar si hay indicación de suplemento; no suplemento por mi cuenta.

**B3.** RR = 3 ÷ 4 = 0,75; RAR = 4 − 3 = 1 punto porcentual; NNT = 1 ÷ 0,01 = 100. Un «riesgo un 25 % menor» equivale a que 100 personas deben seguir la dieta para evitar un suceso.

**B4.** Redondeo previo: 12 + 12 + 12 = 36 g; total exacto: 37,2 g (≈37 g). Diferencia de 1,2 g (≈3 %). Test de propiedad: el total de grasa de un plan debe ser igual a la suma exacta de los ítems (tolerancia de redondeo de presentación), para cualquier combinación de ítems; y el redondeo debe aplicarse solo al mostrar.

### C. Casos integrados

**C1.** **Evaluación:** historia clínica y dietética (ciclo menstrual y pérdidas, síntomas de anemia, medicación, antecedentes de TCA con un cribado como el SCOFF), historia de dietas y de peso, alimentación actual (recordatorio de 24 h o registro de 3 días), actividad y sueño, y analítica reciente (hemoglobina, ferritina con inflamación, B12). **Seguridad:** alergia a frutos secos (excluir y vigilar la contaminación cruzada; revisar etiquetas); si hay señales de TCA, no iniciar un plan de pérdida y derivar. **Objetivos:** conductuales y pactados (p. ej. «cenar verdura 5 noches», «incluir una fuente de hierro con vitamina C en 2 comidas»), y el peso como un indicador más. **Plan:** el cálculo de B1 como punto de partida, con rango; vegetariano con legumbres, huevos y lácteos; proteína repartida; hierro y B12 vigilados; sin frutos secos. **Seguimiento:** a 2-4 semanas con tendencia de peso, medidas, hambre y energía, adherencia (distinguiendo días sin registro) y analítica según el médico. **Derivar:** anemia sintomática o empeoramiento, sospecha de TCA, síntomas digestivos o menstruales alarmantes.

**C2.** **Contención:** avisar de inmediato al profesional, localizar los planes y recetas que contengan seitán y comprobar si algún cliente con gluten recibió un plan con él; contactar con los afectados para que no lo consuman. **Análisis:** el detector cruza el texto de alergia con el nombre y el seitán no está en las palabras de gluten (comprobado ejecutando el código). **Corrección:** crear primero una prueba que falle (celiaco + seitán), añadir el caso, ampliar a todo el catálogo (caballa, dorada, lubina, sardinas, calamar, pulpo, piñones, avena, cerveza, salsa de soja, tahini y sésamo) y reconocer «celiaquía»; mostrar «sin verificar» para alimentos sin datos. **Prevención:** alérgenos estructurados por alimento, casos de referencia revisados por una persona cualificada, revisión periódica y un texto «no sustituye la lectura de la etiqueta». **Registro** del incidente y de lo comunicado.

**C3.** **Criterios:** riesgo de daño a una persona, probabilidad, esfuerzo, dependencias y si requiere una decisión del usuario. **Orden propuesto:** (1) **alérgenos** (daño directo, acotado, sin decisiones previas); (2) **calculadora** (suelo de energía, edad, coherencia de macros); (3) **calidad del catálogo** (datos duplicados, cero frente a nulo, fuentes) porque alimenta todo lo demás; (4) **modelo de datos** de los planes (identificador del alimento y cantidades numéricas) con migración cuidadosa; (5) **adherencia** (tras la decisión del usuario sobre días de gracia); (6) **ficha inicial, medicación y banderas de derivación**. Decisiones del usuario: adherencia, nivel de bloqueo de la calculadora y revisor clínico de contenidos.

## Criterios de corrección
- **Teórico (A):** 1 punto por respuesta correcta y completa; 0,5 si es correcta pero incompleta; 0 con error conceptual grave.
- **Aplicado (B):** planteamiento, unidades, resultado y supuestos; si usa una referencia, que indique su fuente y su nivel de verificación.
- **Casos (C):** separa dato, hipótesis y decisión; prioriza seguridad; propone la intervención más pequeña útil; no da reglas universales; deriva cuando corresponde; respeta el ámbito profesional.
- **Nota:** teórico 30 %, aplicado 30 %, casos 40 %; aprobado con 8,5 o más. **La corrige el usuario.**
