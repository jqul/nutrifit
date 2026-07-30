// Formas de fila crudas tal y como las devuelve Supabase (snake_case).
// src/types/index.ts contiene los tipos de app (camelCase); mappers.ts convierte entre ambos.

export interface NutricionistaRow {
  uid: string
  email: string
  display_name: string
  approved: boolean
  role: 'trainer' | 'super_admin'
  created_at: string
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
}
