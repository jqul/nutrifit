export function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-4">
        <h1 className="text-3xl font-serif font-bold">Nutri<span className="text-accent italic">Fit</span></h1>
        <p className="text-sm text-muted">Esta página no existe o el enlace ha caducado.</p>
        <a href="/" className="inline-block px-5 py-3 bg-ink text-white rounded-2xl text-sm font-bold hover:opacity-90 transition-opacity">
          Volver al inicio
        </a>
      </div>
    </div>
  )
}
