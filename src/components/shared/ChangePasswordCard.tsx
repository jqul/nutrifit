import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from './Button'
import { toast } from './Toast'
import { KeyRound } from 'lucide-react'

/**
 * Cambiar contraseña estando ya autenticado (distinto de "¿Olvidaste tu
 * contraseña?", que manda un email — esto es para quien simplemente quiere
 * actualizarla sin salir de la sesión). Se usa tanto en Ajustes (nutricionista)
 * como en el "Más" del cliente.
 */
export function ChangePasswordCard({ demoMode }: { demoMode?: boolean }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (password.length < 6) { toast('La contraseña debe tener al menos 6 caracteres', 'warn'); return }
    if (password !== confirm) { toast('Las contraseñas no coinciden', 'warn'); return }
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); setPassword(''); setConfirm(''); setOpen(false); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) { toast('Error: ' + error.message, 'warn'); return }
    toast('Contraseña actualizada ✓', 'ok')
    setPassword(''); setConfirm(''); setOpen(false)
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold flex items-center gap-1.5"><KeyRound className="w-4 h-4" /> Contraseña</p>
        {!open && (
          <button onClick={() => setOpen(true)} className="flex-shrink-0 text-xs font-bold text-accent">Cambiar</button>
        )}
      </div>
      {open && (
        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Nueva contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
              className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Repite la contraseña</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()} placeholder="••••••••"
              className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} loading={saving}>Guardar</Button>
            <Button variant="ghost" onClick={() => { setOpen(false); setPassword(''); setConfirm('') }}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  )
}
