import { CustomAnamnesisQuestion } from '../../types'
import { questionType } from '../../lib/questionTypes'

const SCALE = Array.from({ length: 10 }, (_, i) => i + 1)

/** Campo de respuesta para una pregunta propia, según su tipo — se usa
 * tanto en el cuestionario de salud como en las encuestas recurrentes.
 * El valor se guarda siempre como string (compatible con el
 * Record<string, string> de respuestas ya existente): la escala guarda el
 * número como texto, sí/no guarda "si"/"no", opción múltiple guarda la
 * opción elegida tal cual. */
export function QuestionInput({ question, value, onChange }: {
  question: CustomAnamnesisQuestion
  value: string
  onChange: (value: string) => void
}) {
  const type = questionType(question.type)

  if (type === 'scale') {
    return (
      <div className="flex gap-1 flex-wrap">
        {SCALE.map(n => (
          <button key={n} type="button" onClick={() => onChange(String(n))}
            className={`w-8 h-8 rounded-lg text-xs font-semibold border transition-all ${
              value === String(n) ? 'bg-accent text-white border-accent' : 'border-border text-muted hover:border-accent'
            }`}>
            {n}
          </button>
        ))}
      </div>
    )
  }

  if (type === 'yesno') {
    return (
      <div className="flex gap-2">
        {(['si', 'no'] as const).map(v => (
          <button key={v} type="button" onClick={() => onChange(v)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
              value === v ? 'bg-ink text-white border-ink' : 'border-border text-muted hover:border-accent'
            }`}>
            {v === 'si' ? 'Sí' : 'No'}
          </button>
        ))}
      </div>
    )
  }

  if (type === 'choice') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {(question.options || []).map(opt => (
          <button key={opt} type="button" onClick={() => onChange(opt)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              value === opt ? 'bg-ink text-white border-ink' : 'border-border text-muted hover:border-accent'
            }`}>
            {opt}
          </button>
        ))}
      </div>
    )
  }

  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={2}
      className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
  )
}
