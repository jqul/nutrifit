export type Role = 'trainer' | 'super_admin'

export interface CustomAnamnesisQuestion {
  id: string
  label: string
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
}

export interface DietMeal {
  id: string
  name: string
  time: string
  kcalTarget: number | null
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
