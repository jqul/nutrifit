import { useState } from 'react'
import { Modal } from '../../shared/Modal'
import { Button } from '../../shared/Button'
import { ReportOptions } from '../../../lib/printProgressReport'
import { PERIOD_LABEL, ReportPeriod } from '../../../lib/reportSummary'

const SECTION_INFO: { key: keyof ReportOptions['sections']; title: string; hint: string }[] = [
  { key: 'signals', title: 'Hábitos y señales', hint: 'Hambre, energía, ánimo y digestión del periodo, comparados con el anterior.' },
  { key: 'planChanges', title: 'Cambios en el plan', hint: 'Cambios de kcal y macros con el motivo que anotaste. Es material interno: inclúyelo solo si quieres que lo vea quien reciba el informe.' },
  { key: 'reviews', title: 'Mi valoración semanal', hint: 'Solo las valoraciones que escribiste tú con tus palabras, no las sugerencias aceptadas tal cual.' },
  { key: 'bloodMarkers', title: 'Analíticas recientes', hint: 'Las últimas lecturas con su estado.' },
  { key: 'notes', title: 'Observaciones y próximos objetivos', hint: 'El texto que escribes en la tarjeta de notas del informe.' },
]

const PERIODS: ReportPeriod[] = ['30d', '90d', 'all']

/** Elige el periodo y las secciones del informe de progreso antes de generarlo. */
export function ReportOptionsModal({ open, onClose, onGenerate, busy }: {
  open: boolean; onClose: () => void; onGenerate: (options: ReportOptions) => void; busy?: boolean
}) {
  const [period, setPeriod] = useState<ReportPeriod>('30d')
  // Lo interno (cambios del plan y valoraciones) empieza desmarcado: se incluye a propósito.
  const [sections, setSections] = useState<ReportOptions['sections']>({
    signals: true, planChanges: false, reviews: false, bloodMarkers: true, notes: true,
  })

  return (
    <Modal open={open} onClose={onClose} title="Generar informe de progreso">
      <div className="space-y-5">
        <fieldset>
          <legend className="text-sm font-semibold mb-2">Periodo</legend>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map(p => (
              <label key={p} className={`px-3 py-2 rounded-xl text-sm font-semibold cursor-pointer border transition-colors ${
                period === p ? 'bg-ink text-white border-ink' : 'border-border text-muted hover:text-ink'
              }`}>
                <input type="radio" name="report-period" value={p} checked={period === p} onChange={() => setPeriod(p)} className="sr-only" />
                {PERIOD_LABEL[p]}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted mt-2">El peso y la adherencia siempre van incluidos.</p>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold mb-2">Qué incluir</legend>
          <div className="space-y-3">
            {SECTION_INFO.map(s => (
              <label key={s.key} className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={sections[s.key]} onChange={e => setSections({ ...sections, [s.key]: e.target.checked })}
                  className="mt-1 w-4 h-4 accent-accent flex-shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{s.title}</span>
                  <span className="block text-xs text-muted">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex items-center gap-2 pt-1">
          <Button onClick={() => onGenerate({ period, sections })} loading={busy}>Generar PDF</Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  )
}
