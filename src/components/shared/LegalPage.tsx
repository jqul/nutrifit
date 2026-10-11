import { LEGAL_REVIEWED } from '../../legal/entity'
import { LEGAL_DOCUMENTS, LegalSlug, fillTemplate, pendingItems } from '../../legal/documents'
import { MarkdownArticle } from './MarkdownArticle'
import { ArrowLeft, AlertTriangle } from 'lucide-react'

/** Un texto legal (privacidad, condiciones, contrato de encargado…) a pantalla completa, con la lista de los demás. */
export function LegalPage({ slug }: { slug: LegalSlug }) {
  const doc = LEGAL_DOCUMENTS.find(d => d.slug === slug) ?? LEGAL_DOCUMENTS[0]
  const text = fillTemplate(doc.raw)
  const pending = pendingItems(text)
  const isDraft = !LEGAL_REVIEWED || pending.length > 0

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-bg/90 backdrop-blur-sm sticky top-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="w-4 h-4" /> Volver</a>
          <span className="text-lg font-serif font-bold">Nutri<span className="text-accent italic">Fit</span></span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 space-y-4">
        {isDraft && (
          <div role="note" className="flex gap-3 rounded-xl border border-notice/40 bg-notice/10 px-4 py-3 text-sm">
            <AlertTriangle className="w-5 h-5 text-notice flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Borrador pendiente de revisión legal</p>
              <p className="text-muted text-xs mt-0.5">
                Este texto aún no está revisado por un profesional ni tiene todos los datos del titular
                {pending.length > 0 && <> (faltan {pending.length}: {pending.slice(0, 4).join(' · ')}{pending.length > 4 ? ' · …' : ''})</>}.
                No lo publiques ni lo des por válido hasta entonces.
              </p>
            </div>
          </div>
        )}

        <MarkdownArticle source={text} />

        <nav aria-label="Otros textos legales" className="border-t border-border pt-5 mt-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Otros textos</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
            {LEGAL_DOCUMENTS.filter(d => d.slug !== doc.slug).map(d => (
              <li key={d.slug}><a href={`/?legal=${d.slug}`} className="text-accent underline underline-offset-2">{d.title}</a></li>
            ))}
          </ul>
        </nav>
      </main>
    </div>
  )
}
