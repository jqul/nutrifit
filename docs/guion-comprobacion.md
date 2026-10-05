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

## Qué contarme

Para cada cosa rara, dime **dónde**, **qué hiciste**, **qué esperabas** y **qué pasó**.
Una captura ayuda. Si algo falla al guardar o restaurar, copia el mensaje que sale.

| Resultado | Qué hago yo |
|---|---|
| Todo bien | Cerramos la Fase 2 y la retención como verificadas |
| Algo raro de datos (cifras que no cuadran) | Lo comparo con tu base de datos y lo corrijo |
| Error al guardar o restaurar | Miro los registros de la base y lo arreglo |
| No llega el aviso de las 9:00 | Reviso el cron y los registros de la función |
