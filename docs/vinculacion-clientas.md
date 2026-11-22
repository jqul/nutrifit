# Vinculación segura de clientas (propuesta, sin aplicar)

Rama `audit/auth-user-id` (PR en borrador). **Nada está aplicado en ninguna base ni desplegado.** Origen: auditoría de `clientes.auth_user_id` y
`claim_client_by_token` (reproducida en `src/lib/auditoriaAuthUserId.test.ts`) y decisiones del responsable del producto (2026-11-21 y 2026-11-22).

## Qué se corrige

| # | Hallazgo de la auditoría | Cómo queda |
|---|---|---|
| 1 | Token + cualquier sesión = titular de la ficha | Reclamar exige una **invitación** (24 h, un uso) **y** verificación de identidad |
| 2 | No se verifica que la cuenta sea la persona de la ficha | Ficha con email: email de la cuenta **igual** y **confirmado**. Sin email: **aprobación expresa** del profesional |
| 3 | Un profesional con un token ajeno reclama la ficha de otro | Las cuentas de profesional y de modo personal **no pueden** ser titulares de una ficha de cliente (decisión confirmada) |
| 4 | La reclamación no informa y la pantalla da «todo listo» | Resultado **explícito**; `ClientRegister` ya no vincula; `ClientInvitation` solo muestra éxito con `linked` / `pending_approval` |
| 5 | El profesional reasigna `auth_user_id` con un UPDATE | Trigger con lista de permitidos (como en 0074), **ya desde 0077** |
| 6 | Consentimiento firmable por un titular suplantado | No se llega a titular sin pasar por 1–3; y si hubo suplantación, **«Desvincular» puede cuestionar el consentimiento firmado por esa cuenta** (sin borrar nada) |
| 7 | «Regenerar enlace» no retira al titular | «Generar enlace» (solo fichas libres, revoca el anterior) y **«Desvincular cuenta»** (atómica) |
| 8 | Sin trazabilidad | `client_link_events` de solo inserción (actor, profesional, ficha, uid anterior y nuevo, fecha, método, motivo; sin tokens ni emails) |
| 9 | RPC anónima que devuelve el uid del titular | `get_client_link_state` (reclamada / es mía); la antigua se retira en 0079 |
| — | `delete-client` borraba la cuenta de `auth_user_id` sin comprobar nada | Solo si no es de un profesional, no es titular de otra ficha y el vínculo consta en el registro |

## Flujos

1. **Profesional**: ficha → *Generar enlace de acceso (24 h)* → copia `https://…/?i=<token>`. El token se muestra una vez; en la base solo está su SHA-256.
2. **Clienta**: abre el enlace → crea cuenta (o entra) → **Auth le envía un email de confirmación** → vuelve por el enlace del email → la app llama a `claim_client_with_invitation`.
3. **Resultado**: `linked` (ficha con email que coincide) → abre su app. `pending_approval` (ficha sin email) → el profesional recibe el aviso y aprueba o rechaza en la ficha (caduca a los 7 días).
4. **Recuperación**: *Desvincular cuenta* retira el acceso al instante, revoca invitaciones, cancela solicitudes, borra las suscripciones push del titular anterior y rota el token de la ficha. Con *«Sospecho una suplantación»* marcada, además se **cuestiona** el consentimiento que firmó esa cuenta.

## Consentimiento y suplantación (decisión 3)

- Se **conserva** `consent_accepted_at` / `consent_signed_name` tal cual. Se añade `clientes.consent_invalidated_at` y un evento `consent_invalidated` (quién, cuándo, cuenta que firmó, motivo).
- Un consentimiento solo **vale** si no hay marca o si se firmó **después** de ella: la firma nueva de la clienta legítima vuelve a dejarlo vigente y la marca anterior queda como historial. Las RPC por token (la nueva y la antigua) devuelven el consentimiento *efectivo*; el panel del profesional muestra «CUESTIONADO».
- Alcance exacto: solo el firmado **durante la titularidad de la cuenta anterior** (`accept_consent` exige ser la titular al firmar). Un consentimiento firmado antes (otra cuenta), el de otras fichas, o el de una desvinculación sin marcar suplantación **no se tocan**. En fichas vinculadas antes de este registro (`migracion_inicial`) no se conoce el inicio de la titularidad y se toma «desde siempre».
- La marca no la puede escribir la API (trigger); solo la función de desvinculación.

