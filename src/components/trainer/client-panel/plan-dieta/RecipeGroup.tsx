import { useState } from 'react'
import { RecipeRow } from '../../../../lib/supabase-types'
import { RecipePhotoUpload } from '../../../shared/RecipePhotoUpload'
import { EditableItem, sumItemMacros } from './planModel'
import { Trash2, Copy, ChefHat, ChevronUp, ChevronDown } from 'lucide-react'

export function RecipeGroup({ title, recipes, onDelete, onCopy, onSetPhoto, onEdit, nutricionistaId, demoMode }: {
  title: string; recipes: RecipeRow[]; onDelete?: (id: string) => void; onCopy?: (recipe: RecipeRow) => void
  onSetPhoto?: (recipe: RecipeRow, url: string) => void
  onEdit?: (recipe: RecipeRow) => void
  nutricionistaId?: string; demoMode?: boolean
}) {
  const [stepsOpenFor, setStepsOpenFor] = useState<string | null>(null)
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 flex items-center gap-1.5">
        <ChefHat className="w-3.5 h-3.5" /> {title} ({recipes.length})
      </p>
      <div className="space-y-1.5">
        {recipes.map(r => {
          const totals = sumItemMacros((r.items as EditableItem[] | null) || [])
          return (
            <div key={r.id} onClick={onEdit ? () => onEdit(r) : undefined}
              className={`bg-bg-alt rounded-xl px-3 py-2 ${onEdit ? 'cursor-pointer hover:bg-accent/5 transition-colors' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {onSetPhoto && nutricionistaId ? (
                    <div onClick={e => e.stopPropagation()}>
                      <RecipePhotoUpload nutricionistaId={nutricionistaId} currentUrl={r.photo_url} demoMode={demoMode}
                        onUploaded={url => onSetPhoto(r, url)} />
                    </div>
                  ) : r.photo_url ? (
                    <img src={r.photo_url} alt={r.name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{r.name}</p>
                    <p className="text-xs text-muted">
                      {Math.round(totals.kcal)} kcal · {Math.round(totals.proteinG * 10) / 10}g prot. · {Math.round(totals.carbsG * 10) / 10}g carbos · {Math.round(totals.fatG * 10) / 10}g grasas · {Math.round(totals.fiberG * 10) / 10}g fibra
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {r.steps && (
                    <button onClick={e => { e.stopPropagation(); setStepsOpenFor(stepsOpenFor === r.id ? null : r.id) }}
                      className="p-1 text-muted hover:text-accent" title="Ver pasos de preparación">
                      {stepsOpenFor === r.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  {onCopy && (
                    <button onClick={e => { e.stopPropagation(); onCopy(r) }} className="p-1 text-muted hover:text-accent" title="Copiar a mis recetas"><Copy className="w-3.5 h-3.5" /></button>
                  )}
                  {onDelete && (
                    <button onClick={e => { e.stopPropagation(); onDelete(r.id) }} className="p-1 text-muted hover:text-warn" title="Eliminar receta"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </div>
              {stepsOpenFor === r.id && r.steps && (
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">Preparación</p>
                  <p className="text-xs whitespace-pre-line">{r.steps}</p>
                </div>
              )}
              {onEdit && (
                <p className="text-xs text-accent mt-1.5">Toca para ver/editar la receta completa</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
