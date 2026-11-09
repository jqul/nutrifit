import { useState, useEffect } from 'react'

const LS_KEY = 'nf_dark_mode'

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
}

/** El modo con el que se abre: lo que se eligió a mano ('1' oscuro, '0' claro) y, si nunca se ha elegido, el del sistema. */
export function initialDark(saved: string | null, systemPrefersDark: boolean): boolean {
  if (saved === '1') return true
  if (saved === '0') return false
  return systemPrefersDark
}

const systemQuery = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null)
const readSaved = () => { try { return localStorage.getItem(LS_KEY) } catch { return null } }

export function useDarkMode() {
  const [dark, setDark] = useState(() => initialDark(readSaved(), systemQuery()?.matches ?? false))

  useEffect(() => { applyTheme(dark) }, [dark])

  // Mientras no se haya elegido a mano, acompaña al sistema (por ejemplo, el cambio automático de noche).
  useEffect(() => {
    const q = systemQuery()
    if (!q) return
    const onChange = (e: MediaQueryListEvent) => { if (readSaved() == null) setDark(e.matches) }
    q.addEventListener('change', onChange)
    return () => q.removeEventListener('change', onChange)
  }, [])

  const toggle = () => {
    setDark(d => {
      const next = !d
      try { localStorage.setItem(LS_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }

  return { dark, toggle }
}