## Migraciones, orden y qué pasa si el despliegue se interrumpe

| Fichero | Qué hace | Toca datos reales |
|---|---|---|
| `0077_vinculacion_segura.sql` | **Aditiva.** Tablas, funciones, eventos, bandeja de avisos con arrendamiento, límite de intentos, columna del consentimiento cuestionado, **protección inmediata de `clientes`** (no `token`), línea base de eventos | Solo inserta la línea base; añade una columna nula |
| `0078_vinculacion_cierre.sql` | **Cierre.** Invalida los tokens de fichas sin reclamar, amplía el trigger al `token`, la reclamación antigua pasa a fallar con un mensaje claro | **Sí:** columna `token` de las fichas con `auth_user_id` nulo (hoy 7, incluida la ficticia de la prueba de anamnesis) |
| `0079_vinculacion_retirada_compatibilidad.sql` | Retira `get_client_auth_status_by_token` y `claim_client_by_token` | No |

Orden: **0077** → fusionar y desplegar la app → comprobar con una clienta de prueba → **0078** → criterio medible → **0079**.

### Si se interrumpe después de…
- **0077 aplicada, app sin desplegar (o desplegada a medias):** la app antigua funciona igual (reclamar por token y «Regenerar enlace» siguen). Quedan abiertos solo los bypasses de reclamar por token (1–4, 7); el 5 (reasignar con UPDATE) y el consentimiento ya están cerrados desde 0077. Es un estado estable y seguro de mantener. Si la app nueva se despliega **sin** 0077, la pantalla de acceso falla con un error visible (no hay RPC): por eso 0077 va **antes** de fusionar.
- **App nueva desplegada, 0078 sin aplicar:** la app nueva ya genera invitaciones y las clientas se vinculan por el camino seguro, pero el enlace antiguo (`?c=`) de fichas sin reclamar sigue sirviendo para la reclamación antigua. Es la ventana abierta de hoy, no una nueva. Aplicar 0078 cuanto antes.
- **0078 aplicada, 0079 sin aplicar:** estado final seguro para reclamar. Solo sigue existiendo la RPC anónima que revela el uid del titular (por compatibilidad). Estable el tiempo que haga falta.
- **Cada migración es una sola transacción:** si falla a medias no queda nada aplicado. Recuperación en cada caso al final de este apartado.
- **Si se aplica 0078 antes de que la app nueva esté desplegada:** las clientas no podrían crear cuenta (el enlace antiguo ya no sirve y el nuevo aún no existe en la app). Visible, no silencioso, pero evitable respetando el orden.

### Cuánto dura la ventana entre 0077 y 0078 (no hace falta esperar 14 días)
- **Lo que 0078 rompe a propósito**: reclamar con el enlace antiguo y «Regenerar enlace» antiguo. Ambos fallan con un mensaje claro. **No** rompe a las clientas ya vinculadas: la RPC `get_client_auth_status_by_token` sigue igual hasta 0079.
- **Datos reales hoy (lectura, 2026-11-21):** 10 fichas; 7 sin reclamar (6 reales y la ficticia); **1** vinculada a un usuario distinto del profesional; 2 de modo personal. Con una sola clienta vinculada y ninguna registrándose por el enlace antiguo, no hay un parque de aplicaciones antiguas que justifique esperar días para 0078.
- **Por tanto**: 0078 se aplica en la **misma sesión** que 0077, tras fusionar, desplegar y comprobar con la clienta de prueba (horas, no días). Mientras tanto, el único riesgo abierto es el que ya existe hoy (token filtrado + sesión).
- **0079** sí merece un criterio, pero **medible, no un plazo fijo**: aplicarla cuando en los registros de la API de Supabase no haya **ninguna llamada** a `get_client_auth_status_by_token` durante 48 h seguidas (la app nueva usa `get_client_link_state`) y la clienta vinculada haya abierto la versión nueva. La app tiene aviso de «versión nueva» y la sirve con red primero, así que una pestaña antigua es la única causa posible de llamadas. *Nota:* las consultas a los registros de Supabase de esta sesión devolvieron 0 filas para esas rutas en las últimas 24 h; el filtro de ruta no está validado, por lo que ese criterio hay que comprobarlo de nuevo con el filtro correcto antes de apoyarse en él.

