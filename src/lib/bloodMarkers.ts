// Marcadores clínicos comunes con rango de referencia fijo y consejo
// nutricional cuando salen fuera de rango — sin IA ni lectura de PDF/imagen,
// es entrada manual del valor que da el laboratorio. Los rangos son
// orientativos (los laboratorios varían ligeramente); esto no sustituye el
// diagnóstico médico, solo da una alerta y una pauta nutricional general.

export type MarkerCategory = 'metabolico' | 'cardiovascular' | 'hepatica' | 'vitaminas' | 'tiroides'

export const MARKER_CATEGORY_LABELS: Record<MarkerCategory, string> = {
  metabolico: 'Metabólico y glucosa',
  cardiovascular: 'Cardiovascular y lípidos',
  hepatica: 'Función hepática',
  vitaminas: 'Vitaminas y minerales',
  tiroides: 'Tiroides',
}

export interface BloodMarkerDef {
  key: string
  label: string
  unit: string
  min: number
  max: number
  lowAdvice: string
  highAdvice: string
  category: MarkerCategory
  // Descripción clínica breve — qué es este marcador, para el subtítulo
  // de HoloRangeBar en vez del genérico "Rango óptimo: X–Y".
  description: string
  // Límites del eje visual de la barra calibrada (HoloRangeBar) — a
  // diferencia de min/max (el umbral clínico de "normal"), aquí es solo
  // el rango que se dibuja de punta a punta, elegido para que las tres
  // zonas (baja/óptima/alta) queden proporcionadas y legibles.
  scaleMin: number
  scaleMax: number
}

export const BLOOD_MARKERS: BloodMarkerDef[] = [
  {
    key: 'glucosa', label: 'Glucosa (ayunas)', unit: 'mg/dL', min: 70, max: 99, category: 'metabolico', scaleMin: 40, scaleMax: 180,
    description: 'Nivel basal de azúcar en sangre tras 8–12h de ayuno.',
    lowAdvice: 'Glucosa baja — vigilar tomas frecuentes de carbohidratos de calidad y evitar ayunos largos.',
    highAdvice: 'Glucosa elevada — reducir azúcares simples y carbohidratos refinados, priorizar fibra e índice glucémico bajo.',
  },
  {
    key: 'colesterol_total', label: 'Colesterol total', unit: 'mg/dL', min: 0, max: 200, category: 'cardiovascular', scaleMin: 0, scaleMax: 300,
    description: 'Suma de todas las fracciones lipídicas circulantes en sangre.',
    lowAdvice: '',
    highAdvice: 'Colesterol total elevado — reducir grasas saturadas y trans, aumentar fibra soluble (avena, legumbres).',
  },
  {
    key: 'ldl', label: 'LDL ("colesterol malo")', unit: 'mg/dL', min: 0, max: 100, category: 'cardiovascular', scaleMin: 0, scaleMax: 200,
    description: 'Lipoproteína de baja densidad — transporta colesterol a los tejidos.',
    lowAdvice: '',
    highAdvice: 'LDL elevado — priorizar grasas insaturadas (aceite de oliva, pescado azul, frutos secos) y reducir grasas saturadas.',
  },
  {
    key: 'hdl', label: 'HDL ("colesterol bueno")', unit: 'mg/dL', min: 40, max: 999, category: 'cardiovascular', scaleMin: 20, scaleMax: 100,
    description: 'Lipoproteína de alta densidad — retira el exceso de colesterol.',
    lowAdvice: 'HDL bajo — aumentar actividad física y grasas insaturadas (aceite de oliva, pescado azul, aguacate).',
    highAdvice: '',
  },
  {
    key: 'trigliceridos', label: 'Triglicéridos', unit: 'mg/dL', min: 0, max: 150, category: 'cardiovascular', scaleMin: 0, scaleMax: 300,
    description: 'Grasas circulantes que el cuerpo usa como reserva energética.',
    lowAdvice: '',
    highAdvice: 'Triglicéridos elevados — reducir azúcares simples y alcohol, aumentar omega-3 (pescado azul).',
  },
  {
    key: 'got_ast', label: 'GOT / AST (transaminasas)', unit: 'U/L', min: 5, max: 40, category: 'hepatica', scaleMin: 0, scaleMax: 80,
    description: 'Enzima hepática — su elevación puede indicar daño en el hígado.',
    lowAdvice: '',
    highAdvice: 'Transaminasas elevadas — valorar reducir grasas saturadas y azúcares (asociado a hígado graso); conviene confirmarlo con el médico.',
  },
  {
    key: 'gpt_alt', label: 'GPT / ALT (transaminasas)', unit: 'U/L', min: 7, max: 56, category: 'hepatica', scaleMin: 0, scaleMax: 100,
    description: 'Enzima hepática más específica del hígado que la AST.',
    lowAdvice: '',
    highAdvice: 'Transaminasas elevadas — valorar reducir grasas saturadas y azúcares (asociado a hígado graso); conviene confirmarlo con el médico.',
  },
  {
    key: 'hierro', label: 'Hierro', unit: 'µg/dL', min: 60, max: 170, category: 'vitaminas', scaleMin: 20, scaleMax: 250,
    description: 'Mineral esencial para el transporte de oxígeno en sangre.',
    lowAdvice: 'Hierro bajo — aumentar alimentos ricos en hierro (carnes rojas, legumbres, espinacas) junto con vitamina C para mejorar la absorción.',
    highAdvice: 'Hierro elevado — evitar suplementación de hierro sin supervisión médica.',
  },
  {
    key: 'vitamina_d', label: 'Vitamina D', unit: 'ng/mL', min: 30, max: 100, category: 'vitaminas', scaleMin: 0, scaleMax: 150,
    description: 'Vitamina liposoluble clave para la salud ósea e inmunitaria.',
    lowAdvice: 'Vitamina D baja — aumentar exposición solar y alimentos como pescado azul, huevo y lácteos fortificados; valorar suplementación con el médico.',
    highAdvice: '',
  },
  {
    key: 'tsh', label: 'TSH', unit: 'µU/mL', min: 0.4, max: 4.0, category: 'tiroides', scaleMin: 0, scaleMax: 8,
    description: 'Hormona hipofisaria reguladora de la función tiroidea.',
    lowAdvice: 'TSH baja — derivar a valoración médica (posible hipertiroidismo).',
    highAdvice: 'TSH elevada — derivar a valoración médica (posible hipotiroidismo); asegurar ingesta adecuada de yodo y selenio.',
  },
]

