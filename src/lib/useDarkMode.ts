import { useState, useEffect } from 'react'

const LS_KEY = 'nf_dark_mode'

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
}

export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem(LS_KEY) === '1' } catch { return false }
  })

  useEffect(() => { applyTheme(dark) }, [dark])

  const toggle = () => {
    setDark(d => {
      const next = !d
      try { localStorage.setItem(LS_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }

  return { dark, toggle }
}
