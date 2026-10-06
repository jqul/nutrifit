# NutriFit — plan de ventas y marketing

Plan pensado para **una sola persona y poco dinero**: primero validar con pocos nutricionistas, después crecer
con lo que funcione. Todo lo marcado como **(a validar)** es una hipótesis mía, no un dato: hay que comprobarla
con los primeros clientes antes de darla por buena. No incluyo cifras de mercado ni precios de la competencia
porque no los he comprobado; hay una tarea para hacerlo (sección 10).

---

## 1. Resumen en una página

- **A quién:** dietistas-nutricionistas **autónomos y consultas pequeñas** (10–60 clientes) que hoy llevan el
  seguimiento con Excel/PDF y WhatsApp. Segundo público: **entrenadores personales que dan pautas de nutrición**.
- **Qué problema:** pierden horas cada semana mirando cliente por cliente, los clientes abandonan sin que se
  enteren a tiempo, y el plan en PDF no se actualiza ni se sigue.
- **Qué prometes (una frase):** *«Abre NutriFit y sabes a qué clientes tienes que escribir hoy. Tu cliente lo usa desde
  el móvil, sin descargar nada.»*
- **Cómo lo vendes:** demo de 15 minutos → prueba de 14 días con tus propios clientes → pago mensual.
- **Cómo lo difundes:** (1) 5–10 nutricionistas piloto de tu entorno, (2) vídeos cortos de casos reales,
  (3) comunidades y mensajes directos, (4) referidos. **Anuncios de pago solo cuando ya se sepa qué convierte.**
- **Meta a 90 días (objetivo, no predicción):** 10 pilotos activos, 5 de pago, y saber cuál es el canal que mejor funciona.
- **Antes de vender hay bloqueantes** (sección 3): precios y cobro, textos legales con datos de salud, dominio
  propio. Sin eso, mejor seguir en piloto gratuito.

---

## 2. Qué tienes hoy (ventajas reales del producto)

Estas son las cosas que **ya existen y funcionan** y que sirven para vender. Las que más pesan, por orden:

| Ventaja | Por qué importa a un nutricionista |
|---|---|
| **Centro de control + alertas** («a quién atender hoy»: sin check-in, peso estancado, hambre alta, adherencia baja…) | Ahorra el tiempo de revisar a cada cliente; es lo más difícil de copiar bien |
| **App del cliente sin descargar** (enlace personal, se instala desde el navegador) | Cero fricción para el cliente; el nutricionista no depende de que instale nada |
| **Revisión semanal sugerida, reajuste del plan y ajuste automático de las comidas** | Ayuda a decidir, no solo a registrar |
| **Plan con sustituciones por grupos de intercambio, alimentos propios, recetas, lista de la compra, escáner de productos** | El cliente puede seguir el plan en la vida real |
| **Marca blanca** (tu logo, tu color, tu dominio) | Parece *tu* app, no la de otra empresa |
| **Informes PDF, facturas, agenda, mensajes con plantillas, encuestas, analíticas** | Sustituye varias herramientas |
| **Retención y bajas** (cuántos clientes se van y por qué) | Mira el negocio, no solo el plan |
| **RGPD: exportar y borrar los datos de un cliente, consentimiento** | Ofrece tranquilidad con datos de salud |
| **Importar clientes y planes desde Excel/CSV** | Quita la objeción «tendría que rehacerlo todo» |
| **Modo personal** (gratis para uso propio) | Puerta de entrada y canal de boca a boca |

**Lo que hoy NO se ve en la web de presentación** (la landing solo enseña seis funciones básicas): el centro de
control, las alertas, el reajuste automático, el escáner, la marca blanca, el informe PDF, la retención, el RGPD.
Es lo que más diferencia y no se está contando. → tarea 1 de la sección 10.

---

## 3. Antes de vender: lo que falta (bloqueantes y recomendables)