### Recuperación (si algo falla)
- **0077**: aditiva; se revierte con `drop` de tablas y funciones nuevas, de los triggers de `clientes` (`clientes_registrar_vinculo*`, `clientes_proteger_vinculo`) y de la columna `consent_invalidated_at`, y restaurando `get_client_auth_status_by_token` a su definición anterior (columnas idénticas).
- **0078**: restaurar la definición antigua de `claim_client_by_token` y la versión 1 del trigger (sin `token`). Los tokens rotados **no se pueden restaurar**: las fichas sin reclamar necesitan un enlace nuevo (es la intención). Guardar antes `select id, token from clientes where auth_user_id is null`.
- **0079**: recrear las dos funciones antiguas (definiciones en el historial de migraciones de producción).

## GoTrue y la confirmación de email (decisión 1: NO se activa «Confirm email» global)

Leído en el código de Supabase Auth (`internal/models/user.go`, `internal/api/signup.go`, `internal/api/verify.go`, rama principal; **no** ejecutado contra un proyecto):
- `IsConfirmed()` es solo `email_confirmed_at != null`. `Confirm()` pone `email_confirmed_at`, vacía `confirmation_token` y **no toca `confirmation_sent_at`**.
- Con confirmación automática (la configuración actual), el alta llama a `Confirm()` sin enviar nada: `confirmation_sent_at` queda **nulo**. Con confirmación obligatoria, envía el correo y **no** confirma hasta que se verifica. Es lo que sostiene la regla `private.email_confirmado_por_la_persona` (exige `confirmation_sent_at` no nulo y `email_confirmed_at >= confirmation_sent_at`): hoy falla cerrado.
- **Dos casos en los que Auth pone `confirmation_sent_at` a nulo después de confirmar:** cambiar la contraseña (`UpdatePassword`) y limpiar los tokens pendientes. Una clienta que cambie su contraseña **entre confirmar y vincular** vería `email_not_confirmed` (fallo cerrado, no inseguro). Poco probable (el flujo dura minutos) pero real: hay que comprobarlo en un entorno aislado y, si molesta, ajustar solo esa función.
- La verificación por **recuperación de contraseña o enlace mágico confirma el email** de un usuario sin confirmar (y borra la contraseña que hubiera fijado). No abre un hueco (exige recibir el correo), pero significa que `email_confirmed_at` solo es fiable junto a `confirmation_sent_at`.
- **Consecuencias de activar «Confirm email» más adelante** (leídas en `Auth.tsx`; sin cambiarlo): el alta de profesionales y de modo personal llamaría a `signUp` y mostraría «Cuenta creada. Ya puedes entrar» / «Solicitud enviada», pero **no habría sesión hasta confirmar**; el inicio de sesión devolvería «Email not confirmed» y la app lo mostraría como **«Email o contraseña incorrectos»** (mensaje engañoso). Habría que añadir una pantalla «Revisa tu email» y un mensaje propio. El trigger de alta (`handle_new_nutricionista`) se ejecuta al insertar el usuario, no al confirmar. Los 6 usuarios actuales ya están confirmados y no se verían afectados. Hace falta SMTP propio: el correo integrado de Supabase está muy limitado.
- **Pendiente de verificar en un proyecto aislado** (ver «Pruebas que faltan»): que el correo de confirmación llega, que `confirmation_sent_at` se conserva al confirmar y qué ocurre con el cambio de contraseña.

## Tokens: generación, entropía, caducidad, uso único e intentos (probado en `vinculacionEndurecimiento.test.ts`)

