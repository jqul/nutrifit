import {
  ClienteRow, DietPlanRow, DietMealRow, DietMealItemRow, DietSupplementRow,
  WeightLogRow, ProgressPhotoRow, DailyCheckinRow, FoodRow, MessageTemplateRow,
  AppointmentRow, MealLogRow, AnamnesisRow, InvoiceRow, CustomSurveyRow, SurveyResponseRow, BloodMarkerRow,
} from './supabase-types'
import {
  ClientData, DietPlan, DietMeal, DietMealItem, DietSupplement,
  WeightEntry, ProgressPhotoSession, DailyCheckin, Food, MessageTemplate,
  Appointment, MealLog, Anamnesis, Invoice, CustomSurvey, SurveyResponse, BloodMarker,
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
    monthlyPrice: row.monthly_price,
    goalWeightKg: row.goal_weight_kg,
    customMessages: row.custom_messages || {},
    tags: row.tags || [],
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
  if (client.monthlyPrice !== undefined) row.monthly_price = client.monthlyPrice
  if (client.goalWeightKg !== undefined) row.goal_weight_kg = client.goalWeightKg
  if (client.customMessages !== undefined) row.custom_messages = client.customMessages
  if (client.tags !== undefined) row.tags = client.tags
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
    fiberG: row.fiber_g,
    sugarG: row.sugar_g,
    sodiumMg: row.sodium_mg,
    saturatedFatG: row.saturated_fat_g,
    calciumMg: row.calcium_mg,
    ironMg: row.iron_mg,
    zincMg: row.zinc_mg,
    recipeId: row.recipe_id,
  }
}

export function mealFromRow(row: DietMealRow, items: DietMealItemRow[]): DietMeal {
  return {
    id: row.id,
    name: row.name,
    time: row.time,
    kcalTarget: row.kcal_target,
    dayOfWeek: row.day_of_week as DietMeal['dayOfWeek'],
    optionGroup: row.option_group,
    optionLabel: row.option_label,
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
    fiberG: plan.fiber_g,
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
    fiberG: row.fiber_g, sugarG: row.sugar_g, sodiumMg: row.sodium_mg, saturatedFatG: row.saturated_fat_g,
    calciumMg: row.calcium_mg, ironMg: row.iron_mg, zincMg: row.zinc_mg, reference: row.reference,
    nutricionistaId: row.nutricionista_id,
  }
}

export function messageTemplateFromRow(row: MessageTemplateRow): MessageTemplate {
  return {
    id: row.id, nutricionistaId: row.nutricionista_id, tipo: row.tipo,
    nombre: row.nombre, texto: row.texto, createdAt: new Date(row.created_at).getTime(),
  }
}

export function checkinFromRow(row: DailyCheckinRow): DailyCheckin {
  return {
    id: row.id, clientId: row.client_id, date: row.date, followedPlan: row.followed_plan,
    hunger: row.hunger, energy: row.energy, mood: row.mood, waterL: row.water_l, notes: row.notes || '',
    bristolScale: row.bristol_scale, bloating: row.bloating, abdominalPain: row.abdominal_pain,
  }
}

export function appointmentFromRow(row: AppointmentRow): Appointment {
  return {
    id: row.id, nutricionistaId: row.nutricionista_id, clientId: row.client_id,
    title: row.title, startAt: row.start_at, endAt: row.end_at,
    status: row.status, notes: row.notes || '', recurring: row.recurring,
    videoLink: row.video_link,
  }
}

export function mealLogFromRow(row: MealLogRow): MealLog {
  return {
    id: row.id, clientId: row.client_id, date: row.date, mealName: row.meal_name,
    photoUrl: row.photo_url, note: row.note || '', createdAt: new Date(row.created_at).getTime(),
  }
}

export function anamnesisFromRow(row: AnamnesisRow): Anamnesis {
  return {
    id: row.id, clientId: row.client_id, answers: row.answers || {},
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null,
    updatedAt: new Date(row.updated_at).getTime(),
  }
}

export function bloodMarkerFromRow(row: BloodMarkerRow): BloodMarker {
  return {
    id: row.id, clientId: row.client_id, date: row.date,
    markerKey: row.marker_key, value: row.value,
    createdAt: new Date(row.created_at).getTime(),
  }
}

export function invoiceFromRow(row: InvoiceRow): Invoice {
  return {
    id: row.id, nutricionistaId: row.nutricionista_id, clientId: row.client_id,
    period: row.period, amount: row.amount, status: row.status,
    createdAt: new Date(row.created_at).getTime(),
  }
}

export function surveyFromRow(row: CustomSurveyRow): CustomSurvey {
  return {
    id: row.id, nutricionistaId: row.nutricionista_id, name: row.name,
    frequency: row.frequency, questions: row.questions || [], active: row.active,
    createdAt: new Date(row.created_at).getTime(),
  }
}

export function surveyResponseFromRow(row: SurveyResponseRow): SurveyResponse {
  return {
    id: row.id, surveyId: row.survey_id, clientId: row.client_id,
    periodKey: row.period_key, answers: row.answers || {},
    submittedAt: new Date(row.submitted_at).getTime(),
  }
}
