# Tareas de UX/UI (salidas de la auditoría visual)

Principio de la auditoría: **no cambiar la identidad visual** (blanco roto + negro +
verde + serif). Simplificar → jerarquizar → agrupar → dar protagonismo al dato
importante → quitar ruido. **Sin funcionalidades nuevas** hasta cerrar esto.

Esfuerzo: S = <½ día · M = 1-2 días · L = 3+ días. Cada tarea es independiente
salvo que se indique lo contrario. Datos medidos en el código el 2026-10-04.

## Fase 0 — Base común (antes de rediseñar pantallas)

- [x] **UX-01 · Escala tipográfica** (S)
  Hay **106** usos de `text-[9px]/[10px]/[11px]` (26 solo en `PlanDietaTab`).
  Definir una escala (12 metadata · 14 secundario · 16 normal · 20 subtítulo ·
  28-36 títulos) y sustituir los tamaños sueltos.
  *Hecho cuando:* no quedan `text-[Npx]` por debajo de 12 px en pantallas de uso diario.
- [x] **UX-02 · Tres niveles de tarjeta** (S)
  Sin tarjeta (contenido normal) · tarjeta (agrupar) · tarjeta destacada (solo lo
  realmente importante). Crear componentes/clases y reducir `border border-border`
  en favor de espacio y fondos.
  *Hecho cuando:* una pantalla muestra como mucho una tarjeta destacada.
- [ ] **UX-03 · Regla de iconos** (S)
  Icono = apoyo, nunca protagonista. Quitar iconos decorativos donde cada bloque tiene uno.

## Fase 1 — Las 4 pantallas que definen el producto

- [x] **UX-10 · Lista de Clientes** (M) — prioridad 1 (6,5 → 9)
  Una fila = una persona + estado + acción. Mostrar peso y variación, adherencia, racha y
  el **semáforo de salud** (`clientHealth`: attention/billing/streak/active) con mucho
  más protagonismo. Filtros con contadores (Todos · Activos · Atención).
  *Hecho cuando:* se ve de un vistazo quién necesita atención sin abrir fichas.
- [x] **UX-11 · Cabecera fija de la ficha de cliente** (M) — prioridad 3
  Nombre + estado + 3 KPIs (peso, adherencia, racha) siempre visibles; debajo pestañas
  Resumen · Plan · Seguimiento · Salud · Mensajes. Quitar el efecto "panel dentro de panel".
- [x] **UX-12 · Editor del plan de dieta en 3 niveles** (L) — prioridad 2 (6 → 9)
  `PlanDietaTab` tiene **1.373 líneas y 43 botones** compitiendo con el contenido.
  Nivel 1 resumen de objetivos (kcal/macros) · Nivel 2 comidas como tarjetas con sus
  alimentos · Nivel 3 herramientas agrupadas (Calculadora/Importar/Escáner) y acciones
  del plan (Guardar plantilla/Duplicar/PDF) en menús, no sueltas.
  *Primer paso:* separar el fichero en subcomponentes sin cambiar comportamiento.
- [ ] **UX-13 · "Hoy" del cliente con jerarquía** (M) — prioridad 4 (7 → 9,5)
  `HoyTab` (607 líneas). Orden fijo: saludo + adherencia/racha → comidas de hoy
  (hecha/actual/pendiente) → check-in → agua → próxima cita. Entenderla en 3 segundos.

## Fase 2 — Segunda ola

- [ ] **UX-20 · Seguimiento como historia** (M): Evolución (peso + variación semanal) →
  Adherencia (barra + racha) → Señales (hambre/energía/ánimo/digestión con semáforo).
- [ ] **UX-21 · Navegación del dashboard agrupada** (M): hoy 8 módulos al mismo nivel.
  Agrupar en Clientes · Planificación · Comunicación · Negocio · Herramientas · Ajustes.
- [ ] **UX-22 · Dieta del cliente más visual** (S): objetivo arriba, comidas con
  estado "completada", fotos de receta cuando existan.
- [ ] **UX-23 · Progreso del cliente emocional** (M): cifra grande de progreso
  desde el inicio, gráfico limpio, racha, y fotos con protagonismo.
- [ ] **UX-24 · Plantillas: separar Planes / Recetas / Guías** (S): hoy conviven
  plantillas, recetas, guías y "comer fuera" en una sola pantalla de 418 líneas.
- [ ] **UX-25 · Ajustes por categorías** (S): Cuenta · Experiencia del cliente ·
  Marca · Legal.
- [ ] **UX-26 · Calendario con vista lista** (M): hoy **no existe** (solo cuadrícula de
  7 columnas). Añadir Semana/Lista; en móvil, lista por defecto.
- [ ] **UX-27 · Analíticas más limpias** (S): marcador = barra + valor + anterior;
  referencias y detalles médicos en un desplegable.

## Fase 3 — Pulido

- [ ] **UX-30 · "Más" del cliente por secciones** (S): Cuenta · Recursos · Aplicación ·
  Seguridad en lugar de una tarjeta suelta por opción.
- [ ] **UX-31 · Mensajes: la plantilla global, secundaria** (S).
- [ ] **UX-32 · Negocio: un KPI principal, el resto subordinado** (S).
- [ ] **UX-33 · Conversor y Micronutrientes como "Herramientas"** (S).
- [ ] **UX-34 · Difusión en 3 pasos** (S): destinatarios → mensaje → revisar y enviar.
- [ ] **UX-35 · Registro y consentimiento del cliente más cálidos** (S).
- [ ] **UX-36 · Landing: captura real del producto bajo el hero** (S).
- [ ] **UX-37 · Notas: aviso "solo visible para ti" + fecha de última edición** (S).

## Orden recomendado

UX-01 → UX-02 → UX-10 → UX-11 → UX-12 → UX-13 → Fase 2 → Fase 3.

Cada tarea debería cerrarse con: `tsc` limpio, tests y build en verde, y revisión en el
navegador (demo) de la pantalla tocada, en escritorio (nutricionista) y móvil (cliente).