### Bloqueantes (sin esto no cobraría)
1. **Precios y cobro.** Hoy no hay forma de cobrar a un nutricionista por NutriFit (el «precio mensual» que ves en la
   app es el que el nutricionista cobra a *su* cliente). Hace falta: planes, pasarela (p. ej. Stripe), facturas y baja
   del servicio.
2. **Textos legales.** Se tratan **datos de salud** (categoría especial en el RGPD). Hacen falta, revisados por un
   profesional (abogado o gestoría con experiencia en protección de datos):
   - Política de privacidad y aviso legal de NutriFit.
   - Términos de uso.
   - **Contrato de encargado del tratamiento**: el nutricionista es el responsable de los datos de sus clientes y
     NutriFit es el encargado; tiene que quedar firmado o aceptado.
   - Política de cookies si se usa analítica o anuncios.
   Hoy no hay ninguna de estas páginas en la web.
3. **Dominio propio y correo** (`nutrifit.…` en vez de `…vercel.app`) y una dirección de soporte. Un nutricionista no
   mete datos de pacientes en una web con dirección provisional.
4. **Notificaciones push activadas** y comprobadas con un aviso real: es parte de la promesa («te avisa»).

### Recomendables (antes de empezar a hacer ruido)
- Landing nueva: titular, 3 beneficios, vídeo de 60 s, capturas del centro de control y de la app del cliente, precios,
  preguntas frecuentes, botón «Ver demo» y «Probar 14 días».
- **Alta sin aprobación manual** (o con aprobación en menos de 24 h). Hoy las cuentas nuevas esperan a que las apruebes:
  es un freno si la gente llega desde un anuncio o un vídeo.
- **Onboarding guiado**: tras registrarse, una lista de 4 pasos (crear el primer cliente, su plan, enviarle el enlace,
  ver su primer check-in).
- Un **«Hecho con NutriFit»** discreto en la app del cliente (se quita en el plan de pago): cada cliente que lo usa
  enseña el producto a otros nutricionistas y a su entorno.
- Medir: cuántos se registran, cuántos crean un cliente, cuántos reciben un check-in, cuántos pagan (sección 8).

---

## 3 bis. Precios (a validar)

Propuesta de partida, **para probar, no para fijar**:

| Plan | Para quién | Precio orientativo | Qué incluye |
|---|---|---|---|
| **Gratis / Personal** | Probar, o usarlo para ti | 0 € | Hasta 3 clientes activos, o el modo personal |
| **Profesional** | Autónomo con 10–40 clientes | 19–29 €/mes | Clientes ilimitados (o hasta 40), todas las funciones, marca blanca |
| **Consulta / Clínica** | Varios profesionales | 49–79 €/mes | Más profesionales, soporte prioritario |

- **Descuento «fundador»** para los 10 primeros que paguen: –50 % de por vida a cambio de feedback y un testimonio.
- **Pago anual** con 2 meses gratis.
- **Cómo validar el precio:** pregunta a los pilotos «¿a qué precio te parecería caro? ¿y tan barato que desconfiarías?»
  y no subas ni bajes hasta tener 10 respuestas. Mira también lo que cobran los programas del sector (tarea 5).
- Cuentas ilustrativas, no previsiones: 40 profesionales de pago × 25 €/mes = 1.000 €/mes; 100 × 25 € = 2.500 €/mes.
  El coste de la infraestructura crece despacio, así que el margen es alto; revisa los planes de pago de Supabase y
  Vercel (los gratuitos tienen límites) en cuanto haya clientes de pago.

---

## 4. Posicionamiento y mensajes

### Titulares para probar (elige uno y mide)
1. *«Sabe a qué cliente escribir hoy.»*
2. *«Tus clientes siguen el plan desde el móvil, sin descargar nada.»*
3. *«Deja el Excel y el WhatsApp: seguimiento de tus clientes en un solo sitio.»*

