# Guion de comprobación con sesión real

Todo lo de esta lista está probado con tests, con simulaciones en la base de datos
y en el modo demo. Lo único que no se ha podido probar es **entrar con tu cuenta
real**. Este guion es esa pasada. Dura unos 20-25 minutos.

## 0. Antes de empezar

- [ ] Estás en la web de producción (no `?demo=1`), con tu cuenta de nutricionista.
- [ ] Vercel ya ha desplegado lo último (el Inicio es la primera pestaña del menú).
- [ ] **Usa un cliente de prueba** para los pasos marcados con ⚠️. Guardar un plan
      manda una notificación al cliente («Tu plan de dieta se ha actualizado»), y
      restaurar una versión **cambia el plan real que ve** esa persona.
- [ ] El cliente de prueba debería tener un plan con kcal y alguna comida, y unos
      cuantos check-ins y pesajes. Si no, créalo con datos inventados.
- [ ] Activa las notificaciones con la campana de la cabecera (necesario en el punto 6).

## 1. Inicio (Centro de control)

- [ ] Al entrar, la primera pestaña es **Inicio** y saluda por la hora («Buenos días, …»).
- [ ] Arriba ves el número de clientes y tres contadores: **Actuar hoy / Revisar esta semana / Todo correcto**. Suman el total.
- [ ] «Para hoy» lista las citas de hoy (o «No tienes citas hoy»).
- [ ] «Requieren atención» muestra clientes con su motivo y un botón a la derecha (Escribir, Ver analítica, Ver seguimiento…).
- [ ] Pulsa uno: se abre la ficha **directamente en esa pestaña**.
- [ ] Pulsa un contador: te lleva a Clientes con el filtro **Atención** activo.

**Compara con la realidad:** ¿los clientes de «Actuar hoy» son realmente los que llevan días sin check-in?

## 2. Revisión semanal

- [ ] En Inicio aparece «Revisión semanal» con clientes pendientes (si tienen actividad en 2 semanas).
- [ ] Pulsa «Revisar» en uno: abre Seguimiento y arriba está la tarjeta **«Revisión de la semana»**.
- [ ] Los seis valores (check-ins, peso, adherencia, hambre, energía, digestión) cuadran con lo que ves en esa misma pestaña.
- [ ] La **sugerencia** tiene sentido para ese cliente. (Si no, apunta qué esperabas: se puede ajustar.)
- [ ] ⚠️ Pulsa **Editar**, escribe una valoración y guarda: sale «Aceptada con cambios». Vuelve a Inicio: ese cliente ya no está pendiente.
- [ ] «Volver a revisar» la reabre.

## 3. Plan: cambios, historial y versiones ⚠️

Con el cliente de prueba, pestaña **Plan de dieta**:

- [ ] Cambia las kcal (p. ej. de 1800 a 1700) y la proteína. Antes de guardar aparece
      **«Quedará en el historial: Kcal: 1800 → 1700 · …»** con un campo de motivo.
- [ ] Escribe un motivo y **Guardar plan**. Sale «Plan de dieta guardado ✓».
- [ ] Abre **Historial de cambios**: está el cambio con fecha, el diff y tu motivo.
- [ ] Abre **Versiones del plan**: hay una versión nueva marcada «Actual» y la anterior debajo.
- [ ] Pulsa **Ver** en la anterior: enseña consejo, comidas con alimentos y suplementos.
- [ ] Guarda sin tocar nada: **no** debe aparecer una versión nueva.
- [ ] Pulsa **Restaurar** en la versión anterior: el diálogo dice qué cambiaría (kcal, comidas…). Confirma.
- [ ] El editor se recarga con el plan antiguo (kcal y comidas). Hay una versión nueva «Restaurada desde la versión N» y el historial registra «Restaurado a la versión N».
- [ ] El cliente de prueba ve el plan restaurado en su app (no recibe aviso: es lo esperado).

## 4. Informe de progreso

En **Seguimiento → Generar informe**:

- [ ] Se abre el diálogo con periodo y secciones. «Cambios en el plan» y «Mi valoración» vienen **desmarcados**.
- [ ] Genera con 30 días: se abre la ventana de impresión con el PDF. Comprueba el cambio de peso y la adherencia.
- [ ] Repite marcando «Cambios en el plan»: aparecen los cambios de la prueba anterior con su motivo.
- [ ] Si el navegador bloquea la ventana, sale un aviso pidiendo permitir ventanas emergentes.

## 5. Negocio

- [ ] Ingresos estimados = suma de los precios asignados (revisa que cuadra).
- [ ] **Activos, Nuevos este mes, Posibles bajas, Retención** tienen sentido para tu cartera.
- [ ] «Riesgo de abandono» ordena a los clientes de más a menos riesgo; pulsa uno y abre su ficha.
- [ ] Cohortes: «Por objetivo» y «Por mes de alta» cambian la tabla; las cifras son razonables.

