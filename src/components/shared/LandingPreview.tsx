import { useMemo } from 'react'
import { withStats } from '../../hooks/useNutricionistaClients'
import { sortByAttention } from '../../lib/clientListSummary'
import { DEMO_CLIENTS, DEMO_CHECKINS, DEMO_INVOICES, DEMO_BLOOD_MARKERS, DEMO_SURVEY_RESPONSES, DEMO_WEIGHTS } from '../../lib/demo-data'
import { ClientListRow } from '../trainer/ClientListRow'

const noop = () => {}

/** Captura viva del producto bajo el hero de la landing (UX-36): la lista de
 * Clientes real, con los datos de la demo, dentro de un marco de ventana. No
 * es una imagen: usa el mismo componente que el panel, así nunca se queda
 * desfasada. Es decorativa (no interactiva) y se oculta a lectores de pantalla. */
export function LandingPreview() {
  const clients = useMemo(() => sortByAttention(
    withStats(DEMO_CLIENTS.filter(c => c.bajaAt == null), DEMO_CHECKINS, DEMO_INVOICES, DEMO_BLOOD_MARKERS, DEMO_SURVEY_RESPONSES, DEMO_WEIGHTS),
  ), [])

  return (
    <section className="max-w-4xl mx-auto px-6 pb-20 w-full">
      <div aria-hidden="true" className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden pointer-events-none select-none">
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-bg-alt/60">
          <span className="w-2.5 h-2.5 rounded-full bg-border" />
          <span className="w-2.5 h-2.5 rounded-full bg-border" />
          <span className="w-2.5 h-2.5 rounded-full bg-border" />
          <span className="ml-3 text-xs text-muted">Clientes</span>
        </div>
        <div className="divide-y divide-border/60">
          {clients.map((c, i) => (
            <ClientListRow key={c.id} client={c} isTopStreak={i === 0 && (c.streak || 0) > 0} onOpen={noop} onCopyLink={noop} />
          ))}
        </div>
      </div>
      <p className="text-sm text-muted text-center mt-5">
        Así ves a tus clientes: quién necesita atención, de un vistazo y sin abrir fichas.
      </p>
    </section>
  )
}