### Tres bullets para la landing
- **Atiende a quien lo necesita:** el centro de control marca quién no hace check-in, quién se estanca y quién se va a ir.
- **Tu marca, no la nuestra:** tu logo, tu color, tu dominio; el cliente entra con un enlace, sin instalar nada.
- **Del plan al ajuste:** reajusta el plan según cómo responde el cliente, con sustituciones y lista de la compra incluidas.

### Objeciones y qué responder
| Objeción | Respuesta |
|---|---|
| «Ya uso Excel/otro programa» | Importas tus clientes y tus planes desde Excel/CSV. Pruébalo con 3 clientes, sin tocar el resto. |
| «¿Mis clientes tienen que instalar algo?» | No: reciben un enlace y funciona desde el móvil. Si quieren, lo añaden a la pantalla de inicio. |
| «Son datos de salud, ¿es seguro / RGPD?» | Exportas o borras todos los datos de un cliente en un clic, con su consentimiento. *(Tener ya los textos legales y el contrato de encargado.)* |
| «¿Y si dejo de usarlo?» | Exportas todo lo tuyo. No hay permanencia. |
| «Es caro / es nuevo» | Plan gratuito para empezar, prueba de 14 días y descuento de fundador. |
| «¿Quién está detrás?» | Una persona que lo mejora cada semana contigo: eso es una ventaja si la comunicas (canal de WhatsApp o grupo de usuarios). |

### Qué NO prometer
Resultados clínicos, «pierde X kg», nada que parezca consejo médico. NutriFit es una **herramienta del profesional**;
las sugerencias de la app son orientativas y las decide él. Mantenlo así en toda la comunicación.

---

## 5. Cómo difundirlo: canales por orden de prioridad

### Fase 0 — 5 a 10 nutricionistas de tu entorno (semanas 1–6)
- Es lo más barato y lo que más enseña. Lista de conocidos, ex-compañeros, gente de tu gimnasio o de tu entorno
  de entrenamiento.
- **Qué les ofreces:** cuenta gratis con tu ayuda para pasar sus clientes, y a cambio: feedback cada semana,
  que prueben con clientes reales y, si les gusta, un testimonio.
- **Qué mides:** si crean clientes, si reciben check-ins, qué se atasca. Lo que se atasca es tu hoja de ruta.

### Fase 1 — Contenido corto, gratis y constante (desde la semana 3)
Un par de vídeos a la semana de 30–45 s (Instagram Reels, TikTok, YouTube Shorts) y un post en LinkedIn:
- *«Así sé qué cliente atender hoy (sin abrir 30 chats)»* — pantalla del centro de control.
- *«Mi cliente no descargó nada y sigue su plan»* — el enlace y la app.
- *«Mi cliente no ha hecho check-in en 4 días: esto me avisa»* — la alerta.
- *«De 2.340 a 2.200 kcal en un clic»* — el reajuste de las comidas.
- *«Escanea un producto y mira cuánto cabe en tu día»* — el escáner.
- *«Mi cliente quiere cambiar el pollo: así lo sustituyo bien»* — grupos de intercambio.
- *«Por qué se me van los clientes (y cómo lo veo venir)»* — retención.
- *«Checklist RGPD para nutricionistas en 10 puntos»* — lead magnet (ver abajo).

**Si tu red está en el mundo del entrenamiento de fuerza,** el nicho de **nutricionistas deportivos y preparadores**
es el más cercano: hablas su idioma y sabes qué necesitan (macros, adherencia, peso semanal).

### Fase 2 — Comunidades y mensajes directos (desde la semana 4)
- **Grupos** de dietistas-nutricionistas (Facebook, Telegram, WhatsApp, LinkedIn): primero aporta (responde dudas,
  comparte la checklist RGPD), después menciona la herramienta cuando venga a cuento. Nada de spam.
