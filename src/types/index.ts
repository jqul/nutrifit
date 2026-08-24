export type Role = 'trainer' | 'super_admin'

// Tipos de pregunta para preguntas propias (cuestionario de salud y
// encuestas recurrentes) — igual que en PanelFit: el nutricionista elige el
// tipo al crear cada pregunta, no solo texto libre.
export type SurveyQuestionType = 'text' | 'scale' | 'yesno' | 'choice'

export interface CustomAnamnesisQuestion {
  id: string
  label: string
  // Opcionales por compatibilidad con preguntas guardadas antes de tener
  // tipos — se tratan como 'text' si faltan (ver QUESTION_TYPE_LABELS).
  type?: SurveyQuestionType
  options?: string[] // solo para type: 'choice'
  required?: boolean
}

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: Role
  approved: boolean
  createdAt: number
  customAnamnesisQuestions: CustomAnamnesisQuestion[]
  logoUrl: string | null
  accentColor: string | null
  customDomain: string | null
}

// Objetivos predefinidos con etiqueta traducida — el campo `goal` del cliente
// es texto libre (el nutricionista puede escribir uno propio si ninguno encaja).
export type PresetGoal = 'perder_peso' | 'ganar_masa' | 'mantenimiento' | 'rendimiento' | 'salud'

export interface ClientData {
  id: string
  nutricionistaId: string
  token: string
  authUserId: string | null
  name: string
  surname: string
  phone: string
  email: string
  birthDate: string | null
  gender: string | null
  heightCm: number | null
  goal: string | null
  allergies: string
  notes: string
  monthlyPrice: number | null
  goalWeightKg: number | null
  customMessages: Record<string, string>
  tags: string[]
  createdAt: number
}

export interface DietMealItem {
  id: string
  foodName: string
  quantity: string
  unit: string
  kcal: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  // Opcionales: solo los rellenan los alimentos del catálogo o el escáner de
  // código de barras — los datos de demo no los incluyen en cada ítem.
  fiberG?: number | null
  sugarG?: number | null
  sodiumMg?: number | null
  saturatedFatG?: number | null
  calciumMg?: number | null
  ironMg?: number | null
  zincMg?: number | null
  recipeId?: string | null // receta de la que salió este ítem (si vino de "Insertar receta"), para el recetario dinámico
}

// 0=lunes ... 6=domingo. null/undefined = todos los días (comportamiento
// anterior al cuadrante semanal, y el que siguen teniendo los planes ya
// creados salvo que el nutricionista asigne un día concreto a una comida).
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface DietMeal {
  id: string
  name: string
  time: string
  kcalTarget: number | null
  dayOfWeek?: DayOfWeek | null
  // Pauta flexible por opciones: las comidas que comparten el mismo
  // optionGroup son alternativas intercambiables del mismo hueco (ej.
  // "Comida: Opción A / B / C") — el cliente elige cuál sigue ese día.
  // null = comida fija, sin opciones (comportamiento de siempre).
  optionGroup?: string | null
  optionLabel?: string | null
  // Carb cycling: variante de la comida para día de entrenamiento (ON) o de
  // descanso (OFF), independiente de dayOfWeek — el cliente elige cada día
  // qué tipo de día es. null/undefined = aplica cualquier día (comportamiento
  // de siempre).
  dayType?: 'on' | 'off' | null
  items: DietMealItem[]
}

export interface DietSupplement {
  id: string
  name: string
  dose: string
  timing: string
  visibleToClient: boolean
}

export interface DietPlan {
  id: string
  clientId: string
  nutricionistaId: string
  name: string
  kcalTarget: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
  advice: string
  isActive: boolean
  meals: DietMeal[]
  supplements: DietSupplement[]
  createdAt: number
  updatedAt: number
}

export interface DietTemplate {
  id: string
  nutricionistaId: string
  name: string
  plan: Omit<DietPlan, 'id' | 'clientId' | 'nutricionistaId' | 'createdAt' | 'updatedAt' | 'isActive'>
}

export interface WeightEntry {
  id: string
  clientId: string
  date: string
  weightKg: number
  note: string
}

export interface ProgressPhotoSession {
  id: string
  clientId: string
  date: string
  frontUrl: string | null
  sideUrl: string | null
  backUrl: string | null
  note: string
}

export interface Food {
  id: string
  name: string
  category: string
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG?: number | null
  sugarG?: number | null
  sodiumMg?: number | null
  saturatedFatG?: number | null
  calciumMg?: number | null
  ironMg?: number | null
  zincMg?: number | null
  reference?: string | null
  nutricionistaId?: string | null
}

export type MessageType = 'nuevo_plan' | 'racha' | 'checkin_recordatorio' | 'custom'

export interface MessageTemplate {
  id: string
  nutricionistaId: string
  tipo: MessageType
  nombre: string
  texto: string
  createdAt: number
}

export type FollowedPlan = 'si' | 'parcial' | 'no'

export interface DailyCheckin {
  id: string
  clientId: string
  date: string
  followedPlan: FollowedPlan
  hunger: number
  energy: number
  mood: number
  waterL: number | null
  notes: string
  bristolScale?: number | null
  bloating?: number | null
  abdominalPain?: number | null
}

export type AppointmentStatus = 'pendiente' | 'confirmada' | 'cancelada' | 'completada'

export interface Appointment {
  id: string
  nutricionistaId: string
  clientId: string | null
  title: string
  startAt: string
  endAt: string
  status: AppointmentStatus
  notes: string
  recurring: 'weekly' | null
  videoLink: string | null
}

export interface MealLog {
  id: string
  clientId: string
  date: string
  mealName: string
  photoUrl: string | null
  note: string
  createdAt: number
}

export interface Anamnesis {
  id: string
  clientId: string
  answers: Record<string, string>
  completedAt: number | null
  updatedAt: number
}

export type SurveyFrequency = 'weekly' | 'monthly'

export interface CustomSurvey {
  id: string
  nutricionistaId: string
  name: string
  frequency: SurveyFrequency
  questions: CustomAnamnesisQuestion[]
  active: boolean
  createdAt: number
}

export interface SurveyResponse {
  id: string
  surveyId: string
  clientId: string
  periodKey: string
  answers: Record<string, string>
  submittedAt: number
}

export interface BloodMarker {
  id: string
  clientId: string
  date: string
  markerKey: string
  value: number
  createdAt: number
}

export type InvoiceStatus = 'pendiente' | 'pagado'

export interface Invoice {
  id: string
  nutricionistaId: string
  clientId: string
  period: string
  amount: number
  status: InvoiceStatus
  createdAt: number
}
