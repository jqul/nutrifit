export interface AnamnesisQuestion {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'number'
  options?: string[]
}

// Cuestionario fijo (no configurable) — cubre lo básico que cualquier
// nutricionista pregunta en una primera consulta.
export const ANAMNESIS_QUESTIONS: AnamnesisQuestion[] = [
  { key: 'motivo', label: '¿Cuál es tu objetivo principal?', type: 'textarea' },
  { key: 'condiciones', label: '¿Tienes alguna enfermedad o condición médica diagnosticada?', type: 'textarea' },
  { key: 'medicacion', label: '¿Tomas alguna medicación actualmente?', type: 'textarea' },
  { key: 'cirugias', label: '¿Has tenido cirugías relevantes?', type: 'textarea' },
  // Dato estructurado (opciones cerradas) que lee la calculadora metabólica y el reajuste: con embarazo o lactancia no se generan
  // objetivos automáticos de pérdida de peso. Se guarda en `answers` (JSON): no requiere cambios de esquema.
  { key: 'embarazo_lactancia', label: '¿Estás ahora mismo en embarazo o en periodo de lactancia? (solo si te aplica)', type: 'select', options: ['No (o no me aplica)', 'Embarazo', 'Lactancia', 'Prefiero comentarlo con mi profesional'] },
  { key: 'actividad', label: 'Nivel de actividad física', type: 'select', options: ['Sedentario', 'Ligera (1-3 días/semana)', 'Moderada (3-5 días/semana)', 'Alta (6-7 días/semana)'] },
  { key: 'sueno', label: 'Horas de sueño habituales', type: 'number' },
  { key: 'agua', label: 'Litros de agua que sueles beber al día', type: 'number' },
  { key: 'dietas_previas', label: '¿Has hecho dietas antes? ¿Cuáles y cómo te fue?', type: 'textarea' },
  { key: 'habitos', label: 'Alcohol, tabaco u otros hábitos a tener en cuenta', type: 'textarea' },
]