- **Generación**: dos `gen_random_uuid()` concatenados (64 hex). Esa función usa el generador criptográficamente seguro de PostgreSQL (según su documentación; no se ha auditado el motor aquí). Estructura comprobada: dos UUID v4 → **244 bits aleatorios útiles** (no 256: 12 bits fijos de versión y variante). 3000 tokens sin repetirse y reparto uniforme de los dígitos aleatorios (prueba de cordura, **no** demuestra aleatoriedad criptográfica).
- **Almacenamiento**: solo SHA-256; el token solo existe en la respuesta de `create_client_invitation`.
- **Caducidad**: restricción de la base (`expires_at <= created_at + 24 h`) y comprobación al reclamar. **Un solo uso**: se consume en la transacción que vincula o crea la solicitud. Generar uno nuevo **revoca** el anterior (índice único parcial: una invitación activa por ficha).
- **Intentos**: 10 reclamaciones **fallidas** por cuenta y hora → `too_many_attempts` (no cuentan vincular, solicitud, ya vinculada, falta confirmar el email ni solicitud ya pendiente). Un intento con email distinto no consume la invitación y se registra como `claim_denied` (máximo uno por hora y cuenta).
- **Lo que NO se puede limitar en SQL**: las consultas **anónimas** a `get_invitation_status` (no hay IP). Con 244 bits el tanteo no es viable; el límite de peticiones de la API de Supabase es la defensa de plataforma y habría que confirmarlo.

## Bandeja de avisos (probado en la base y en `notifyClientLinkProceso.test.ts`)

- El destinatario sale de la **ficha** (`clientes.nutricionista_id`), nunca de lo que envía quien reclama. Solo avisan las vinculaciones normales y las solicitudes pendientes (no cambios directos, modo personal, desvinculaciones ni invitaciones).
- `take_link_notifications` reserva (5 min, `FOR UPDATE SKIP LOCKED`) y cuenta el intento; `finish_link_notification` marca enviado o anota el error y no deshace un envío ya correcto. Máximo 5 intentos. Solo `service_role`; la API no puede ni leer la tabla.
- La función de borde solo reparte (probada con dobles): éxito, sin dispositivos, error del servicio de push (queda sin enviar), dispositivos caducados (se eliminan), excepciones aisladas, un dispositivo suscrito dos veces recibe un solo aviso, dos ejecuciones simultáneas no repiten, y solo se consultan las suscripciones del profesional destinatario.
- **No probado**: el envío real con `web-push` y VAPID ni el cron (hay que desplegar la función y clonar un job; ver su cabecera).

## Desvinculación completa

- **Probado en PGlite**: con la **misma sesión** (mismo uid) antes y después, la titular pasa de leer y escribir en las **19 tablas de datos del cliente** (las 17 de producción con política por `is_owner_client` más `diet_plans`/`anamnesis`) y en el **almacenamiento** (política de `photos`/`lab-reports` por carpeta) a **0 filas, sin poder insertar, actualizar ni borrar**; `get_my_client_token` devuelve nulo; el token anterior no existe; la invitación consumida no sirve; los datos **no se borran** y siguen para el profesional; otra titular no se ve afectada.
- **Verificado en producción (solo lectura)**: ninguna política del esquema `public` ni `storage` usa claims del JWT ni el token: todas dependen de `auth_user_id` vía las funciones `is_owner_client` / `is_owner_of_plan` / `is_owner_of_meal` / `client_can_read_*`, que se evalúan en cada consulta.
- **Permisos residuales que NO se pueden revocar** (hay que asumirlos): (1) **URLs firmadas ya emitidas** a la titular anterior (la app las pide de 1 hora y las de analíticas de 5 minutos): siguen siendo válidas hasta que caducan; (2) **datos ya descargados o en caché del dispositivo** de esa persona; (3) **Realtime**: la publicación incluye `appointments`; Supabase aplica RLS por evento, por lo que no debería seguir recibiendo cambios, pero **no se ha comprobado**; (4) la **sesión** del usuario sigue siendo válida (hasta caducar el JWT), pero identifica a un usuario sin ninguna ficha: no da acceso a nada.

## Conservación del registro de vinculaciones: DECISIÓN PENDIENTE DE VALIDACIÓN JURÍDICA

