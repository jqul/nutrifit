import { useState } from 'react'
import { ArrowRight, Check, ChevronDown } from 'lucide-react'
import { InstallAppButton } from './InstallAppButton'
import { LandingPreview } from './LandingPreview'
import { LegalLinks } from './LegalLinks'
import { FAQ, FEATURE_GROUPS, FINAL_CTA, HERO, PAINS, STEPS } from '../../landing/content'

/**
 * La página de presentación (lo primero que ve un nutricionista que llega a la web). Cuenta el problema, cómo se resuelve
 * y qué incluye, y lleva a lo único que importa: ver la demo o solicitar acceso. Los textos están en src/landing/content.ts.
 */
export function Landing({ onDemo, onLogin, onRegister }: { onDemo?: () => void; onLogin: () => void; onRegister: () => void }) {
  const [groupId, setGroupId] = useState(FEATURE_GROUPS[0].id)
  const group = FEATURE_GROUPS.find(g => g.id === groupId) ?? FEATURE_GROUPS[0]

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <nav className="border-b border-border bg-bg/90 backdrop-blur-sm sticky top-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-serif font-bold">Nutri<span className="text-accent italic">Fit</span></span>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block"><InstallAppButton variant="link" /></div>
            {onDemo && <button onClick={onDemo} className="hidden sm:block px-3 py-2 text-sm text-muted hover:text-ink transition-colors">Ver demo</button>}
            <button onClick={onLogin} className="px-4 py-2 text-sm font-medium text-muted hover:text-ink transition-colors">Entrar →</button>
            <button onClick={onRegister} className="px-4 py-2 bg-ink text-white rounded-lg text-sm font-semibold hover:opacity-90">Solicitar acceso</button>
          </div>
        </div>
      </nav>

      <header className="flex flex-col items-center px-6 pt-16 sm:pt-20 pb-14 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[620px] h-[620px] rounded-full bg-accent/5 blur-3xl" />
        </div>
        <p className="relative text-xs font-bold uppercase tracking-[0.25em] text-accent mb-7">· {HERO.eyebrow} ·</p>
        <h1 className="relative text-5xl sm:text-6xl lg:text-7xl font-serif font-bold leading-[0.98] mb-7 max-w-4xl">
          {HERO.titleLine1}<br /><span className="text-accent italic">{HERO.titleAccent}</span><br />
          <span className="block text-3xl sm:text-4xl lg:text-5xl mt-4 text-ink/80">{HERO.titleLine2}</span>
        </h1>
        <p className="relative text-lg text-muted max-w-xl mx-auto mb-9 leading-relaxed">{HERO.subtitle}</p>
        <div className="relative flex flex-col sm:flex-row gap-3 justify-center mb-8">
          {onDemo && (
            <button onClick={onDemo} className="flex items-center justify-center gap-2 px-8 py-4 bg-ink text-white rounded-xl text-sm font-bold hover:opacity-90 shadow-lg">
              Ver demo en vivo <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <button onClick={onRegister} className={`flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-sm font-semibold transition-all ${
            onDemo ? 'border border-border text-muted hover:border-ink hover:text-ink' : 'bg-ink text-white hover:opacity-90 shadow-lg'}`}>
            Solicitar acceso
          </button>
        </div>
        <ul className="relative flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted">
          {HERO.proof.map(p => <li key={p} className="flex items-center gap-1.5"><Check className="w-4 h-4 text-ok" aria-hidden /> {p}</li>)}
        </ul>
      </header>

      <LandingPreview />

      <section aria-labelledby="landing-pains" className="max-w-5xl mx-auto px-6 py-16 w-full">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-3 text-center">El problema</p>
        <h2 id="landing-pains" className="text-3xl sm:text-4xl font-serif font-bold text-center mb-12 max-w-2xl mx-auto leading-tight">Llevar clientes no debería ser perseguirlos</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {PAINS.map(p => (
            <div key={p.title} className="card p-7">
              <p className="font-serif font-bold text-lg mb-2">{p.title}</p>
              <p className="text-sm text-muted leading-relaxed">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="landing-steps" className="bg-bg-alt/60 border-y border-border">
        <div className="max-w-5xl mx-auto px-6 py-16 w-full">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-3 text-center">Cómo funciona</p>
          <h2 id="landing-steps" className="text-3xl sm:text-4xl font-serif font-bold text-center mb-12 max-w-2xl mx-auto leading-tight">De tu hoja de cálculo a un seguimiento que se mueve solo</h2>
          <ol className="grid md:grid-cols-3 gap-6">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="w-9 h-9 rounded-full bg-ink text-white flex items-center justify-center text-sm font-bold mb-4" aria-hidden>{i + 1}</span>
                <p className="font-serif font-bold text-lg mb-2">{s.title}</p>
                <p className="text-sm text-muted leading-relaxed">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="landing-features" className="max-w-5xl mx-auto px-6 py-16 w-full">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-3 text-center">Qué incluye</p>
        <h2 id="landing-features" className="text-3xl sm:text-4xl font-serif font-bold text-center mb-8 max-w-2xl mx-auto leading-tight">{group.title}</h2>
        <div role="tablist" aria-label="Qué incluye" className="flex justify-center gap-2 mb-10 flex-wrap">
          {FEATURE_GROUPS.map(g => (
            <button key={g.id} role="tab" aria-selected={g.id === groupId} onClick={() => setGroupId(g.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${g.id === groupId ? 'bg-ink text-white' : 'bg-card border border-border text-muted hover:text-ink'}`}>
              {g.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {group.items.map(({ title, text }) => (
            <div key={title} className="card p-7 hover:border-accent/40 hover:shadow-sm transition-all">
              <p className="font-serif font-bold text-base mb-2">{title}</p>
              <p className="text-sm text-muted leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="landing-faq" className="max-w-3xl mx-auto px-6 py-14 w-full">
        <h2 id="landing-faq" className="text-3xl sm:text-4xl font-serif font-bold text-center mb-10 leading-tight">Preguntas frecuentes</h2>
        <div className="card divide-y divide-border/60">
          {FAQ.map(f => (
            <details key={f.q} className="group px-6 py-4">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-semibold text-sm">
                {f.q}
                <ChevronDown className="w-4 h-4 text-muted flex-shrink-0 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="text-sm text-muted leading-relaxed mt-3">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-20 w-full">
        <div className="card-featured p-10 sm:p-14 text-center">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold mb-4">{FINAL_CTA.title}</h2>
          <p className="text-muted max-w-lg mx-auto mb-8 leading-relaxed">{FINAL_CTA.text}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {onDemo && (
              <button onClick={onDemo} className="flex items-center justify-center gap-2 px-8 py-4 bg-ink text-white rounded-xl text-sm font-bold hover:opacity-90 shadow-lg">
                Ver demo en vivo <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <button onClick={onRegister} className="px-8 py-4 rounded-xl text-sm font-semibold border border-border bg-card hover:border-ink transition-colors">Solicitar acceso</button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border mt-auto px-6 py-6 max-w-5xl mx-auto w-full">
        <LegalLinks slugs={['terminos', 'privacidad', 'encargado', 'cookies', 'aviso']} />
      </footer>
    </div>
  )
}
