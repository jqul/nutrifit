// Formas de fila crudas tal y como las devuelve Supabase (snake_case).
// src/types/index.ts contiene los tipos de app (camelCase); mappers.ts convierte entre ambos.

import { CustomAnamnesisQuestion } from '../types'

export interface NutricionistaRow {
  uid: string
  email: string
  display_name: string
  approved: boolean
  role: 'trainer' | 'super_admin'
  created_at: string
  custom_anamnesis_questions: CustomAnamnesisQuestion[]
  logo_url: string | null
  accent_color: string | null
  custom_domain: string | null
}

export interface ClienteRow {
  id: string
  nutricionista_id: string
  token: string
  auth_user_id: string | null
  name: string
  surname: string
  phone: string
  email: string | null
  birth_date: string | null
  gender: string | null
  height_cm: number | null
  goal: string | null
  allergies: string | null
  notes: string | null
  monthly_price: number | null
  goal_weight_kg: number | null
  custom_messages: Record<string, string> | null
  tags: string[]
  created_at: string
}

export interface DietPlanRow {
  id: string
  client_id: string
  nutricionista_id: string
  name: string
  kcal_target: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  advice: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DietMealRow {
  id: string
  plan_id: string
  name: string
  time: string
  kcal_target: number | null
  sort_order: number
}

export interface DietMealItemRow {
  id: string
  meal_id: string
  food_name: string
  quantity: string
  unit: string
  kcal: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
  sugar_g: number | null
  sodium_mg: number | null
  saturated_fat_g: number | null
  calcium_mg: number | null
  iron_mg: number | null
  zinc_mg: number | null
  sort_order: number
}

export interface DietSupplementRow {
  id: string
  plan_id: string
  name: string
  dose: string
  timing: string
  visible_to_client: boolean
}

export interface DietTemplateRow {
  id: string
  nutricionista_id: string
  name: string
  plan: unknown // jsonb snapshot
}

export interface WeightLogRow {
  id: string
  client_id: string
  date: string
  weight_kg: number
  note: string | null
}

export interface ProgressPhotoRow {
  id: string
  client_id: string
  date: string
  front_url: string | null
  side_url: string | null
  back_url: string | null
  note: string | null
}

export interface FoodRow {
  id: string
  name: string
  category: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number | null
  sugar_g: number | null
  sodium_mg: number | null
  saturated_fat_g: number | null
  calcium_mg: number | null
  iron_mg: number | null
  zinc_mg: number | null
  reference: string | null
  nutricionista_id: string | null // null = alimento del sistema, visible para todos
}

export interface MessageTemplateRow {
  id: string
  nutricionista_id: string
  tipo: 'nuevo_plan' | 'racha' | 'checkin_recordatorio' | 'custom'
  nombre: string
  texto: string
  created_at: string
}

export interface DailyCheckinRow {
  id: string
  client_id: string
  date: string
  followed_plan: 'si' | 'parcial' | 'no'
  hunger: number
  energy: number
  mood: number
  water_l: number | null
  notes: string | null
  bristol_scale: number | null
  bloating: number | null
  abdominal_pain: number | null
}

export interface AppointmentRow {
  id: string
  nutricionista_id: string
  client_id: string | null
  title: string
  start_at: string
  end_at: string
  status: 'pendiente' | 'confirmada' | 'cancelada' | 'completada'
  notes: string
  recurring: 'weekly' | null
  google_event_id: string | null
  video_link: string | null
}

export interface RecipeRow {
  id: string
  nutricionista_id: string | null // null = receta del sistema, visible para todos
  name: string
  items: unknown // jsonb: EditableItem[] tal cual (camelCase), snapshot igual que diet_templates.plan
  photo_url: string | null
  steps: string | null // pasos de preparación, texto libre (un paso por línea)
  created_at: string
}

export interface MealLogRow {
  id: string
  client_id: string
  date: string
  meal_name: string
  photo_url: string | null
  note: string | null
  created_at: string
}

export interface AnamnesisRow {
  id: string
  client_id: string
  answers: Record<string, string>
  completed_at: string | null
  updated_at: string
}

export interface CustomSurveyRow {
  id: string
  nutricionista_id: string
  name: string
  frequency: 'weekly' | 'monthly'
  questions: CustomAnamnesisQuestion[]
  active: boolean
  created_at: string
}

export interface SurveyResponseRow {
  id: string
  survey_id: string
  client_id: string
  period_key: string
  answers: Record<string, string>
  submitted_at: string
}

export interface BloodMarkerRow {
  id: string
  client_id: string
  date: string
  marker_key: string
  value: number
  created_at: string
}

export interface InvoiceRow {
  id: string
  nutricionista_id: string
  client_id: string
  period: string
  amount: number
  status: 'pendiente' | 'pagado'
  created_at: string
}