**No hay ninguna obligación legal de 24 meses que se haya identificado ni validado.** El borrador de 0077 incluye `purge_client_link_events(interval)` con 24 meses por defecto solo como **valor de partida**, sin programar. Antes de usarla hay que decidir con asesoría jurídica (a) si conservar el registro y cuánto, (b) la base legal (interés legítimo en acreditar accesos a datos de salud, defensa ante reclamaciones, seguridad), (c) si el derecho de supresión de la clienta obliga a anticipar el borrado o a seudonimizar, y (d) qué ocurre con el registro de fichas eliminadas. Datos que guarda: uids (seudónimos), fechas, método, motivo breve; **no** tokens, emails ni datos clínicos (el email del solicitante solo está en la solicitud pendiente, que se borra en cascada con la ficha). Hasta entonces: **no se programa la purga**.

## Revisión individual de los ocho `it.fails`

Cada uno se ejecutó **sin `.fails` contra el estado final** (0074 + 0076 + 0077 + 0078): 6 pasan y 2 quedan **sustituidos** por una prueba equivalente sobre el mecanismo nuevo. Los ocho se conservan como documento del defecto original y llevan una nota «REVISADO» con su contrapartida.

| # | Fichero | Qué afirma | Hoy (producción) | Estado final | Contrapartida normal |
|---|---|---|---|---|---|
| 1 | antes | Un profesional no cambia su `role`/`approved` | falla (defecto) | **pasa** | despues «DESEADO (pasa a normal)…» |
| 2 | antes | Tras intentar ascender no accede a datos de otro | falla | **pasa** | despues «…tras intentar ascender…» |
| 3 | antes | Una clienta no borra la fila de su profesional | falla | **pasa** | despues «…no puede borrar la fila…» |
| 4 | antes | El profesional no cambia `auth_user_id` con UPDATE | falla | **pasa** (con 0077) | vinculación «BYPASS 5 CERRADO» |
| 5 | auditoría | Una ficha con email no se reclama con otra cuenta | falla | **pasa** | vinculación «BYPASS 1/2 CERRADO…» |
| 6 | auditoría | La reclamación informa de su resultado | falla | **sustituida** (la función antigua ahora lanza error) | vinculación «BYPASS 4 CERRADO…» |
| 7 | auditoría | El profesional no cambia `auth_user_id` con UPDATE | falla | **pasa** | vinculación «BYPASS 5 CERRADO» |
| 8 | auditoría | Vincular/desvincular deja registro inmutable | falla | **sustituida** (el registro es `client_link_events`, no `access_log`) | vinculación «vincular, desvincular y reasignar…» + solo inserción |

## Pruebas que faltan (requieren un proyecto de Supabase aislado) — NO HECHAS

No se ha creado ningún proyecto: `get_cost` indica **0 €/mes** para un proyecto nuevo (o 0,01344 €/hora para una rama) y la herramienta exige que la persona responsable confirme el coste. Con el proyecto aislado habría que:
1. **GoTrue**: activar «Confirm email» **solo allí**, registrar una cuenta, confirmar por el correo, y comprobar `confirmation_sent_at` / `email_confirmed_at`, el cambio de contraseña entre confirmar y reclamar, y la recuperación de contraseña. Sin SMTP propio solo reciben correo los miembros del equipo.
2. **Concurrencia**: `scripts/prueba-reclamaciones-simultaneas.mjs` (dos cuentas válidas, misma invitación, ficha sin email).
3. **Deno**: desplegar `notify-client-link` y `delete-client` allí y probarlas con datos ficticios (el equipo no tiene Deno local).
4. **Navegador**: arrancar la app local contra ese proyecto y recorrer `?i=`, confirmación, vinculación, aprobación, desvinculación, solicitud pendiente y errores.

## Pendiente fuera de las migraciones
- Textos de ayuda (`src/help/*.md`) que hablan de «Copiar enlace / Regenerar enlace».
- Programar el cron de `notify-client-link` y desplegarla.
- Decisión sobre «Confirm email» global y SMTP propio; mensaje de error de inicio de sesión mejor que «Email o contraseña incorrectos».
