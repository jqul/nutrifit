import { useState } from 'react'
import { GOAL_LABELS, GOAL_OPTIONS } from '../../lib/constants'
import { PresetGoal } from '../../types'

const CUSTOM = '__custom__'

export function GoalSelect({ value, onChange, surface = 'bg' }: {
  value: string
  onChange: (v: string) => void
  surface?: 'bg' | 'card'
}) {
  const isPreset = value === '' || (GOAL_OPTIONS as string[]).includes(value)
  const [showCustom, setShowCustom] = useState(!isPreset)
  const bgClass = surface === 'card' ? 'bg-card' : 'bg-bg'

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Objetivo</label>
      {showCustom ? (
        <div className="flex gap-2">
          <input value={value} onChange={e => onChange(e.target.value)} placeholder="Escribe el objetivo" autoFocus
            className={`flex-1 px-3 py-2.5 ${bgClass} border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm`} />
          <button type="button" onClick={() => { setShowCustom(false); onChange('') }}
            className="px-2 text-xs text-muted hover:text-ink whitespace-nowrap">Elegir de la lista</button>
        </div>
      ) : (
        <select value={value} onChange={e => {
          if (e.target.value === CUSTOM) { setShowCustom(true); onChange('') }
          else onChange(e.target.value)
        }} className={`w-full px-3 py-2.5 ${bgClass} border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm`}>
          <option value="">Sin especificar</option>
          {GOAL_OPTIONS.map((g: PresetGoal) => <option key={g} value={g}>{GOAL_LABELS[g]}</option>)}
          <option value={CUSTOM}>Otro (especificar)</option>
        </select>
      )}
    </div>
  )
}
