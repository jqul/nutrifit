// "¿Vas a comer fuera?" — guía rápida por tipo de restaurante para que el
// cliente no llegue a la mesa sin ninguna pauta. Contenido fijo y genérico
// (no sustituye ni conoce el plan concreto del cliente) — pensado para
// bajar la ansiedad social de la comida fuera de casa, no para sustituir el
// criterio del nutricionista en casos concretos.

export interface EatingOutGuide {
  id: string
  emoji: string
  label: string
  tips: string[]
}

export const EATING_OUT_GUIDES: EatingOutGuide[] = [
  {
    id: 'italiano', emoji: '🍝', label: 'Italiano',
    tips: [
      'Prioriza pasta con tomate, marisco o verduras antes que salsas cremosas (carbonara, cuatro quesos, boloñesa con mucha nata).',
      'Si hay pizza, mejor base fina y sin exceso de quesos/embutidos — una margarita o una con verduras y algo de proteína.',
      'Empieza con una ensalada o un antipasto de verduras para llegar menos hambriento al plato principal.',
      'El pan de la cesta no hace falta terminarlo entero — pide que lo retiren si ya has comido suficiente.',
    ],
  },
  {
    id: 'japones', emoji: '🍣', label: 'Japonés',
    tips: [
      'El sashimi y el nigiri son de las opciones más ligeras — cuidado con los rolls tempurizados o bañados en salsas dulces (mango, queso crema, mayonesa picante).',
      'La salsa de soja tiene mucho sodio — no hace falta empapar cada pieza, con mojar la punta es suficiente.',
      'El edamame de entrante es buena fuente de proteína vegetal y sacia antes del plato principal.',
      'Si hay ramen, elige uno con más verdura/proteína y modera el caldo si buscas cuidar el sodio.',
    ],
  },
  {
    id: 'hamburgueseria', emoji: '🍔', label: 'Hamburguesería',
    tips: [
      'Una sola hamburguesa (sin doblar carne ni queso) suele encajar mejor que ir a por el tamaño XL — puedes complementar con una ensalada de guarnición.',
      'Cambia las patatas fritas por ensalada o patata asada si la carta lo permite, o comparte una ración de patatas en vez de pedir una entera para ti.',
      'Ojo con las salsas extra (mayonesa, barbacoa, especial de la casa) — suelen sumar más de lo que parece; pide una aparte y dosifica.',
      'Si hay opción de pan integral o sin la parte de arriba del pan, es una forma fácil de bajar algo de carga calórica sin perderte el resto.',
    ],
  },
  {
    id: 'tapeo', emoji: '🍤', label: 'Tapeo / españa',
    tips: [
      'Prioriza raciones de marisco, pescado a la plancha, jamón o tortilla antes que fritos (croquetas, calamares, patatas bravas) — un par de fritos está bien, no hace falta que sea toda la mesa.',
      'El pan y las bravas suelen ser lo primero en llegar y lo que más se pica sin darte cuenta — empieza por algo de proteína o verdura si puedes elegir el orden.',
      'Comparte raciones en vez de pedir individual — en tapeo es lo normal y ayuda a moderar sin que se note.',
      'Cuidado con el alcohol entre tapa y tapa: suma calorías rápido y baja la percepción de saciedad.',
    ],
  },
  {
    id: 'asador', emoji: '🥩', label: 'Asador / carnes',
    tips: [
      'Elige piezas magras (solomillo, lomo) antes que cortes muy grasos si buscas cuidar la ingesta de grasa — el entrecot y la costilla son sabrosos pero mucho más calóricos.',
      'Pide la guarnición de verdura/ensalada en vez de duplicar patatas o pan.',
      'Las salsas (chimichurri, alioli, pimienta) suman aparte — pide poca cantidad o que la sirvan al lado.',
      'Un entrante ligero (pimientos, ensalada, verdura a la brasa) ayuda a no llegar con demasiada hambre al plato fuerte.',
    ],
  },
  {
    id: 'comida_rapida', emoji: '🌯', label: 'Comida rápida (kebab, bocatería, wok...)',
    tips: [
      'Si puedes elegir el pan, prioriza uno integral o de tamaño normal en vez del más grande disponible.',
      'Pide extra de verdura/ensalada dentro del bocadillo o kebab — suele ser gratis y ayuda a saciar sin sumar muchas kcal.',
      'Modera las salsas (mayonesa, alioli, picante con nata) — pide "poca" o que la pongan aparte para controlar la cantidad.',
      'Si es wok/buffet libre, empieza con un plato de verdura y proteína antes de repetir — llegar con hambre a un buffet suele acabar en raciones más grandes de lo planeado.',
    ],
  },
]

export function getEatingOutGuide(id: string): EatingOutGuide | undefined {
  return EATING_OUT_GUIDES.find(g => g.id === id)
}
