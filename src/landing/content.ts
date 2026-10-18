// Textos de la página de presentación. Solo se cuenta lo que la aplicación hace de verdad, y no hay precios, cifras ni
// opiniones de clientes inventadas: si algún día los hay, que salgan de datos reales. (src/landing/content.test.ts lo vigila.)

export const HERO = {
  eyebrow: 'Software para nutricionistas',
  titleLine1: 'Sabes a quién',
  titleAccent: 'escribir hoy',
  titleLine2: 'sin revisar cliente por cliente',
  subtitle: 'NutriFit te enseña qué clientes necesitan atención y por qué. Tu cliente lleva su plan en el móvil, sin descargar nada, y tú ves cómo le va.',
  proof: ['La demo no necesita cuenta', 'Tu cliente no descarga nada', 'Con tu logo y tus colores'],
}

export const PAINS = [
  { title: 'Mirar cliente por cliente', text: 'Cada semana abres fichas, hojas y chats para saber quién va mal. Aquí lo ves nada más entrar, ordenado por quién necesita más atención.' },
  { title: 'Enterarte tarde', text: 'Un cliente que deja de hacer check-in suele ser un cliente que se va. NutriFit te avisa el mismo día y te sugiere por dónde empezar.' },
  { title: 'El plan que nadie sigue', text: 'Un PDF no se actualiza ni se sigue. Aquí el plan vive en el móvil de tu cliente: marca lo que come, apunta cómo se siente y tú lo ves.' },
]

export const STEPS = [
  { title: 'Trae a tus clientes', text: 'Créalos en un minuto, o súbelos desde tu Excel con su peso anterior, sus notas de consulta y sus analíticas. Si ya existen, no se duplican.' },
  { title: 'Hazles el plan', text: 'Objetivos, comidas y alimentos, con plantillas, recetas y sustituciones que respetan sus alergias. Cada cambio queda en un historial con su motivo.' },
  { title: 'Ellos lo siguen, tú decides', text: 'Tu cliente entra con un enlace personal desde el móvil. Tú ves quién necesita atención, qué mirar primero y cómo evoluciona hacia su objetivo.' },
]

