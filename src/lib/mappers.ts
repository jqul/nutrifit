import {
  ClienteRow, DietPlanRow, DietMealRow, DietMealItemRow, DietSupplementRow,
  WeightLogRow, ProgressPhotoRow, DailyCheckinRow, FoodRow,
} from './supabase-types'
import {
  ClientData, DietPlan, DietMeal, DietMealItem, DietSupplement,
  WeightEntry, ProgressPhotoSession, DailyCheckin, Food,
} from '../types'

export function clientFromRow(row: ClienteRow): ClientData {
  return {
    id: row.id,
    nutricionistaId: row.nutricionista_id,
    token: row.token,
    authUserId: row.auth_user_id,
    name: row.name,
    surname: row.surname,
    phone: row.phone,
    email: row.email || '',
    birthDate: row.birth_date,
    gender: row.gender,
    heightCm: row.height_cm,
    goal: row.goal || null,
    allergies: row.allergies || '',
    notes: row.notes || '',
    createdAt: new Date(row.created_at).getTime(),
  }
}

export function clientToRow(client: Partial<ClientData>): Partial<ClienteRow> {
  const row: Partial<ClienteRow> = {}
  if (client.nutricionistaId !== undefined) row.nutricionista_id = client.nutricionistaId
  if (client.token !== undefined) row.token = client.token
  if (client.name !== undefined) row.name = client.name
  if (client.surname !== undefined) row.surname = client.surname
  if (client.phone !== undefined) row.phone = client.phone
  if (client.email !== undefined) row.email = client.email
  if (client.birthDate !== undefined) row.birth_date = client.birthDate
  if (client.gender !== undefined) row.gender = client.gender
  if (client.heightCm !== undefined) row.height_cm = client.heightCm
  if (client.goal !== undefined) row.goal = client.goal
  if (client.allergies !== undefined) row.allergies = client.allergies
  if (client.notes !== undefined) row.notes = client.notes
  return row
}

export function mealItemFromRow(row: DietMealItemRow): DietMealItem {
  return {
    id: row.id,
    foodName: row.food_name,
    quantity: row.quantity,
    unit: row.unit,
    kcal: row.kcal,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
  }
}

export function mealFromRow(row: DietMealRow, items: DietMealItemRow[]): DietMeal {
  return {
    id: row.id,
    name: row.name,
    time: row.time,
    kcalTarget: row.kcal_target,
    items: items.filter(i => i.meal_id === row.id).map(mealItemFromRow),
  }
}

export function supplementFromRow(row: DietSupplementRow): DietSupplement {
  return {
    id: row.id,
    name: row.name,
    dose: row.dose,
    timing: row.timing,
    visibleToClient: row.visible_to_client,
  }
}

export function dietPlanFromRows(
  plan: DietPlanRow, meals: DietMealRow[], items: DietMealItemRow[], supplements: DietSupplementRow[]
): DietPlan {
  return {
    id: plan.id,
    clientId: plan.client_id,
    nutricionistaId: plan.nutricionista_id,
    name: plan.name,
    kcalTarget: plan.kcal_target,
    proteinG: plan.protein_g,
    carbsG: plan.carbs_g,
    fatG: plan.fat_g,
    advice: plan.advice || '',
    isActive: plan.is_active,
    meals: meals.sort((a, b) => a.sort_order - b.sort_order).map(m => mealFromRow(m, items)),
    supplements: supplements.map(supplementFromRow),
    createdAt: new Date(plan.created_at).getTime(),
    updatedAt: new Date(plan.updated_at).getTime(),
  }
}

export function weightFromRow(row: WeightLogRow): WeightEntry {
  return { id: row.id, clientId: row.client_id, date: row.date, weightKg: row.weight_kg, note: row.note || '' }
}

export function photoSessionFromRow(row: ProgressPhotoRow): ProgressPhotoSession {
  return {
    id: row.id, clientId: row.client_id, date: row.date,
    frontUrl: row.front_url, sideUrl: row.side_url, backUrl: row.back_url, note: row.note || '',
  }
}

export function foodFromRow(row: FoodRow): Food {
  return {
    id: row.id, name: row.name, category: row.category,
    kcal: row.kcal, proteinG: row.protein_g, carbsG: row.carbs_g, fatG: row.fat_g,
  }
}

export function checkinFromRow(row: DailyCheckinRow): DailyCheckin {
  return {
    id: row.id, clientId: row.client_id, date: row.date, followedPlan: row.followed_plan,
    hunger: row.hunger, energy: row.energy, mood: row.mood, waterL: row.water_l, notes: row.notes || '',
  }
}