## 6. Avisos y notificaciones

- [ ] **Ajustes → Avisos**: siete interruptores, todos activados por defecto. Apaga uno, recarga la página y sigue apagado.
- [ ] La campana de la cabecera muestra las notificaciones **activadas** en este dispositivo.
- [ ] **Mañana por la mañana** (el aviso sale sobre las 8:30-9:30 en España): llega **un** resumen con los avisos nuevos
      y las citas del día siguiente, o ninguno si no hay nada nuevo. Si hay una alerta que ya estaba activa, debería
      avisarte **una sola vez**, no cada día.

## 7. Sesión de cliente (rápido)

- [ ] Entra como cliente (el cliente de prueba) desde su enlace: el panel carga y se ve su plan.
- [ ] Pestañas Hoy, Dieta, Progreso y Más funcionan. En Progreso: el titular de peso y «Descargar informe» (sin cambios del plan ni valoraciones).

## 8. En el móvil

Repite en el móvil, sin esfuerzo, lo siguiente:

- [ ] Inicio y Negocio se leen sin desplazarte de lado.
- [ ] El diálogo de «Generar informe» y el de «Restaurar» caben en pantalla.
- [ ] Ajustes: la fila de pestañas (Cuenta, Avisos, Experiencia, Marca, Legal) se desplaza en horizontal. Es normal.

## 9. Exportar y eliminar un cliente (privacidad) ⚠️

Esta es la prueba más importante de privacidad y la única que no se puede hacer sin una sesión real.
**Hazla solo con un cliente de prueba**: eliminar es irreversible.

Preparación: crea un cliente de prueba, regístralo como cliente (con un email tuyo de pruebas) y
sube con él **una foto de progreso, una foto de una comida y, desde la ficha, el PDF de una analítica**.

**Exportar** (Perfil → Exportar datos):
- [ ] Se descarga un `.json`. Ábrelo: tiene `datos` con todas las secciones (peso, check-ins, analíticas, notas clínicas, ciclo, anamnesis, encuestas, facturas, citas, revisiones, cambios y versiones del plan…).
- [ ] `planesDeDieta` trae el plan con sus comidas, alimentos y suplementos.
- [ ] `archivos` lista la foto de progreso, la de la comida y el PDF, cada uno con un `enlace` que **abre** el fichero (caducan a los 7 días).
- [ ] Si algo falla, sale un aviso que dice **qué parte** falló (no se descarga un archivo a medias).

**Eliminar** (Perfil → Eliminar cliente y sus datos):
- [ ] El diálogo avisa de que se borran también fotos, PDFs y la cuenta de acceso.
- [ ] Tras confirmar sale «Cliente eliminado, con sus ficheros y su cuenta de acceso» y desaparece de la lista.
- [ ] En el panel de Supabase → **Storage** → buckets `photos` y `lab-reports`: ya no existe la carpeta con el identificador de ese cliente.
- [ ] En Supabase → **Authentication → Users**: ya no está el email de prueba.
- [ ] Intenta entrar con el enlace antiguo del cliente: sale «Enlace no válido o expirado».

Si el borrado falla a mitad, el mensaje lo dice y **no se borra la ficha** hasta que los ficheros se
hayan podido borrar: puedes reintentarlo.

## 10. Reajuste del plan

Ficha de un cliente con plan y varias semanas de pesajes → **Seguimiento**, tarjeta **Reajuste del plan**
(justo debajo de la revisión semanal).

- [ ] Si el plan se cambió hace menos de 14 días, dice que esperes (no propone nada).
- [ ] Con menos de 3 pesajes en 10 días desde el último cambio, dice que faltan pesajes.
- [ ] Si el cliente sigue el plan menos del 70 % de los días, avisa de eso en vez de proponer recortes.
- [ ] Si el ritmo de peso encaja con su objetivo, dice que no hace falta reajustar.
- [ ] Cuando se desvía: propone subir o bajar kcal (entre 50 y 250, de 25 en 25). **La proteína y la grasa no cambian**; los carbohidratos acompañan.
- [ ] Puedes corregir la cifra de kcal antes de aplicar; los carbohidratos se recalculan.
- [ ] «Aplicar al plan» cambia kcal y carbohidratos del plan, **no toca las comidas**, y queda en
  *Historial de cambios* (con el motivo «Reajuste sugerido…») y como nueva versión restaurable.
- [ ] «Ahora no» oculta la propuesta; reaparece si cambian los datos.
- [ ] Nunca propone bajar de 1.200 kcal ni dejar menos de 50 g de carbohidratos.

## 11. Alimentos propios

**Planificación → Plantillas → Mis alimentos**

