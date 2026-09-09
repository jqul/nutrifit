import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { guideFromRow } from '../../lib/mappers'
import { Guide } from '../../types'
import { DEMO_GUIDES } from '../../lib/demo-data'
import { BottomSheet } from '../shared/BottomSheet'
import { BookOpen, ChevronRight } from 'lucide-react'

/**
 * Biblioteca de guías del nutricionista, dentro de "Más" — contenido fijo
 * que este nutricionista ha escrito para TODOS sus clientes (no hay
 * asignación por cliente, ver migración 0039_guides.sql), así que solo
 * hace falta el nutricionistaId, no el clientId.
 */
export function GuidesLibrary({ nutricionistaId, demoMode }: { nutricionistaId: string; demoMode?: boolean }) {
  const [guides, setGuides] = useState<Guide[]>(demoMode ? DEMO_GUIDES.map(guideFromRow) : [])
  const [loading, setLoading] = useState(!demoMode)
  const [open, setOpen] = useState(false)
  const [reading, setReading] = useState<Guide | null>(null)

  useEffect(() => {
    if (demoMode) return
    setLoading(true)
    supabase.from('guides').select('*').eq('nutricionista_id', nutricionistaId).order('sort_order').order('created_at')
      .then(({ data }) => { setGuides((data || []).map(guideFromRow)); setLoading(false) })
  }, [nutricionistaId, demoMode])

  if (!loading && guides.length === 0) return null

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="w-full bg-card border border-border rounded-2xl p-5 flex items-center justify-between gap-3 text-left hover:border-accent/50 transition-colors">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-accent flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">Guías y recursos</p>
            <p className="text-xs text-muted">{loading ? 'Cargando...' : `${guides.length} guía${guides.length === 1 ? '' : 's'} de tu nutricionista`}</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
      </button>

      <BottomSheet open={open} onClose={() => { setOpen(false); setReading(null) }}
        title={reading ? `${reading.emoji} ${reading.title}` : 'Guías y recursos'}>
        {reading ? (
          <div className="space-y-3">
            <button onClick={() => setReading(null)} className="text-xs font-bold text-accent">← Todas las guías</button>
            <p className="text-sm whitespace-pre-line leading-relaxed">{reading.body || 'Esta guía todavía no tiene contenido.'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {guides.map(g => (
              <button key={g.id} onClick={() => setReading(g)}
                className="w-full flex items-center gap-3 bg-bg-alt hover:bg-accent/10 rounded-xl p-3.5 text-left transition-colors">
                <span className="text-xl flex-shrink-0">{g.emoji}</span>
                <span className="text-sm font-semibold flex-1 min-w-0 truncate">{g.title}</span>
                <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </BottomSheet>
    </>
  )
}
