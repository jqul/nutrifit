# Módulo 15. Ingeniería de software aplicada a la nutrición

Leyenda: **[V]** verificado en esta formación · **[M]** de memoria, sin verificar · **[C]** comprobado en el código o la base de datos de NutriFit (2026-11-14, solo lectura). Examen respondido por la IA, **sin corregir**. Este módulo es teoría y auditoría; **no se escribe código**.

## Objetivos
1. Modelar datos nutricionales (entidades, unidades, nulos, versiones) sin perder información ni introducir errores.
2. Decidir cómo calcular, redondear y validar.
3. Aplicar seguridad y privacidad a datos de salud.
4. Construir una estrategia de pruebas que proteja los cálculos y los flujos críticos.

## Desarrollo

### Modelado de datos nutricionales
- **Entidades principales:** profesional, persona atendida, alimento, nutriente (valor por alimento y fuente), receta y sus ingredientes, plan, comida del plan y sus ítems, medidas y registros, citas, documentos y consentimientos.
- **Valores con significado:** un nutriente puede ser **desconocido** (nulo), **cero** o un valor con **incertidumbre y fuente**; el modelo debe poder representarlo (Módulo 6).
- **Instantánea frente a referencia:** copiar el valor nutricional en el ítem del plan (instantánea) evita que un cambio en el catálogo altere planes ya entregados, pero rompe la trazabilidad y la propagación de correcciones. La decisión debe ser explícita: guardar el identificador del alimento **y** la instantánea con su versión.
- **Historial y versiones** de planes y de valores clínicamente relevantes.

### Unidades, conversiones y precisión
- **Una unidad base** interna (gramos y mililitros) y conversión en los bordes; conversiones de medidas caseras **dependen del alimento** (densidad).
- **Estado del alimento** (crudo, cocinado) explícito (Módulo 5).
- **Aritmética de decimales:** los números en coma flotante acumulan error; para sumas de nutrientes el error es despreciable si se calcula con toda la precisión y se **redondea solo al mostrar**; redondear cada ingrediente y sumar los redondeos produce diferencias visibles (la suma de los valores redondeados no es el redondeo de la suma).
- **Política de redondeo documentada:** cuántos decimales por nutriente, y de dónde sale cada total mostrado.
- **Validación de entrada:** números finitos, no negativos, con rangos plausibles (cantidad, peso, talla, edad), y **mensajes que expliquen** el límite.

### Integridad y calidad de datos
- **Claves y relaciones:** identificadores estables, claves foráneas y borrados en cascada pensados (un borrado accidental de un cliente no debe dejar huérfanos ni borrar lo que debe conservarse).
- **Restricciones en la base de datos** (rangos, valores permitidos), no solo en la interfaz.
- **Normalización de textos** (nombres de alimentos, sinónimos) y detección de duplicados.
- **Tipos adecuados:** números como números, fechas como fechas; evitar guardar cantidades como texto libre.

### Seguridad y privacidad
- **Autorización a nivel de datos** (políticas de acceso por fila): cada profesional ve solo a sus clientes y cada cliente solo lo suyo; probar las políticas con cuentas de cada rol.
- **Funciones privilegiadas** (que se ejecutan con los permisos de su creador) con comprobación explícita de quién las llama y con rutas de búsqueda fijas.
- **Secretos** fuera del código y rotables; **mínimo privilegio**; registro de accesos a datos sensibles; HTTPS y cifrado en reposo del proveedor.
- **RGPD:** minimización, finalidad, conservación, derechos (acceso, rectificación, supresión, portabilidad), registro de actividades, contrato de encargado y notificación de brechas **[M]**.
- **Cuidado con los datos de salud en logs, analítica y notificaciones** (un mensaje de aviso no debe contener datos clínicos en claro).

### Experiencia de usuario y accesibilidad
- Claridad ante todo: mostrar **rangos y límites** de lo estimado; no mostrar precisión falsa.
- **Accesibilidad** (WCAG 2.2 AA como referencia **[M]**): contraste, etiquetas de formularios y botones, navegación con teclado, tamaños táctiles, no depender solo del color, modo oscuro y reducción de movimiento.
- **Diseño adaptable** y uso en móvil (los clientes usan sobre todo el móvil).
- **Lenguaje:** comprensible, no culpabilizante (Módulo 12).

### Rendimiento y escalabilidad
- Cargar lo imprescindible, dividir el código por zonas, consultas con índices y paginación; evitar calcular de más en el cliente; medir antes de optimizar.

