export type Role = 'trainer' | 'super_admin'

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: Role
  approved: boolean
  createdAt: number
}

export type Goal = 'perder_peso' | 'ganar_masa' | 'mantenimiento' | 'rendimiento' | 'salud'

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
  goal: Goal | null
  allergies: string
  notes: string
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
