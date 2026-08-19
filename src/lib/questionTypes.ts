import { SurveyQuestionType } from '../types'

export const QUESTION_TYPE_LABELS: Record<SurveyQuestionType, string> = {
  scale: 'Escala 1-10', yesno: 'Sí / No', text: 'Texto libre', choice: 'Opción múltiple',
}

export const QUESTION_TYPE_ICONS: Record<SurveyQuestionType, string> = {
  scale: '📊', yesno: '✅', text: '✍️', choice: '🔘',
}

/** Preguntas guardadas antes de tener tipos no llevan `type` — se tratan como texto libre. */
export function questionType(type: SurveyQuestionType | undefined): SurveyQuestionType {
  return type || 'text'
}