### Estrategia de pruebas
- **Unitarias** para los cálculos (con **casos de referencia independientes**, calculados a mano o con otra fuente), **de integración** para la base de datos y las políticas de acceso, **funcionales o de extremo a extremo** para los flujos críticos.
- **Casos límite**: valores nulos, ceros, vacíos, tipos de dato extraños, edad no adulta, suelo de energía, unidades no convertibles.
- **Pruebas de propiedades**: p. ej. «el total de un plan es la suma de sus ítems» y «escalar una receta a x veces multiplica cada ingrediente por x».
- **Datos de prueba clínicos** revisados por un profesional.
- **CI**: ninguna fusión con pruebas en rojo.

### Exportación y copias de seguridad
- **Exportación completa** de los datos de una persona en un formato abierto (para portabilidad y conservación). **Copias de seguridad** y **restauración probada**; plan de continuidad.
- **Plan de borrado** coherente con los plazos de conservación (Módulo 14).

## Errores frecuentes
1. Guardar cantidades y macros como texto.
2. Sumar valores redondeados.
3. Confiar solo en la validación de la interfaz.
4. No probar las políticas de acceso con cada rol.
5. Tratar «sin dato» como «0».
6. Modificar una regla clínica sin prueba y sin registro de cambios.

## Limitaciones y controversias
- Instantánea frente a referencia en los planes; cuánta precisión mostrar; coste y beneficio de pruebas de extremo a extremo.

## Estado de NutriFit [C]
Hallazgos de esta sesión (sin cambios hechos):
1. **Los ítems de un plan no guardan el identificador del alimento**: `diet_meal_items` tiene `food_name` (texto), `quantity` (**texto**), `unit` y los macros y minerales como números (una **instantánea**), más `recipe_id`. Consecuencias: una corrección del catálogo no llega a los planes ya hechos, no se puede saber con certeza qué planes usan un alimento (solo por nombre) y las cantidades como texto exigen conversión y admiten valores no numéricos.
2. **Las recetas guardan sus ingredientes como JSON con todos los valores como texto** (`kcal: "195"`, `quantity: "50"`): sin validación de tipo ni rango en la base de datos.
3. **Redondeo por ingrediente** (`computeMacros` redondea energía a entero y macros a un decimal en cada ingrediente): al sumar, hay diferencias pequeñas pero no documentadas.
4. **Conversión de medidas caseras con un único valor por unidad** y `ml = g` (Módulo 5).
5. **Calculadora sin suelo de energía, sin control de edad ni coherencia de macros** (Módulo 4) y **detector de alérgenos por nombre** (Módulo 11).
6. **Lo que está bien:**
   - **Seguridad de datos:** todas las tablas públicas tienen activadas las políticas de acceso a nivel de fila, y solo `nutricionista_alert_state` carece de políticas, de modo que solo la función de servidor accede a ella (comportamiento esperado).
   - **Pruebas:** más de **970 pruebas unitarias** en 88 ficheros, con integración continua obligatoria; las fórmulas de la calculadora y el reajuste tienen tests.
   - **Registro y portabilidad:** registro de accesos, exportación de datos del cliente con una prueba que obliga a incluir toda tabla con datos de cliente, y migraciones versionadas probadas antes de aplicarse.
   - **Accesibilidad básica:** botones e inputs con nombre accesible y modo oscuro.

## Casos prácticos
Los del examen (secciones B y C).

## Bibliografía
**[M]**: Fowler, *Patterns of Enterprise Application Architecture*; Kleppmann, *Designing Data-Intensive Applications*; Goldberg, «What every computer scientist should know about floating-point arithmetic»; OWASP, ASVS y Top 10; W3C, WCAG 2.2; RGPD y LOPDGDD; documentación de PostgreSQL sobre seguridad a nivel de fila; Beck, *Test-Driven Development*.

## Examen

### A. Teórico (6 preguntas)
1. Ventajas e inconvenientes de guardar una instantánea de la composición en cada ítem del plan.
2. ¿Por qué el redondeo se hace al mostrar y no en cada paso?
3. ¿Por qué no basta la validación en la interfaz?
4. ¿Qué es una política de acceso a nivel de fila y cómo se prueba?
5. ¿Qué es un caso de referencia independiente?
6. ¿Por qué un mensaje de aviso no debe incluir datos clínicos en claro?

### B. Aplicado (3 problemas)
1. Tres ingredientes con 12,4 g, 12,4 g y 12,4 g de grasa, cada uno redondeado a entero: compara la suma de redondeos con el redondeo de la suma.
2. Diseña dos propiedades que un test debería comprobar sobre el cálculo de un plan.
3. Propón un esquema (columnas y tipos) para un ítem de plan que mantenga identificador del alimento, instantánea y estado crudo/cocinado.

