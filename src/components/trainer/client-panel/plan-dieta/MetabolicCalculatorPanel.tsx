import { useState } from 'react'
import { ClientData } from '../../../../types'
import {
  Sex, Formula, ActivityLevel, Goal, ACTIVITY_LABELS, GOAL_LABELS, calculateMetabolicPlan, ageFromBirthDate, sexFromGender,
} from '../../../../lib/metabolicCalculator'
import { ReproductiveCheck, ReproductiveStatus, SignalCode, reproductiveStatusFromAnswer } from '../../../../lib/planSafety'
import { ProfessionalConfirmation } from '../../../shared/ProfessionalConfirmation'
import { Button } from '../../../shared/Button'
import { PlanSignalList } from '../../../shared/PlanSignalList'
import { CalcNumInput, MacroPreview } from './PlanInputs'
import { X } from 'lucide-react'

// Mientras faltan datos numéricos no se pintan como errores: se enseña el aviso de siempre («rellena peso, altura y edad…»).
const MISSING_DATA: SignalCode[] = ['PESO_AUSENTE', 'ALTURA_AUSENTE', 'EDAD_AUSENTE', 'GRASA_AUSENTE']

export function MetabolicCalculatorPanel({ client, onClose, onApply, reproductiveAnswer, reproductiveCheck }: {
  client: ClientData
  onClose: () => void
  onApply: (result: { kcalTarget: number; proteinG: number; carbsG: number; fatG: number; fiberG: number }) => void
  /** Respuesta del cuestionario de salud sobre embarazo/lactancia (si la hay): la selección de abajo parte de ella. */
  reproductiveAnswer?: string
  /** Estado de la lectura del cuestionario (cargando / leído / error). Si no se pudo leer y no eliges el estado a mano, se señala. */
  reproductiveCheck?: ReproductiveCheck
}) {
  // El sexo NO se asume: solo se rellena si la ficha lo dice con claridad; si no, hay que elegirlo.
  const [formula, setFormula] = useState<Formula>('mifflin')
  const [sex, setSex] = useState<Sex | ''>(sexFromGender(client.gender) ?? '')
  const [weightKg, setWeightKg] = useState('')
  const [heightCm, setHeightCm] = useState(client.heightCm ? String(client.heightCm) : '')
  const inferredAge = ageFromBirthDate(client.birthDate)
  const [age, setAge] = useState(inferredAge != null ? String(inferredAge) : '')
  const [bodyFatPct, setBodyFatPct] = useState('')
  const [activity, setActivity] = useState<ActivityLevel>('moderado')
  const [goal, setGoal] = useState<Goal>('deficit')
  const [proteinGPerKg, setProteinGPerKg] = useState('2')
  const [fatGPerKg, setFatGPerKg] = useState('1')
  const [reproductive, setReproductive] = useState<ReproductiveStatus>(reproductiveStatusFromAnswer(reproductiveAnswer))
  // La confirmación del profesional vale para el resultado que tenía delante: si cambian los datos, hay que volver a confirmarla.
  const [confirmedFor, setConfirmedFor] = useState<string | null>(null)

  const outcome = calculateMetabolicPlan({
    formula, sex: sex || null, weightKg: parseFloat(weightKg), heightCm: parseFloat(heightCm), age: parseFloat(age), birthDate: client.birthDate,
    bodyFatPct: bodyFatPct ? parseFloat(bodyFatPct) : undefined,
    activity, goal, proteinGPerKg: parseFloat(proteinGPerKg) || 0, fatGPerKg: parseFloat(fatGPerKg) || 0,
    reproductiveStatus: reproductive,
    // Solo se señala la falta de comprobación si el profesional no ha indicado el estado a mano.
    reproductiveCheck: reproductive === 'no_consta' ? reproductiveCheck : undefined,
  })
  const { energy, plan, evaluation } = outcome

  const missingNumbers = !weightKg || !heightCm || !age || (formula === 'katch' && !bodyFatPct)
  const signals = missingNumbers ? evaluation.signals.filter(s => !MISSING_DATA.includes(s.code)) : evaluation.signals
  const signature = plan ? `${plan.kcalTarget}|${plan.proteinG}|${plan.carbsG}|${plan.fatG}|${evaluation.signals.map(s => s.code).join(',')}` : null
  const needsConfirmation = !!plan && evaluation.needsProfessionalReview
  const confirmed = confirmedFor != null && confirmedFor === signature
  const canApply = !!plan && (!needsConfirmation || confirmed)

  const select = 'w-full px-2 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20'
  const label = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1'

  return (
    <div className="bg-bg-alt rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Calculadora metabólica</p>
        <button onClick={onClose} aria-label="Cerrar la calculadora" className="p-1 text-muted hover:text-warn"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div>
          <label htmlFor="calc-formula" className={label}>Fórmula</label>
          <select id="calc-formula" value={formula} onChange={e => setFormula(e.target.value as Formula)} className={select}>
            <option value="mifflin">Mifflin-St Jeor</option>
            <option value="harris">Harris-Benedict</option>
            <option value="katch">Katch-McArdle (% grasa)</option>
          </select>
        </div>
        <div>
          <label htmlFor="calc-sexo" className={label}>Sexo</label>
          <select id="calc-sexo" value={sex} onChange={e => setSex(e.target.value as Sex | '')} className={select}>
            <option value="">Sin indicar</option>
            <option value="hombre">Hombre</option>
            <option value="mujer">Mujer</option>
          </select>
        </div>
        <CalcNumInput label="Peso actual (kg)" value={weightKg} onChange={setWeightKg} />
        <CalcNumInput label="Altura (cm)" value={heightCm} onChange={setHeightCm} />
        <CalcNumInput label="Edad" value={age} onChange={setAge} />
        {formula === 'katch' && <CalcNumInput label="% grasa corporal" value={bodyFatPct} onChange={setBodyFatPct} />}
        <div className="col-span-2 sm:col-span-3">
          <label htmlFor="calc-actividad" className={label}>Actividad</label>
          <select id="calc-actividad" value={activity} onChange={e => setActivity(e.target.value as ActivityLevel)} className={select}>
            {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map(k => <option key={k} value={k}>{ACTIVITY_LABELS[k]}</option>)}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <label htmlFor="calc-objetivo" className={label}>Objetivo</label>
          <select id="calc-objetivo" value={goal} onChange={e => setGoal(e.target.value as Goal)} className={select}>
            {(Object.keys(GOAL_LABELS) as Goal[]).map(k => <option key={k} value={k}>{GOAL_LABELS[k]}</option>)}
          </select>
        </div>
        <CalcNumInput label="Proteína (g/kg)" value={proteinGPerKg} onChange={setProteinGPerKg} />
        <CalcNumInput label="Grasas (g/kg)" value={fatGPerKg} onChange={setFatGPerKg} />
        <div>
          <label htmlFor="calc-gestacion" className={label}>Embarazo / lactancia</label>
          <select id="calc-gestacion" value={reproductive} onChange={e => setReproductive(e.target.value as ReproductiveStatus)} className={select}>
            <option value="no_consta">No consta</option>
            <option value="ninguno">No</option>
            <option value="embarazo">Embarazo</option>
            <option value="lactancia">Lactancia</option>
          </select>
        </div>
      </div>

      <PlanSignalList signals={signals} showInfo />

      {missingNumbers && (
        <p className="text-xs text-muted pt-1">
          Rellena peso, altura y edad {formula === 'katch' ? '(y % de grasa corporal) ' : ''}para calcular.
        </p>
      )}

      {energy && !plan && !missingNumbers && (
        <div className="pt-2 border-t border-border space-y-1">
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="text-muted">TMB estimada <strong className="text-ink">{energy.bmr}</strong> kcal</span>
            <span className="text-muted">Gasto total estimado <strong className="text-ink">{energy.tdee}</strong> kcal</span>
            <span className="text-muted">Objetivo <strong className="text-ink">{energy.kcalTarget}</strong> kcal</span>
          </div>
          <p className="text-xs text-muted">Este reparto no es válido tal como está: no se muestra ni se puede aplicar.</p>
        </div>
      )}

      {plan && (
        <div className="pt-2 border-t border-border space-y-2">
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="text-muted">TMB estimada <strong className="text-ink">{plan.bmr}</strong> kcal</span>
            <span className="text-muted">Gasto total estimado <strong className="text-ink">{plan.tdee}</strong> kcal</span>
          </div>
          <div className="grid grid-cols-5 gap-2 text-center">
            <MacroPreview label="Kcal" value={plan.kcalTarget} />
            <MacroPreview label="Prot." value={`${plan.proteinG}g`} />
            <MacroPreview label="Carbos" value={`${plan.carbsG}g`} />
            <MacroPreview label="Grasas" value={`${plan.fatG}g`} />
            <MacroPreview label="Fibra" value={`${plan.fiberG}g`} />
          </div>
          <p className="text-xs text-muted">Son estimaciones con un margen de error en cada persona: un punto de partida que validas tú, no una medición.</p>
          {needsConfirmation && <ProfessionalConfirmation checked={confirmed} onChange={c => setConfirmedFor(c ? signature : null)} />}
          <Button size="sm" disabled={!canApply} onClick={() => onApply(plan)}>Aplicar al plan</Button>
        </div>
      )}
    </div>
  )
}
