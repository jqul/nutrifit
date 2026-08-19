import { CustomAnamnesisQuestion } from '../../types'
import { questionType } from '../../lib/questionTypes'

/** Muestra la respuesta a una pregunta propia según su tipo, para las
 * vistas de solo lectura del nutricionista (historial de encuestas,
 * cuestionario de salud del cliente). */
export function QuestionAnswerDisplay({ question, value }: { question: CustomAnamnesisQuestion; value: string }) {
  const type = questionType(question.type)

  if (type === 'scale') {
    const n = parseInt(value, 10)
    if (isNaN(n)) return <p className="text-sm">{value}</p>
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-bg-alt rounded-full h-2 overflow-hidden max-w-[160px]">
          <div className="h-full rounded-full bg-accent" style={{ width: `${(n / 10) * 100}%` }} />
        </div>
        <span className="text-sm font-bold text-accent">{n}/10</span>
      </div>
    )
  }

  if (type === 'yesno') {
    const isYes = value === 'si'
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${isYes ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn'}`}>
        {isYes ? '✓ Sí' : '✗ No'}
      </span>
    )
  }

  if (type === 'choice') {
    return <p className="text-sm font-semibold">{value}</p>
  }

  return <p className="text-sm">{value}</p>
}