- **Colegios y asociaciones profesionales** de dietistas-nutricionistas de tu comunidad: ofrece una charla/webinar
  gratuita «Seguimiento de clientes sin perder horas».
- **Mensaje directo** (LinkedIn o Instagram) a nutricionistas con consulta online. Plantilla corta:

  > Hola, [nombre]. Vi que llevas consulta online de [especialidad]. He hecho NutriFit, una app para llevar el
  > seguimiento de los clientes: te avisa de a quién tienes que escribir hoy y el cliente la usa desde el móvil sin
  > descargar nada. ¿Te enseño una demo de 10 min? Si te encaja, te dejo probarla gratis con tus clientes.

- **Seguimiento a los 3 días** con una sola línea y el enlace a la demo; después no insistas.

### Fase 3 — Referidos y alianzas (desde la semana 8)
- **Referidos:** 1 mes gratis para quien te traiga a un nutricionista que se registre y cree un cliente (y otro para él).
- **Micro-influencers** dietistas (cuentas de 5–30 mil seguidores): **afiliación recurrente** (p. ej. 20–30 % mensual
  mientras el referido pague) en vez de un pago único, para que ellos también ganen si te quedas.
- **Universidades** (último curso de Nutrición Humana y Dietética): plan de estudiante gratis o muy barato; son tus
  futuros clientes y hablan entre ellos.
- **Entrenadores y gimnasios:** tienen clientes que piden pautas de nutrición; acaban derivando a un dietista que use
  tu herramienta.

### Fase 4 — Contenido que trabaja solo (desde la semana 6, tarda meses en rendir)
- **Lead magnets** que se descargan a cambio del email: *plantilla de seguimiento de clientes*, *checklist RGPD para
  consultas de nutrición*, *guía de grupos de intercambio*. Cada uno lleva a la demo.
- **Blog (SEO):** «software para nutricionistas», «cómo hacer seguimiento de clientes online», «plantilla de plan de
  dieta», «RGPD en consultas de nutrición». Un artículo al mes, bien hecho, con capturas de la app.
- **Newsletter** mensual para los registrados: novedades y un caso.

### Publicidad de pago (solo cuando haya una landing que convierta)
- Presupuesto de prueba: unos **150–300 €** repartidos en dos o tres anuncios (Instagram/Meta a nutricionistas por
  intereses, y búsqueda en Google con «software para nutricionistas»). *(Los costes por clic los desconozco: míralos al
  empezar.)*
- **Regla:** no escales un anuncio hasta que sepas cuántos registros y cuántos pagos te da. Si el coste de captar a un
  nutricionista supera unos 3–4 meses de lo que paga, no compensa.

### Dentro del propio producto (no cuesta nada)
- **«Hecho con NutriFit»** en la app del cliente, con enlace.
- **Enlace de referido** en Ajustes.
- **Email de bienvenida y de reactivación** (los registrados que no llegan a crear un cliente).

---

## 6. Proceso de venta

1. **Entra la persona** (vídeo, mensaje, referido, anuncio) → **demo grabada o en directo de 10–15 min.**
2. **Prueba de 14 días con sus clientes reales** (ayudarle a importar los clientes y un plan).
3. **Día 3 / 7 / 12:** mensaje corto: ¿ha recibido ya algún check-in? ¿qué le falta?
4. **Día 14:** propuesta de plan, con descuento de fundador si es de los 10 primeros.
5. **Después del primer mes:** pregunta qué haría que le faltara NutriFit y pide un testimonio.

**Activación (la señal que importa):** en la primera semana ha creado **3 clientes, 1 plan y ha recibido 1 check-in.**
Quien llega ahí casi siempre se queda; quien no, necesita ayuda o no es el cliente adecuado.

---

## 7. Calendario de 90 días

