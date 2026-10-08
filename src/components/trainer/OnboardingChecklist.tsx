import { CheckCircle2, Circle, ChevronRight } from 'lucide-react'
import { OnboardingStep, OnboardingStepId, nextOnboardingStep, onboardingProgress } from '../../lib/onboarding'

/**
 * "Empieza en 3 minutos": los primeros pasos tras registrarse. Se calcula de lo que el nutricionista ya ha hecho y
 * desaparece solo cuando están todos; el botón lleva al primer paso que falta.
 */
export function OnboardingChecklist({ steps, onAction }: { steps: OnboardingStep[]; onAction: (id: OnboardingStepId) => void }) {
  const progress = onboardingProgress(steps)
  const next = nextOnboardingStep(steps)
  if (progress.complete || !next) return null

  return (
    <section aria-labelledby="onboarding-title" className="card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="onboarding-title" className="font-serif font-bold text-lg">Empieza en 3 minutos</h2>
        <p className="text-xs font-semibold text-muted">{progress.done} de {progress.total}</p>
      </div>
      <div className="h-1.5 rounded-full bg-bg-alt overflow-hidden mt-3" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso de los primeros pasos">
        <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progress.percent}%` }} />
      </div>
      <ol className="mt-4 space-y-1">
        {steps.map(step => {
          const isNext = step.id === next.id
          return (
            <li key={step.id}>
              <button type="button" onClick={() => onAction(step.id)} disabled={step.done}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                  isNext ? 'bg-accent/10 hover:bg-accent/15' : step.done ? '' : 'hover:bg-bg-alt/60'}`}>
                {step.done
                  ? <CheckCircle2 className="w-5 h-5 text-ok flex-shrink-0" aria-label="Hecho" />
                  : <Circle className="w-5 h-5 text-muted flex-shrink-0" aria-label="Pendiente" />}
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${step.done ? 'text-muted line-through' : ''}`}>{step.title}</span>
                  {!step.done && <span className="block text-xs text-muted">{step.hint}</span>}
                </span>
                {isNext && <span className="flex items-center gap-0.5 text-xs font-bold text-accent flex-shrink-0">Hacer <ChevronRight className="w-4 h-4" /></span>}
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
