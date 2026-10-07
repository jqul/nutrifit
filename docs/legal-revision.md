# Textos legales: qué falta y qué debe revisar un profesional

Los seis textos están en `src/legal/*.md` (se ven en la web, aunque como **borrador**, en `/?legal=privacidad`,
`/?legal=terminos`, `/?legal=encargado`, `/?legal=clientes`, `/?legal=cookies` y `/?legal=aviso`).

**Son un borrador, no asesoramiento jurídico.** Se han escrito a partir de lo que hace la aplicación hoy, pero tratan
**datos de salud** (categoría especial del RGPD) y deben revisarse por un **abogado o una gestoría con experiencia en
protección de datos** antes de publicarlos y de cobrar a nadie.

## Cómo se publican

1. Completa en `src/legal/entity.ts` los datos del titular y las decisiones pendientes (todo lo que sale entre
   `[CORCHETES EN MAYÚSCULAS]`). Mientras quede alguno, la página muestra «Borrador pendiente de revisión legal».
2. Que un profesional revise los seis textos y los corrija.
3. Pon `LEGAL_REVIEWED = true` en `src/legal/entity.ts`. Eso activa:
   - los enlaces a los textos en el pie de la web y en la pestaña «Más» del cliente;
   - la casilla obligatoria de aceptación al registrarse (condiciones, contrato de encargado y privacidad),
     cuya aceptación (versión y fecha) queda guardada en los datos del usuario en Supabase Auth.
4. Cada vez que cambies un texto, actualiza `LEGAL_VERSION` en `entity.ts`.

## Datos que tienes que dar tú

| Dato | Dónde se usa |
|---|---|
| Nombre y apellidos o razón social, NIF/CIF, domicilio, correo de contacto, dirección de la web | Aviso legal, privacidad, condiciones, contrato de encargado |
| Datos registrales (solo si eres sociedad) | Aviso legal |
| Proveedor de pagos (p. ej. Stripe) | Privacidad, contrato de encargado |
| Condiciones de pago (planes, precios, prueba, renovación) | Condiciones de uso |
| Política de copias de seguridad | Condiciones y contrato de encargado |
| Límite de responsabilidad | Condiciones de uso |
| Juzgados competentes | Condiciones de uso |

## Puntos que debe mirar el profesional (supuestos míos)

1. **Reparto de papeles.** He considerado que el nutricionista es **responsable** de los datos de sus clientes y NutriFit
   es **encargado**, y que NutriFit es **responsable** de los datos de la cuenta del propio profesional. En el **modo
   personal** (una persona usándolo para sí misma), NutriFit sería responsable de esos datos: comprobar si hace falta
   un texto específico.
2. **Base legal de los datos de salud de los clientes** (art. 9 RGPD). El texto dice «lo normal es el consentimiento
   explícito o la asistencia solicitada»; lo concreto depende de cada profesional. ¿Conviene ofrecer una plantilla de
   consentimiento informado? (La app ya permite al profesional subir su propio documento de consentimiento.)
3. **Transferencias internacionales.** Supabase (datos en la UE, Irlanda) y Vercel son empresas de EE. UU.: confirmar
   que se ha aceptado el contrato de tratamiento de datos de cada una y que cubre las cláusulas contractuales tipo o el
   Marco de Privacidad UE-EE. UU.
4. **Acceso de NutriFit a los datos.** Técnicamente, la cuenta de administración puede leer datos de todos los
   nutricionistas y clientes (la base de datos lo permite para soporte). El texto lo declara como «acceso limitado al
   soporte, con confidencialidad». Decidir qué se compromete exactamente (y si hace falta un registro de accesos).
5. **Plazos de conservación.** Los de facturación y obligaciones fiscales y los de la historia clínica del profesional
   (el texto dice que NutriFit no es un archivo oficial y que debe exportar). Confirmar la redacción y el plazo de
   supresión tras la baja (30 días por defecto).
6. **Notificación de brechas en 48 horas.** Es un compromiso contractual mío: ¿es asumible?
7. **Obligaciones propias de NutriFit:** registro de actividades de tratamiento como encargado (art. 30.2 RGPD),
   si hace falta delegado de protección de datos o evaluación de impacto por tratar datos de salud, y el procedimiento
   de gestión de brechas (hoy no está documentado).
8. **Consumidor o profesional.** Las condiciones asumen un usuario **profesional** (B2B). Si alguien se registra en
   modo personal para uso propio, podría considerarse consumidor: cláusulas de responsabilidad y jurisdicción.
9. **Aprobación de cuentas.** Las condiciones dicen que pueden estar sujetas a aprobación previa y que se puede
   rechazar o retirar una cuenta: confirmar que es válido tal cual.
10. **Cookies.** El texto afirma que no hace falta banner porque solo se usa almacenamiento estrictamente necesario
    (art. 22.2 LSSI) y que las tipografías están en la propia web. Hay pruebas automáticas que lo vigilan (si el código
    pasa a usar analítica, otra tipografía externa o guarda algo nuevo en el dispositivo, fallan), pero la valoración
    jurídica es del profesional.
11. **Menores.** El servicio es para profesionales mayores de edad; el texto traslada al profesional la autorización
    para tratar datos de menores.
12. **Medidas de seguridad (Anexo II del contrato).** Se limitan a lo que la aplicación hace de verdad. Si se añade algo
    (copias de seguridad programadas, registro de accesos, doble factor), actualizar el anexo.

## Lo que ya vigilan las pruebas automáticas

Para que los textos no se desfasen del código (`src/legal/legal.test.ts`): que el contrato de encargado cubra los
elementos del art. 28; que cite los subencargados reales; que no haya analítica, publicidad ni Google Fonts en el código;
que la única petición a un tercero sea la de Open Food Facts (que los textos declaran); que las claves de
almacenamiento local de la política de cookies existan y que ningún fichero nuevo guarde datos sin revisar ese texto;
que todos los datos por rellenar estén definidos y que, con `LEGAL_REVIEWED = true`, no quede ninguno pendiente.
