import { useEffect } from 'react'

/**
 * Marca blanca: sobreescribe la variable CSS --color-accent (definida en
 * index.css vía @theme) mientras el componente que llama a este hook está
 * montado, para aplicar el color de marca del nutricionista a toda la app
 * (bg-accent, text-accent, border-accent...). Sin color -> no toca nada.
 */
export function useAccentOverride(color?: string | null) {
  useEffect(() => {
    if (!color) return
    const root = document.documentElement
    const prev = root.style.getPropertyValue('--color-accent')
    root.style.setProperty('--color-accent', color)
    return () => {
      if (prev) root.style.setProperty('--color-accent', prev)
      else root.style.removeProperty('--color-accent')
    }
  }, [color])
}
