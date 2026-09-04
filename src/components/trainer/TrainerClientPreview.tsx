import { useState, useEffect } from 'react'
import { ClientData, UserProfile, DietPlan, WeightEntry, DailyCheckin, ProgressPhotoSession, MealLog, ClinicalNote } from '../../types'
import { BloodMarkerRow, RecipeRow, DietMealRow, DietMealItemRow, DietSupplementRow } from '../../lib/supabase-types'
import { supabase } from '../../lib/supabase'
import {
  weightFromRow, checkinFromRow, photoSessionFromRow, mealLogFromRow, clinicalNoteFromRow, dietPlanFromRows,
} from '../../lib/mappers'
import { ClientAppShell } from '../client/ClientAppShell'
import {
  DEMO_DIET_PLANS, DEMO_WEIGHTS, DEMO_CHECKINS, DEMO_PHOTOS, DEMO_MEAL_LOGS, DEMO_BLOOD_MARKERS, DEMO_CLINICAL_NOTES, DEMO_RECIPES,
} from '../../lib/demo-data'
import { X, Smartphone } from 'lucide-react'

interface PreviewData {
  plan: DietPlan | null
  recipes: RecipeRow[]
  weights: WeightEntry[]
  checkins: DailyCheckin[]
  photos: ProgressPhotoSession[]
  mealLogs: MealLog[]
  bloodMarkers: BloodMarkerRow[]
  clinicalNotes: ClinicalNote[]
}

/**
 * Vista previa "como la ve el cliente": el nutricionista abre la app del
 * cliente tal cual, con los datos REALES de ese cliente, pero montada a
 * través del mismo mecanismo de solo-lectura que el modo demo (demoMode +
 * demoData) — así cada tab (Hoy/Dieta/Progreso) sigue funcionando sin
 * tocar ni un solo permiso RLS ni auditar cada escritura una por una:
 * cualquier intento de guardar algo cae en la rama "modo demo: los
 * cambios no se guardan" que esos componentes ya tienen.
 */
export function TrainerClientPreview({ client, userProfile, demoMode, onClose }: {
  client: ClientData
  userProfile: UserProfile
  // Si el propio panel del nutricionista está en modo demo (cliente ficticio,
  // id no es un UUID real), la vista previa reutiliza los mismos datos de
  // demo en vez de intentar consultar Supabase con un id inventado.
  demoMode?: boolean
  onClose: () => void
}) {
  const [data, setData] = useState<PreviewData | null>(demoMode ? {
    plan: DEMO_DIET_PLANS[client.id] ?? null,
    recipes: DEMO_RECIPES,
    weights: DEMO_WEIGHTS[client.id] || [],
    checkins: DEMO_CHECKINS[client.id] || [],
    photos: DEMO_PHOTOS[client.id] || [],
    mealLogs: DEMO_MEAL_LOGS[client.id] || [],
    bloodMarkers: DEMO_BLOOD_MARKERS[client.id] || [],
    clinicalNotes: DEMO_CLINICAL_NOTES[client.id] || [],
  } : null)

  useEffect(() => {
    if (demoMode) return
    (async () => {
      const [{ data: planRow }, { data: w }, { data: c }, { data: p }, { data: m }, { data: bm }, { data: cn }, { data: recipeRows }] = await Promise.all([
        supabase.from('diet_plans').select('*').eq('client_id', client.id).eq('is_active', true).maybeSingle(),
        supabase.from('weight_logs').select('*').eq('client_id', client.id).order('date'),
        supabase.from('daily_checkins').select('*').eq('client_id', client.id),
        supabase.from('progress_photos').select('*').eq('client_id', client.id).order('date', { ascending: false }),
        supabase.from('meal_logs').select('*').eq('client_id', client.id).order('created_at', { ascending: false }),
        supabase.from('blood_markers').select('*').eq('client_id', client.id).order('date', { ascending: false }),
        supabase.from('client_clinical_notes').select('*').eq('client_id', client.id).order('date', { ascending: false }),
        // Todas las recetas visibles para este nutricionista (propias + del
        // sistema) — el propio DietaClienteTab filtra luego por las que de
        // verdad usa el plan, igual que hace con demoRecipes en la demo.
        supabase.from('recipes').select('*'),
      ])

      let plan: DietPlan | null = null
      if (planRow) {
        const [{ data: mealRows }, { data: supRows }] = await Promise.all([
          supabase.from('diet_meals').select('*').eq('plan_id', planRow.id).order('sort_order'),
          supabase.from('diet_supplements').select('*').eq('plan_id', planRow.id),
        ])
        let itemRows: DietMealItemRow[] = []
        if (mealRows?.length) {
          const { data: items } = await supabase.from('diet_meal_items').select('*').in('meal_id', mealRows.map((mm: DietMealRow) => mm.id)).order('sort_order')
          itemRows = items || []
        }
        plan = dietPlanFromRows(planRow, mealRows || [], itemRows, (supRows || []) as DietSupplementRow[])
      }

      setData({
        plan, recipes: recipeRows || [],
        weights: (w || []).map(weightFromRow),
        checkins: (c || []).map(checkinFromRow),
        photos: (p || []).map(photoSessionFromRow),
        mealLogs: (m || []).map(mealLogFromRow),
        bloodMarkers: bm || [],
        clinicalNotes: (cn || []).map(clinicalNoteFromRow),
      })
    })()
  }, [client.id, demoMode])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="bg-ink text-white px-4 py-2 flex items-center justify-between text-xs z-30 flex-shrink-0 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-ok animate-pulse" />
          <span className="font-semibold flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> Modo Cliente: {client.name} {client.surname}</span>
        </div>
        <button onClick={onClose}
          className="px-2.5 py-1 rounded bg-white/20 hover:bg-white/30 text-white font-medium transition-colors flex items-center gap-1">
          <X className="w-3.5 h-3.5" />
          <span>Volver a Nutricionista</span>
        </button>
      </div>

      <div className="flex-1 min-h-0">
        {!data ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
            </div>
          </div>
        ) : (
          <ClientAppShell
            clientData={client}
            demoMode
            previewMode
            bannerText={`Estás viendo la app tal y como la ve ${client.name} — los cambios no se guardan.`}
            nutricionistaName={userProfile.displayName}
            logoUrl={userProfile.logoUrl}
            accentColor={userProfile.accentColor}
            contactPhone={userProfile.contactPhone}
            demoPlan={data.plan}
            demoRecipes={data.recipes}
            demoData={{
              weights: data.weights, checkins: data.checkins, photos: data.photos, mealLogs: data.mealLogs,
              bloodMarkers: data.bloodMarkers, clinicalNotes: data.clinicalNotes,
            }}
          />
        )}
      </div>
    </div>
  )
}
