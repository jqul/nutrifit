# Clientes

## Crear un cliente

- Ve a **Clientes → Nuevo cliente**.
- Rellena el nombre (lo único obligatorio), y, si lo sabes: teléfono, email, objetivo, altura, género, nacimiento, **peso actual**, **peso objetivo** y alergias.
- El **peso actual** queda como su primer pesaje: la ficha y la gráfica lo muestran desde el primer momento, sin esperar a que el cliente lo apunte. Admite coma (72,5).
- Pulsa **Crear cliente**.

Después, en su ficha, copia su enlace (**Perfil → Copiar enlace**) y envíaselo.

## Traer clientes que ya tienes (con todo lo que ya tenías de ellos)

Si ya llevabas a clientes en hojas de cálculo, **Clientes → Traer clientes** te guía en tres pasos, para que cada uno llegue con su ficha **y** con su historia:

- **1. Clientes.** Sube un archivo **.csv o .xlsx**. Reconoce las columnas por su nombre, en cualquier orden: **Nombre** (obligatoria), Apellidos, Teléfono, Email, Objetivo, Altura, Género, Nacimiento, Alergias, **Peso**, **Peso objetivo** y **Notas** (tus notas privadas). Te enseña quién es nuevo y **quién ya existe** (esos se omiten, no se duplican). Hay una plantilla de ejemplo para descargar.
- **2. Historial (todo opcional).** Tres tipos, cada uno en su archivo y con su plantilla. En todos, la primera columna identifica al cliente (**Cliente** con nombre y apellidos, o su email, o su teléfono) y se empareja tanto con los que vas a crear como con los que ya tenías. Si un nombre coincide con varios clientes, **no adivina**: te dice qué fila revisar y que uses el email o el teléfono.
  - **Historial de peso:** Cliente, **Fecha** y **Peso (kg)**.
  - **Notas de consulta:** Cliente, **Fecha** y **Nota**. Se añaden a las **notas privadas** de su ficha (la pestaña Notas), una línea por consulta con su fecha, **sin tocar lo que ya hubiera escrito**. **El cliente nunca las ve.**
  - **Analíticas:** Cliente, **Fecha**, **Marcador** y **Valor** (o una columna por marcador: Glucosa, Colesterol total…). NutriFit lleva por ahora glucosa, colesterol total, LDL, HDL, triglicéridos, GOT, GPT, hierro, vitamina D y TSH, **en sus unidades habituales** (mg/dL, U/L, µg/dL, ng/mL, µU/mL). Si tu hoja trae otra unidad (mmol/L, por ejemplo) o un marcador que NutriFit no lleva (HbA1c…), te lo dice y esa fila no se importa: **no convierte unidades a ciegas**.
  Funciona con el Excel en español (separado por punto y coma, con decimales con coma).
- **3. Confirmar.** Ves qué se va a guardar y **qué filas no se han podido leer y por qué**. Las buenas se importan igualmente. **Nunca se duplica ni se pisa nada**: un pesaje que ya existía ese día, un resultado de analítica ya guardado o una línea de notas que ya estaba se respetan, así que puedes repetir la importación.

Al terminar tienes el **enlace de cada cliente para copiar** (uno a uno o todos juntos) para mandárselo. **Hasta que se lo envíes no puede entrar a su app.** Después, abre su ficha y hazle el plan.

**¿Tus datos están en un PDF?** No hace falta archivo: en cada apartado pulsa **Pega la tabla**, abre el PDF, selecciona la tabla, cópiala y pégala. Funciona con lo que sale de un PDF de texto (columnas separadas por espacios) y de Excel o Google Sheets. En el historial de peso, si el PDF no tiene cabeceras, vale una línea por pesaje (nombre, fecha y peso). Siempre ves la tabla entendida antes de guardar nada. Si el PDF es una **foto o un escaneo** (no se puede seleccionar el texto), no se puede copiar: habría que pasarlo a mano o a una hoja de cálculo.

**Lo que no entra por hoja de cálculo.** Las **fotos de progreso** y los **PDF originales de las analíticas** se suben desde la ficha del cliente (Seguimiento y Analíticas), el **plan de dieta** que ya tenía se trae con **Importar** dentro de su plan, y los check-ins diarios los registra el propio cliente desde su app.

Si solo quieres añadir historial a clientes que ya tienes creados, usa el mismo botón y pulsa **Ya los tengo creados: solo quiero su historial**.

Para un solo pesaje: en **Seguimiento** del cliente, bajo la gráfica de peso, **Añadir un pesaje con fecha** (o el atajo **Registrar peso** de la cabecera de su ficha).

## La lista de Clientes

- Cada fila muestra el estado (semáforo), el peso y su cambio, la adherencia, la racha y la **última actividad** (en rojo si hace 5 días o más).
- **Buscar:** escribe en el buscador, o pulsa **/** para saltar a él.
- **Filtros rápidos:** Todos, Activos, Atención, Con cita hoy y tus etiquetas.
- **Ordenar por:** necesitan atención, nombre, adherencia (los de menor primero) o última actividad (los más antiguos primero). Con muchos clientes, esto te evita abrirlos uno por uno.

## El Perfil del cliente

- **Datos y alertas médicas:** alergias e intolerancias, etiquetas para agruparlos (por ejemplo «Deportista»).
- **Enlace de acceso:** **Copiar enlace** para enviárselo. **Regenerar enlace** crea uno nuevo y anula el anterior (útil si lo ha compartido por error).
- **Cuestionario de salud:** lo que respondió el cliente al registrarse.
- **Facturación:** pon un precio mensual y pulsa **Generar factura de este mes**; después marca si está pendiente o pagada y descarga el PDF. Mientras no haya factura del mes, el cliente aparece con el aviso «Falta la factura de este mes».
- **Exportar datos:** descarga todo lo del cliente en un archivo.

## Dar de baja a un cliente

En **Perfil → Baja del cliente → Dar de baja** (puedes indicar el motivo). Desaparece de tu lista, de Inicio y de los cobros estimados, y deja de recibir recordatorios, pero **se conserva todo su historial**: lo ves en **Clientes → De baja** y puedes **Reactivarlo** cuando quieras. Sigue pudiendo entrar en su app con su enlace; si quieres cortarle el acceso, regenera el enlace.

## Eliminar a un cliente

En **Perfil → Eliminar cliente y sus datos**. **Es irreversible**: borra su ficha, sus fotos, sus analíticas y su cuenta de acceso. Si solo quieres dejar de trabajar con él, usa mejor la baja.
