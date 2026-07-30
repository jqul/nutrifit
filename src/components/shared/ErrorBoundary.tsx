import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('[NutriFit] Error no controlado:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[100dvh] bg-bg flex items-center justify-center p-6">
          <div className="max-w-sm text-center space-y-4">
            <h1 className="text-2xl font-serif font-bold">Algo ha ido mal</h1>
            <p className="text-sm text-muted">
              Se ha producido un error inesperado. Recarga la página — si vuelve a pasar, contacta con soporte.
            </p>
            <button onClick={() => window.location.reload()}
              className="px-5 py-3 bg-ink text-white rounded-2xl text-sm font-bold hover:opacity-90 transition-opacity">
              Recargar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
