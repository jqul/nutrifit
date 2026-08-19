import { useState } from 'react'
import { CustomAnamnesisQuestion, SurveyQuestionType } from '../../types'
import { QUESTION_TYPE_LABELS, QUESTION_TYPE_ICONS, questionType } from '../../lib/questionTypes'
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'

function newId() { return crypto.randomUUID() }

const TYPES: SurveyQuestionType[] = ['scale', 'yesno', 'text', 'choice']

/** Constructor de preguntas propias (tipo PanelFit): elige el tipo al
 * añadir cada pregunta — escala 1-10, sí/no, texto libre u opción múltiple
 * con tus propias opciones — en vez de solo texto libre. Se usa tanto para
 * el cuestionario de salud (preguntas propias) como para las encuestas
 * recurrentes. */
export function QuestionEditor({ questions, onChange }: {
  questions: CustomAnamnesisQuestion[]
  onChange: (questions: CustomAnamnesisQuestion[]) => void
}) {
  const addQuestion = (type: SurveyQuestionType) => {
    onChange([...questions, {
      id: newId(), type, required: false,
      label: type === 'scale' ? 'Nueva pregunta (1-10)' : type === 'yesno' ? 'Nueva pregunta (Sí/No)'
        : type === 'choice' ? 'Nueva pregunta de opción' : 'Nueva pregunta abierta',
      options: type === 'choice' ? ['Opción A', 'Opción B'] : undefined,
    }])
  }
  const updateQ = (id: string, updates: Partial<CustomAnamnesisQuestion>) =>
    onChange(questions.map(q => q.id === id ? { ...q, ...updates } : q))
  const deleteQ = (id: string) => onChange(questions.filter(q => q.id !== id))
  const moveQ = (id: string, dir: -1 | 1) => {
    const idx = questions.findIndex(q => q.id === id)
    if (idx + dir < 0 || idx + dir >= questions.length) return
    const qs = [...questions]
    ;[qs[idx], qs[idx + dir]] = [qs[idx + dir], qs[idx]]
    onChange(qs)
  }

  return (
    <div className="space-y-2">
      {questions.map((q, i) => (
        <QuestionRow key={q.id} question={q} index={i} total={questions.length}
          onUpdate={updates => updateQ(q.id, updates)} onDelete={() => deleteQ(q.id)} onMove={dir => moveQ(q.id, dir)} />
      ))}
      <div className="flex gap-2 flex-wrap">
        {TYPES.map(type => (
          <button key={type} type="button" onClick={() => addQuestion(type)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-border rounded-lg text-xs text-muted hover:border-accent hover:text-accent transition-colors">
            <Plus className="w-3 h-3" /> {QUESTION_TYPE_ICONS[type]} {QUESTION_TYPE_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  )
}

function QuestionRow({ question, index, total, onUpdate, onDelete, onMove }: {
  question: CustomAnamnesisQuestion; index: number; total: number
  onUpdate: (updates: Partial<CustomAnamnesisQuestion>) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const type = questionType(question.type)
  const [optionDraft, setOptionDraft] = useState('')
  return (
    <div className="bg-bg-alt rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm flex-shrink-0">{QUESTION_TYPE_ICONS[type]}</span>
        <input value={question.label} onChange={e => onUpdate({ label: e.target.value })}
          className="flex-1 text-sm bg-transparent outline-none font-medium min-w-0" />
        <div className="flex items-center gap-1 flex-shrink-0">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="p-1 text-muted disabled:opacity-30 hover:text-ink">
            <ChevronUp className="w-3 h-3" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="p-1 text-muted disabled:opacity-30 hover:text-ink">
            <ChevronDown className="w-3 h-3" />
          </button>
          <button type="button" onClick={() => onUpdate({ required: !question.required })}
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${question.required ? 'bg-accent text-white border-accent' : 'border-border text-muted'}`}>
            {question.required ? 'OBLIG.' : 'OPC.'}
          </button>
          <button type="button" onClick={onDelete} className="p-1 text-muted hover:text-warn"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>
      {type === 'choice' && (
        <div className="flex flex-wrap gap-1.5 pl-6">
          {(question.options || []).map((opt, oi) => (
            <div key={oi} className="flex items-center gap-1 bg-bg-alt border border-border rounded-lg">
              <input value={opt}
                onChange={e => {
                  const opts = [...(question.options || [])]; opts[oi] = e.target.value; onUpdate({ options: opts })
                }}
                className="px-2 py-1 bg-transparent text-xs outline-none w-24" />
              <button type="button" onClick={() => onUpdate({ options: (question.options || []).filter((_, x) => x !== oi) })}
                className="pr-1.5 text-muted hover:text-warn"><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
          <input value={optionDraft} onChange={e => setOptionDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && optionDraft.trim()) {
                onUpdate({ options: [...(question.options || []), optionDraft.trim()] }); setOptionDraft('')
              }
            }}
            placeholder="+ Añadir opción"
            className="px-2 py-1 border border-dashed border-border rounded-lg text-xs outline-none w-28 text-muted focus:border-accent" />
        </div>
      )}
      <p className="text-[10px] text-muted pl-6">{QUESTION_TYPE_LABELS[type]}</p>
    </div>
  )
}
