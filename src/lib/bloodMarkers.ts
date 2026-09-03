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
    lowAdvice: 'Glucosa baja — vigilar tomas frecuentes de carbohidratos de calidad y evitar ayunos largos.',
    highAdvice: 'Glucosa elevada — reducir azúcares simples y carbohidratos refinados, priorizar fibra e índice glucémico bajo.',
  },
  {
    key: 'colesterol_total', label: 'Colesterol total', unit: 'mg/dL', min: 0, max: 200, category: 'cardiovascular', scaleMin: 0, scaleMax: 300,
    lowAdvice: '',
    highAdvice: 'Colesterol total elevado — reducir grasas saturadas y trans, aumentar fibra soluble (avena, legumbres).',
  },
  {
    key: 'ldl', label: 'LDL ("colesterol malo")', unit: 'mg/dL', min: 0, max: 100, category: 'cardiovascular', scaleMin: 0, scaleMax: 200,
    lowAdvice: '',
    highAdvice: 'LDL elevado — priorizar grasas insaturadas (aceite de oliva, pescado azul, frutos secos) y reducir grasas saturadas.',
  },
  {
    key: 'hdl', label: 'HDL ("colesterol bueno")', unit: 'mg/dL', min: 40, max: 999, category: 'cardiovascular', scaleMin: 20, scaleMax: 100,
    lowAdvice: 'HDL bajo — aumentar actividad física y grasas insaturadas (aceite de oliva, pescado azul, aguacate).',
    highAdvice: '',
  },
  {
    key: 'trigliceridos', label: 'Triglicéridos', unit: 'mg/dL', min: 0, max: 150, category: 'cardiovascular', scaleMin: 0, scaleMax: 300,
    lowAdvice: '',
    highAdvice: 'Triglicéridos elevados — reducir azúcares simples y alcohol, aumentar omega-3 (pescado azul).',
  },
  {
    key: 'got_ast', label: 'GOT / AST (transaminasas)', unit: 'U/L', min: 5, max: 40, category: 'hepatica', scaleMin: 0, scaleMax: 80,
    lowAdvice: '',
    highAdvice: 'Transaminasas elevadas — valorar reducir grasas saturadas y azúcares (asociado a hígado graso); conviene confirmarlo con el médico.',
  },
  {
    key: 'gpt_alt', label: 'GPT / ALT (transaminasas)', unit: 'U/L', min: 7, max: 56, category: 'hepatica', scaleMin: 0, scaleMax: 100,
    lowAdvice: '',
    highAdvice: 'Transaminasas elevadas — valorar reducir grasas saturadas y azúcares (asociado a hígado graso); conviene confirmarlo con el médico.',
  },
  {
    key: 'hierro', label: 'Hierro', unit: 'µg/dL', min: 60, max: 170, category: 'vitaminas', scaleMin: 20, scaleMax: 250,
    lowAdvice: 'Hierro bajo — aumentar alimentos ricos en hierro (carnes rojas, legumbres, espinacas) junto con vitamina C para mejorar la absorción.',
    highAdvice: 'Hierro elevado — evitar suplementación de hierro sin supervisión médica.',
  },
  {
    key: 'vitamina_d', label: 'Vitamina D', unit: 'ng/mL', min: 30, max: 100, category: 'vitaminas', scaleMin: 0, scaleMax: 150,
    lowAdvice: 'Vitamina D baja — aumentar exposición solar y alimentos como pescado azul, huevo y lácteos fortificados; valorar suplementación con el médico.',
    highAdvice: '',
  },
  {
    key: 'tsh', label: 'TSH', unit: 'µU/mL', min: 0.4, max: 4.0, category: 'tiroides', scaleMin: 0, scaleMax: 8,
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