- [ ] «Nuevo alimento»: si dejas campos obligatorios vacíos, o repites el nombre de uno del catálogo («Pechuga de pollo»), no deja guardar y dice por qué.
- [ ] Un valor imposible (5.000 kcal, o proteína + carbos + grasa por encima de 100 g) tampoco deja guardar.
- [ ] Si las kcal no cuadran con los macros, **avisa pero deja guardar**.
- [ ] Se acepta la coma decimal (8,5).
- [ ] Editar un alimento cambia sus valores. Si ya está en algún plan, **el nombre queda bloqueado** y lo explica.
- [ ] Eliminar: te dice en cuántos platos de tus planes aparece. Esos platos siguen en el plan con sus valores.
- [ ] En el **plan de un cliente**, escribe un alimento que no exista en una comida: abajo del desplegable aparece
  «Crear … como alimento propio». Se guarda, se rellena el plato con sus valores y queda en Mis alimentos.
- [ ] En la app del **cliente**, un plan con un alimento propio permite buscar sustitutos para él y lo agrupa en la lista de la compra.
- [ ] Otro nutricionista **no** ve tus alimentos propios.

## 12. Dar de baja a un cliente

Usa **un cliente de prueba** (no uno real).

- [ ] Ficha del cliente → **Perfil** → tarjeta **Baja del cliente** → «Dar de baja». Pide un motivo (opcional) y una nota.
- [ ] Tras darlo de baja sale un aviso arriba de la ficha («De baja desde…») con el botón **Reactivar**.
- [ ] El cliente **desaparece** de Clientes, del Centro de control (Inicio), de la agenda y de la difusión, y sus cuotas dejan de contar en **Ingresos estimados**.
- [ ] En **Clientes → De baja (N)** aparece con su fecha y motivo; al abrirlo ves toda su ficha y su historial intactos.
- [ ] **Negocio → Bajas (últimos 90 días)**: cuenta la baja, el % sobre los clientes del periodo, las cuotas que dejas de ingresar, cuánto estuvo y el motivo.
- [ ] **Reactivar** lo devuelve a la lista como si nada.
- [ ] Un cliente de baja **no recibe** recordatorios (check-in, encuestas) ni genera avisos para ti (sin check-in, alertas, facturación pendiente).
- [ ] El cliente de baja **sigue pudiendo entrar** en su app con su enlace (ve su plan e historial). Si quieres cortarle el acceso, regenera su enlace desde el Perfil.

## 13. Sustituciones por grupos de intercambio

**Plan de un cliente → un plato con un alimento del catálogo (p. ej. pollo) → el icono de sustituir (⟲).**

- [ ] Arriba aparece «Sugerir: Mismo grupo (Carnes, pescados y huevos) · Todos». Por defecto, **mismo grupo**.
- [ ] Dice cuántas raciones tiene el plato («Ahora: 2,3 raciones…», «Una ración = 20 g de proteína»).
- [ ] En «Mismo grupo» solo salen alimentos parecidos (otra carne, pescado, huevo…), con los gramos que dan las **mismas raciones**; el más parecido en macros y en tamaño de porción va primero. No salen yogures ni legumbres para el pollo.
- [ ] «Todos» vuelve al modo de antes: cualquier alimento, igualando el macro que elijas (proteína, kcal, carbos, grasas).
- [ ] Elegir uno cambia el plato con su cantidad y sus macros.
- [ ] Un cliente con **alergia o intolerancia** nunca recibe sugerencias que choquen con ella (queda un aviso «N alimentos ocultos»). Prueba con lactosa: no salen yogur, skyr, kéfir, queso ni proteína de suero, **pero sí** la leche de avena o de almendra.
- [ ] En el buscador libre, un alimento que choca con la alergia sale marcado con ⚠.
- [ ] Un plato con un alimento que **no está en el catálogo** (texto libre) no tiene grupo: solo sale el modo «Todos».
- [ ] **App del cliente → Dieta → ⟲ en un alimento:** mismas pestañas («Mismo grupo» / «Todos»), con las cantidades equivalentes y sin nada que choque con sus alergias.
- [ ] Un alimento propio nuevo se coloca en su grupo por su categoría (un «Proteína» va con las carnes y pescados; un «Lácteo» con los lácteos).

## Qué contarme

Para cada cosa rara, dime **dónde**, **qué hiciste**, **qué esperabas** y **qué pasó**.
Una captura ayuda. Si algo falla al guardar o restaurar, copia el mensaje que sale.

| Resultado | Qué hago yo |
|---|---|
| Todo bien | Cerramos la Fase 2 y la retención como verificadas |
| Algo raro de datos (cifras que no cuadran) | Lo comparo con tu base de datos y lo corrijo |
| Error al guardar o restaurar | Miro los registros de la base y lo arreglo |
| No llega el aviso de las 9:00 | Reviso el cron y los registros de la función |
