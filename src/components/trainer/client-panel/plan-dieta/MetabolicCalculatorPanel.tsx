import { useState } from 'react'
import { ClientData } from '../../../../types'
import { Sex, Formula, ActivityLevel, Goal, ACTIVITY_LABELS, GOAL_LABELS, computeMetabolicPlan, ageFromBirthDate } from '../../../../lib/metabolicCalculator'
import { Button } from '../../../shared/Button'
import { CalcNumInput, MacroPreview } from './PlanInputs'
import { X } from 'lucide-react'

export function MetabolicCalculatorPanel({ client, onClose, onApply }: {
  client: ClientData
  onClose: () => void
  onApply: (result: { kcalTarget: number; proteinG: number; carbsG: number; fatG: number; fiberG: number }) => void
}) {
  const inferredSex: Sex = client.gender?.toLowerCase().includes('mujer') ? 'mujer' : 'hombre'
  const inferredAge = ageFromBirthDate(client.birthDate)
  const [formula, setFormula] = useState<Formula>('mifflin')
  const [sex, setSex] = useState<Sex>(inferredSex)
  const [weightKg, setWeightKg] = useState('')
  const [heightCm, setHeightCm] = useState(client.heightCm ? String(client.heightCm) : '')
  const [age, setAge] = useState(inferredAge != null ? String(inferredAge) : '')
  const [bodyFatPct, setBodyFatPct] = useState('')
  const [activity, setActivity] = useState<ActivityLevel>('moderado')
  const [goal, setGoal] = useState<Goal>('deficit')
  const [proteinGPerKg, setProteinGPerKg] = useState('2')
  const [fatGPerKg, setFatGPerKg] = useState('1')

  const result = computeMetabolicPlan({
    formula, sex, weightKg: parseFloat(weightKg), heightCm: parseFloat(heightCm), age: parseFloat(age),
    bodyFatPct: bodyFatPct ? parseFloat(bodyFatPct) : undefined,
    activity, goal, proteinGPerKg: parseFloat(proteinGPerKg) || 0, fatGPerKg: parseFloat(fatGPerKg) || 0,
  })

  return (
    <div className="bg-bg-alt rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Calculadora metabólica</p>
        <button onClick={onClose} className="p-1 text-muted hover:text-warn"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">Fórmula</label>
          <select value={formula} onChange={e => setFormula(e.target.value as Formula)}
            className="w-full px-2 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20">
            <option value="mifflin">Mifflin-St Jeor</option>
            <option value="harris">Harris-Benedict</option>
            <option value="katch">Katch-McArdle (% grasa)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">Sexo</label>
          <select value={sex} onChange={e => setSex(e.target.value as Sex)}
            className="w-full px-2 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20">
            <option value="hombre">Hombre</option>
            <option value="mujer">Mujer</option>
          </select>
        </div>
        <CalcNumInput label="Peso actual (kg)" value={weightKg} onChange={setWeightKg} />
        <CalcNumInput label="Altura (cm)" value={heightCm} onChange={setHeightCm} />
        <CalcNumInput label="Edad" value={age} onChange={setAge} />
        {formula === 'katch' && <CalcNumInput label="% grasa corporal" value={bodyFatPct} onChange={setBodyFatPct} />}
        <div className="col-span-2 sm:col-span-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">Actividad</label>
          <select value={activity} onChange={e => setActivity(e.target.value as ActivityLevel)}
            className="w-full px-2 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20">
            {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map(k => <option key={k} value={k}>{ACTIVITY_LABELS[k]}</option>)}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">Objetivo</label>
          <select value={goal} onChange={e => setGoal(e.target.value as Goal)}
            className="w-full px-2 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20">
            {(Object.keys(GOAL_LABELS) as Goal[]).map(k => <option key={k} value={k}>{GOAL_LABELS[k]}</option>)}
          </select>
        </div>
        <CalcNumInput label="Proteína (g/kg)" value={proteinGPerKg} onChange={setProteinGPerKg} />
        <CalcNumInput label="Grasas (g/kg)" value={fatGPerKg} onChange={setFatGPerKg} />
      </div>

      {result ? (
        <div className="pt-2 border-t border-border space-y-2">
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="text-muted">TMB <strong className="text-ink">{result.bmr}</strong> kcal</span>
            <span className="text-muted">Gasto total <strong className="text-ink">{result.tdee}</strong> kcal</span>
          </div>
          <div className="grid grid-cols-5 gap-2 text-center">
            <MacroPreview label="Kcal" value={result.kcalTarget} />
            <MacroPreview label="Prot." value={`${result.proteinG}g`} />
            <MacroPreview label="Carbos" value={`${result.carbsG}g`} />
            <MacroPreview label="Grasas" value={`${result.fatG}g`} />
            <MacroPreview label="Fibra" value={`${result.fiberG}g`} />
          </div>
          <Button size="sm" onClick={() => onApply(result)}>Aplicar al plan</Button>
        </div>
      ) : (
        <p className="text-xs text-muted pt-1">
          Rellena peso, altura y edad {formula === 'katch' ? '(y % de grasa corporal) ' : ''}para calcular.
        </p>
      )}
    </div>
  )
}
