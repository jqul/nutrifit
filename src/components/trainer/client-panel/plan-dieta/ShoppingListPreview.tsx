import { useState } from 'react'
import { buildShoppingList } from '../../../../lib/shoppingList'
import { EditableMeal } from './planModel'
import { ShoppingCart, ChevronDown, ChevronUp, Check } from 'lucide-react'

export function ShoppingListPreview({ meals }: { meals: EditableMeal[] }) {
  const [open, setOpen] = useState(false)
  const items = buildShoppingList(meals)
  if (items.length === 0) return null
  return (
    <div className="card p-4">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between">
        <span className="font-semibold text-sm flex items-center gap-1.5">
          <ShoppingCart className="w-3.5 h-3.5" /> Lista de la compra ({items.length})
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted mb-2">Así es como la verá tu cliente en su panel.</p>
          <ul className="space-y-1">
            {items.map(item => {
              const qtyLabel = item.totalQty !== null ? `${item.totalQty}${item.unit ? ` ${item.unit}` : ''}` : item.parts.join(' + ')
              const fiberRounded = Math.round(item.fiberG * 10) / 10
              return (
                <li key={item.key} className="flex items-center gap-2 text-sm py-0.5">
                  <Check className="w-3 h-3 text-muted flex-shrink-0" />
                  <span className="flex-1">{item.foodName}</span>
                  {fiberRounded > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${fiberRounded >= 5 ? 'bg-ok/10 text-ok font-semibold' : 'bg-bg-alt text-muted'}`}>
                      {fiberRounded}g fibra
                    </span>
                  )}
                  <span className="text-xs text-muted">{qtyLabel}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
