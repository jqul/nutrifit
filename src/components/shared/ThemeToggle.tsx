import { Moon, Sun } from 'lucide-react'
import { useDarkMode } from '../../lib/useDarkMode'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { dark, toggle } = useDarkMode()
  return (
    <button onClick={toggle} title={dark ? 'Modo claro' : 'Modo oscuro'}
      className={`p-2 rounded-lg hover:bg-bg-alt text-muted transition-colors ${className}`}>
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}