| Semanas | Foco | Entregable |
|---|---|---|
| **1–2** | Preparar | Precios definidos, dominio y correo, textos legales en marcha, landing nueva, push activado, 5 vídeos grabados |
| **3–6** | Piloto | 5–10 nutricionistas probando, reunión semanal de feedback, 8–12 piezas de contenido publicadas, primeros mensajes directos |
| **7–10** | Lanzamiento suave | Cobro activado, descuento de fundador, referidos, charla/webinar, primeros 5 de pago |
| **11–13** | Medir y decidir | ¿qué canal trajo más registros y más pagos? Duplica ese y deja los demás. Prueba de anuncios con 150–300 € |

**Objetivos (metas, no predicciones):** 10 pilotos activos al final de la semana 6; 5 de pago al final de la 10; saber el canal ganador
al final de la 13.

---

## 8. Qué medir (pocas cosas)

| Métrica | Qué te dice | Dónde |
|---|---|---|
| Visitas → registros | Si la landing convence | Analítica de la web |
| Registros → **activados** (3 clientes, 1 plan, 1 check-in en 7 días) | Si el producto se entiende | Panel de super-admin / consulta a la base de datos |
| Activados → de pago | Si el precio y la oferta funcionan | Pasarela de pago |
| De dónde viene cada registro (parámetro `?ref=`) | Qué canal funciona | Landing |
| Bajas mensuales y motivo | Por qué se van | Preguntar siempre al darse de baja |
| Ingreso mensual recurrente (MRR) | Si el negocio crece | Pasarela de pago |

Pon un `?ref=` distinto en cada enlace que difundas (instagram, linkedin, grupo-x, referido-nombre) para saber de dónde
llegan.

---

## 9. Riesgos y qué evitar

- **Datos de salud sin textos legales.** El mayor riesgo. No cobrar ni publicitar a gran escala hasta tenerlos.
- **Querer llegar a todo el mundo.** Empieza con un nicho (p. ej. nutrición deportiva o consulta online) y amplía.
- **Más funciones en vez de más conversaciones.** Ya hay producto de sobra para empezar; lo que falta son
  usuarios que lo usen y te cuenten.
- **Regalar demasiado.** Un plan gratuito generoso sin límite de clientes no deja razón para pagar.
- **Prometer lo que no hay.** Las sugerencias de la app son orientativas y el nutricionista decide.
- **Depender de una sola persona (tú).** Documenta el proceso de alta y de soporte para poder delegarlo.
- **Spam en comunidades.** Te echan y quema el canal; aporta primero.

---

## 10. Esta semana: 8 tareas concretas

1. **Actualizar la landing** con el centro de control, las alertas, el reajuste automático, la marca blanca, el escáner y
   el RGPD, con 4–5 capturas y un vídeo de 60 s. *(Puedo hacerla yo.)*
2. **Decidir el precio de partida** (sección 3 bis) y el plan gratuito.
3. **Encargar los textos legales** a un profesional (privacidad, términos, contrato de encargado del tratamiento).
4. **Comprar el dominio** y crear el correo de soporte.
5. **Mirar 3–5 programas competidores** (precio, límite de clientes, funciones) y apuntarlo en una tabla: lo que aquí
   no he podido comprobar.
6. **Listar 10 nutricionistas conocidos** y escribirles hoy para el piloto.
7. **Grabar 3 vídeos cortos** con la demo (centro de control, app del cliente, reajuste).
8. **Activar las notificaciones push** y comprobar un aviso real.

### Lo que puedo construir yo en NutriFit para apoyar el plan
- La **landing nueva** (con las funciones actuales, vídeo, precios y preguntas frecuentes).
- **Páginas legales** (la estructura; el texto lo revisa un profesional).
- **Cobro con Stripe** (planes, prueba de 14 días, facturas, baja).
- **Alta sin aprobación manual** y **onboarding guiado** con la lista de 4 pasos.
- **«Hecho con NutriFit»** en la app del cliente y **enlace de referidos**.
- **Parámetro `?ref=`** y un **panel de métricas** (registros, activados, de pago, canal).