// Plantillas de registro rápido: qué marcadores precargar en el formulario
// según la batería de análisis que traiga el cliente, para no tener que
// añadirlos uno a uno.
export interface MarkerTemplate { name: string; markerKeys: string[] }
export const MARKER_TEMPLATES: MarkerTemplate[] = [
  { name: 'Batería completa', markerKeys: BLOOD_MARKERS.map(m => m.key) },
  { name: 'Perfil lipídico', markerKeys: ['colesterol_total', 'ldl', 'hdl', 'trigliceridos'] },
  { name: 'Metabólica', markerKeys: ['glucosa', 'got_ast', 'gpt_alt'] },
  { name: 'Vitaminas', markerKeys: ['hierro', 'vitamina_d'] },
]

export const BLOOD_MARKER_MAP: Record<string, BloodMarkerDef> = Object.fromEntries(BLOOD_MARKERS.map(m => [m.key, m]))

export type MarkerStatus = 'bajo' | 'normal' | 'alto'

export function evaluateMarker(def: BloodMarkerDef, value: number): MarkerStatus {
  if (value < def.min) return 'bajo'
  if (value > def.max) return 'alto'
  return 'normal'
}

/** Consejo nutricional para un valor fuera de rango — cadena vacía si está dentro de rango o si ese lado no tiene consejo definido. */
export function adviceForMarker(def: BloodMarkerDef, value: number): string {
  const status = evaluateMarker(def, value)
  if (status === 'bajo') return def.lowAdvice
  if (status === 'alto') return def.highAdvice
  return ''
}

export type MarkerTier = 'optimo' | 'normal' | 'atencion'

/**
 * Lectura más fina que evaluateMarker para el scorecard ejecutivo: divide
 * lo que ya es "normal" en dos franjas — óptimo (el tercio central del
 * rango clínico) y normal (dentro de rango pero cerca de un extremo) —
 * sin inventar un umbral clínico nuevo, solo qué tan centrado está el
 * valor dentro del rango que ya define BLOOD_MARKERS.
 */
export function markerTier(def: BloodMarkerDef, value: number): MarkerTier {
  if (evaluateMarker(def, value) !== 'normal') return 'atencion'
  const span = def.max - def.min
  // Marcadores con un max "centinela" (ej. HDL: max 999 porque un HDL alto
  // nunca es un problema) no tienen un extremo real del que alejarse — en
  // rango ya es lo mejor posible.
  if (span <= 0 || !isFinite(span) || span > 500) return 'optimo'
  const center = def.min + span / 2
  return Math.abs(value - center) <= span * 0.3 ? 'optimo' : 'normal'
}