### C. Razonamiento (3 casos)
1. Un cambio en un valor de un alimento del catálogo debe llegar a los planes futuros pero no alterar los ya entregados. ¿Cómo lo diseñas?
2. Se detecta que una cantidad en un plan es «unos 200» (texto). ¿Qué problemas hay y cómo lo resuelves sin perder datos?
3. Un compañero propone eliminar las pruebas lentas para acelerar la integración continua. ¿Qué respondes?

## Respuestas de la IA (sin corregir)

**A1.** Ventajas: un plan entregado no cambia si cambia el catálogo; lectura rápida. Inconvenientes: pérdida de trazabilidad y de propagación de correcciones, duplicación de datos y dificultad para saber qué planes usa un alimento. Se mitiga guardando también el identificador y la versión de la fuente.

**A2.** Porque redondear en cada paso acumula errores (la suma de redondeos no es el redondeo de la suma) y puede desviar los totales; se calcula con toda la precisión y se redondea solo la presentación, con una política documentada.

**A3.** Porque la interfaz se puede saltar (llamadas directas, otras apps, errores); las restricciones de rango y tipo deben imponerse también en la base de datos para proteger la integridad.

**A4.** Es una regla de la base de datos que limita qué filas puede leer o escribir cada usuario según su identidad y rol. Se prueba con cuentas de cada rol (profesional propio, otro profesional, cliente propio, otro cliente, anónimo) comprobando lo que pueden y no pueden ver o modificar, y comprobando también los intentos de escritura.

**A5.** Un resultado esperado obtenido por un método distinto al del código bajo prueba (cálculo a mano, hoja de cálculo o fuente oficial), de modo que un error en el código no se «copie» al valor esperado.

**A6.** Porque las notificaciones pasan por servicios y dispositivos de terceros, pueden verse en pantallas bloqueadas y no están pensadas para datos sensibles; se envían avisos genéricos y el detalle se consulta dentro de la app autenticada.

**B1.** Redondeando cada uno: 12 + 12 + 12 = 36 g. La suma exacta es 37,2 g, que redondea a 37 g: diferencia de 1 g (≈2,7 %) por redondear antes de sumar.

**B2.** (1) El total de energía de un plan es igual a la suma de la energía de todos sus ítems (dentro de la tolerancia de redondeo). (2) Escalar una receta por un factor k multiplica la cantidad y los macros de cada ingrediente por k, y el total por k, para cualquier k > 0.

**B3.** Columnas: `id` (uuid), `meal_id` (uuid), `food_id` (uuid, nulo si el alimento ya no existe), `food_name` (texto), `quantity_g` (numérico ≥ 0), `unit_label` (texto para mostrar), `state` (enumerado: crudo, cocinado, envasado, no aplica), `source_version` (texto o fecha de la composición usada), macros y minerales como numéricos nulables, `recipe_id` (uuid) y `sort_order` (entero).

**C1.** Guardo el identificador del alimento y una instantánea con la versión de la fuente en cada ítem; el catálogo versiona sus cambios; los planes nuevos toman la versión actual y los entregados conservan la suya, con una herramienta que muestre qué planes usan una versión anterior y permita decidir si actualizarlos.

**C2.** Problemas: no se puede calcular, se puede interpretar de forma distinta y rompe totales. Resolución: migrar a un campo numérico con una columna de «nota» para el texto original, con un informe de las filas que no se pudieron convertir para que el profesional las revise, y validación para que no se repita.

**C3.** Que acelerar la integración continua eliminando pruebas pone en riesgo la seguridad de los cálculos; mejor paralelizar, optimizar las más lentas o separar un conjunto rápido en cada cambio y uno completo antes de fusionar o por la noche, sin eliminar cobertura de lo crítico.

## Criterios de corrección
- **Teórico:** 1 punto por respuesta correcta y completa; 0,5 incompleta; 0 con error conceptual grave.
- **Aplicado:** cálculo correcto; propuestas verificables y con justificación.
- **Razonamiento:** protege la integridad y los datos, y explica el coste y el riesgo.
- **Nota:** teórico 40 %, aplicado 30 %, razonamiento 30 %. **La corrige el usuario.**

## Aplicaciones a NutriFit
- Evaluar añadir **`food_id` y versión de la fuente** a los ítems de plan y migrar las cantidades de texto a número, con informe de excepciones.
- **Validar en la base de datos** rangos de energía, macros y cantidades; tipar el JSON de las recetas o migrar a una tabla de ingredientes.
- **Política de redondeo** documentada y pruebas de propiedades (suma de ítems, escalado).
- **Casos de referencia independientes** para la calculadora (con valores de una hoja de cálculo o de una fuente oficial) y para el detector de alérgenos.
- **Revisión periódica** de las políticas de acceso con cuentas de cada rol y de la restauración de copias.
