import { supabase } from './supabase'
import { ClientData } from '../types'

export async function exportClientData(client: ClientData): Promise<void> {
  const [{ data: plans }, { data: weights }, { data: photos }, { data: checkins }] = await Promise.all([
    supabase.from('diet_plans').select('*').eq('client_id', client.id),
    supabase.from('weight_logs').select('*').eq('client_id', client.id).order('date'),
    supabase.from('progress_photos').select('*').eq('client_id', client.id).order('date'),
    supabase.from('daily_checkins').select('*').eq('client_id', client.id).order('date'),
  ])

  const planIds = (plans || []).map(p => p.id)
  let meals: unknown[] = []
  let supplements: unknown[] = []
  if (planIds.length) {
    const [{ data: mealRows }, { data: supRows }] = await Promise.all([
      supabase.from('diet_meals').select('*').in('plan_id', planIds),
      supabase.from('diet_supplements').select('*').in('plan_id', planIds),
    ])
    meals = mealRows || []
    supplements = supRows || []
    const mealIds = meals.map((m) => (m as { id: string }).id)
    if (mealIds.length) {
      const { data: itemRows } = await supabase.from('diet_meal_items').select('*').in('meal_id', mealIds)
      meals = meals.map(m => ({ ...(m as object), items: (itemRows || []).filter((i) => i.meal_id === (m as { id: string }).id) }))
    }
  }

  const bundle = {
    exportedAt: new Date().toISOString(),
    client,
    dietPlans: (plans || []).map(p => ({
      ...p,
      meals: meals.filter((m) => (m as { plan_id: string }).plan_id === p.id),
      supplements: supplements.filter((s) => (s as { plan_id: string }).plan_id === p.id),
    })),
    weightLogs: weights || [],
    progressPhotos: photos || [],
    dailyCheckins: checkins || [],
  }

  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `nutrifit-${client.name}-${client.surname}-datos.json`.replace(/\s+/g, '-').toLowerCase()
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
