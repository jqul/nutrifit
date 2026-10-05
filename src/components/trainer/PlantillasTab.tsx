import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Food } from '../../types'
import { foodFromRow } from '../../lib/mappers'
import { FoodConverterDrawer } from './FoodConverterDrawer'
import { GuidesManager } from './GuidesManager'
import { EatingOutGuidesManager } from './EatingOutGuidesManager'
import { PlanTemplatesPanel } from './plantillas/PlanTemplatesPanel'
import { RecipesPanel } from './plantillas/RecipesPanel'
import { BookmarkPlus } from 'lucide-react'

type Section = 'planes' | 'recetas' | 'guias'
const SECTIONS: { id: Section; label: string; hint: string }[] = [
  { id: 'planes', label: 'Planes', hint: 'Planes de dieta completos. Créalos aquí o desde el plan de cualquier cliente con "Guardar como plantilla", y aplícalos al plan de cualquier otro cliente.' },
  { id: 'recetas', label: 'Recetas', hint: 'Platos reutilizables con foto y pasos. Créalos aquí o desde un plan con "Guardar esta comida como receta", y añádelos a cualquier plan.' },
  { id: 'guias', label: 'Guías', hint: 'Contenido fijo que ven todos tus clientes: guías de apoyo y pautas para cuando comen fuera de casa.' },
]

/** Plantillas y recursos: tres secciones (planes, recetas, guías) en vez de
 * una sola pantalla larga. Todas se quedan montadas y solo se ocultan con CSS
 * para no perder un editor a medio rellenar al cambiar de sección. */
export function PlantillasTab({ nutricionistaId, demoMode }: { nutricionistaId: string; demoMode?: boolean }) {
  const [section, setSection] = useState<Section>('planes')
  const [foods, setFoods] = useState<Food[]>([])

  useEffect(() => {
    supabase.from('foods').select('*').order('name').then(({ data }) => setFoods((data || []).map(foodFromRow)))
  }, [])

  const current = SECTIONS.find(s => s.id === section)!

  return (
    <div className="max-w-2xl space-y-6">
      <FoodConverterDrawer nutricionistaId={nutricionistaId} demoMode={demoMode} />
      <div>
        <div className="flex items-center gap-2 mb-2">
          <BookmarkPlus className="w-5 h-5 text-accent" />
          <h1 className="text-2xl font-serif font-bold">Plantillas y recursos</h1>
        </div>
        <div role="tablist" aria-label="Plantillas y recursos" className="flex gap-1 border-b border-border">
          {SECTIONS.map(s => (
            <button key={s.id} role="tab" aria-selected={section === s.id} onClick={() => setSection(s.id)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                section === s.id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}>
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted mt-3">{current.hint}</p>
      </div>

      <div role="tabpanel" className={section === 'planes' ? '' : 'hidden'}>
        <PlanTemplatesPanel nutricionistaId={nutricionistaId} demoMode={demoMode} foods={foods} />
      </div>
      <div role="tabpanel" className={section === 'recetas' ? '' : 'hidden'}>
        <RecipesPanel nutricionistaId={nutricionistaId} demoMode={demoMode} foods={foods} />
      </div>
      <div role="tabpanel" className={section === 'guias' ? 'space-y-8' : 'hidden'}>
        <GuidesManager nutricionistaId={nutricionistaId} demoMode={demoMode} />
        <EatingOutGuidesManager nutricionistaId={nutricionistaId} demoMode={demoMode} />
      </div>
    </div>
  )
}
