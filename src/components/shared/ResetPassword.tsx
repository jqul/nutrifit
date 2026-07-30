import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { ArrowRight } from 'lucide-react'

export function ResetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSave = async () => {
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    setError(''); setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    await supabase.auth.signOut()
    setDone(true)
    setLoading(false)
  }

  if (done) return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-4xl font-serif font-bold mb-8">Nutri<span className="text-accent italic">Fit</span></h1>
        <div className="bg-card border border-border rounded-2xl p-8">
          <h2 className="font-serif font-bold text-xl mb-2">Contraseña actualizada ✓</h2>
          <p className="text-muted text-sm leading-relaxed">Ya puedes entrar con tu nueva contraseña.</p>
          <button onClick={onDone} className="mt-6 w-full py-3 bg-ink text-white rounded-xl text-sm font-bold hover:opacity-90">Ir al inicio de sesión</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-3xl font-serif font-bold mb-8">Nutri<span className="text-accent italic">Fit</span></h1>
        <h2 className="text-2xl font-serif font-bold mb-2">Nueva contraseña</h2>
        <p className="text-muted text-sm mb-8">Elige una contraseña nueva para tu cuenta.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Nueva contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Repite la contraseña</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-warn">{error}</p>}
        <button onClick={handleSave} disabled={loading}
          className="w-full mt-6 py-3.5 bg-ink text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? 'Guardando...' : 'Guardar contraseña'}
          {!loading && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