export interface FeatureGroup { id: string; label: string; title: string; items: { title: string; text: string }[] }

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: 'tu', label: 'Para ti', title: 'Tu día, ordenado',
    items: [
      { title: 'A quién atender hoy', text: 'Avisos de falta de check-in, peso estancado, hambre alta o adherencia baja, cada uno con una sugerencia de por dónde empezar.' },
      { title: 'Revisión semanal sugerida', text: 'Compara la semana con la anterior y propone qué hacer. Tú aceptas, editas o descartas.' },
      { title: 'Reajustes con su porqué', text: 'Propone subir o bajar las kcal explicando en qué datos se basa. Si el cliente no sigue el plan, lo dice antes de recortar nada.' },
      { title: 'Lo que come de verdad', text: 'El balance de cada día: las comidas del plan y los extras que escanea, frente a su objetivo. Ves qué explica que «se desajuste».' },
      { title: 'Informes, agenda y mensajes', text: 'Informe PDF de progreso, calendario con las citas que pide el cliente, plantillas para WhatsApp y difusión a grupos.' },
      { title: 'Tu negocio de un vistazo', text: 'Ingresos estimados, retención, bajas con su motivo y qué clientes tienen riesgo de abandono.' },
    ],
  },
  {
    id: 'cliente', label: 'Para tu cliente', title: 'Una app que da gusto seguir',
    items: [
      { title: 'Una app con tu marca, sin descargar nada', text: 'Entra con un enlace personal y, si quiere, la añade a su pantalla de inicio. Ve tu logo y tu color.' },
      { title: 'Check-in diario en segundos', text: '¿Siguió el plan?, hambre, energía, ánimo, agua y digestión. Sin preguntárselo por WhatsApp.' },
      { title: 'Escáner de productos con la cámara', text: 'Apunta al código de barras y ve las kcal y macros de lo que toma. Lo apunta y ve cómo queda su día.' },
      { title: 'Sustituciones sin sorpresas', text: 'Alimentos del mismo grupo con las cantidades equivalentes, y nunca uno que choque con sus alergias o intolerancias.' },
      { title: 'Recetas y lista de la compra', text: 'Su plan se convierte en una lista agrupada por pasillos, y sus recetas con foto y pasos.' },
      { title: 'Su progreso, con una lectura clara', text: 'Peso, adherencia, racha y fotos antes y después, con un «¿Cómo vas?» en una frase.' },
    ],
  },
  {
    id: 'consulta', label: 'Para tu consulta', title: 'Tuyo de principio a fin',
    items: [
      { title: 'Con tu marca', text: 'Tu logo, tu color y tu WhatsApp en el panel que ven tus clientes.' },
      { title: 'Plantillas, recetas y alimentos propios', text: 'Guarda tus planes y reutilízalos. Añade al catálogo los productos que usas tú.' },
      { title: 'Trae lo que ya tenías', text: 'Importa clientes, peso, notas de consulta y analíticas desde Excel o CSV, o pegando una tabla de un PDF.' },
      { title: 'Datos de salud con cuidado', text: 'Fotos y analíticas privadas con enlaces temporales, tus notas que el cliente nunca ve, consentimiento informado propio y exportar o eliminar todo lo de un cliente.' },
      { title: 'Una guía dentro de la app', text: 'Tutorial paso a paso y un buscador (Ctrl+K) que te lleva a lo que quieres hacer.' },
      { title: 'Para consultas pequeñas', text: 'Pensado para quien lleva su consulta solo o con poco equipo: sin instalaciones ni configuraciones eternas.' },
    ],
  },
]

export const FAQ = [
  { q: '¿Mis clientes tienen que descargar algo?', a: 'No. Entran con un enlace personal desde el navegador del móvil y, si quieren, lo añaden a su pantalla de inicio para usarlo como una app.' },
  { q: '¿Puedo probarlo sin crear una cuenta?', a: 'Sí. La demo en vivo tiene datos ficticios y te deja recorrer el panel entero. Nada de lo que hagas en ella se guarda.' },
  { q: '¿Puedo traer a mis clientes actuales?', a: 'Sí, desde una hoja de Excel o CSV, o pegando una tabla copiada de un PDF. Puedes traer también su peso anterior, sus notas de consulta y sus analíticas. Antes de guardar ves qué se va a importar y qué filas no se han podido leer, y repetir la importación no duplica nada.' },
  { q: '¿Qué pasa con los datos de salud de mis clientes?', a: 'Se alojan en servidores de la Unión Europea. Cada cliente solo ve lo suyo, tus notas privadas nunca las ve, las fotos y las analíticas se sirven con enlaces temporales y puedes exportar o eliminar todo lo de un cliente cuando quieras.' },
  { q: '¿Las sugerencias sustituyen mi criterio?', a: 'No. Son reglas sencillas que te enseñan en qué datos se basan (por ejemplo, el ritmo de peso y la adherencia). Tú decides si las aceptas, las editas o las descartas.' },
  { q: '¿Puedo poner mi logo y mis colores?', a: 'Sí: tu logo, tu color de acento y tu teléfono de WhatsApp aparecen en el panel que ven tus clientes y en los PDF que les envías.' },
  { q: '¿Cómo empiezo?', a: 'Solicita acceso, crea tu primer cliente y hazle un plan. Dentro hay un recuadro de primeros pasos y una guía que te lleva de la mano.' },
]

export const FINAL_CTA = {
  title: 'Míralo funcionando',
  text: 'Recorre el panel con datos de ejemplo, sin cuenta. Si te encaja, solicita acceso y prueba con un cliente tuyo.',
}
