import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { ThemeToggle } from '../shared/ThemeToggle'
import { Button } from '../shared/Button'
import { toast } from '../shared/Toast'
import { LogOut, Check, X } from 'lucide-react'

interface NutricionistaRow {
  uid: string
  email: string
  display_name: string
  approved: boolean
  role: 'trainer' | 'super_admin'
  created_at: string
}

export function SuperAdminPanel({ onLogout }: { onLogout: () => void }) {
  const [nutricionistas, setNutricionistas] = useState<NutricionistaRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('nutricionistas').select('*').order('created_at', { ascending: false })
    if (error) { toast('Error al cargar nutricionistas', 'warn'); setLoading(false); return }
    setNutricionistas((data || []) as NutricionistaRow[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const setApproved = async (uid: string, approved: boolean) => {
    const { error } = await supabase.from('nutricionistas').update({ approved }).eq('uid', uid)
    if (error) { toast('Error: ' + error.message, 'warn'); return }
    toast(approved ? 'Cuenta activada ✓' : 'Cuenta desactivada', 'ok')
    await load()
  }

  const pendientes = nutricionistas.filter(n => !n.approved)
  const activos = nutricionistas.filter(n => n.approved)

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-bg/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-serif font-bold">Nutri<span className="text-accent italic">Fit</span> <span className="text-xs text-muted font-sans">· Admin</span></span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={onLogout} className="p-2 rounded-lg hover:bg-bg-alt text-muted hover:text-ink transition-colors" title="Cerrar sesión">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {loading ? <p className="text-muted text-sm">Cargando...</p> : (
          <>
            <section>
              <h2 className="text-lg font-serif font-bold mb-3">Pendientes de aprobación ({pendientes.length})</h2>
              {pendientes.length === 0 ? (
                <p className="text-sm text-muted">No hay solicitudes pendientes.</p>
              ) : (
                <div className="space-y-2">
                  {pendientes.map(n => (
                    <div key={n.uid} className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm">{n.display_name}</p>
                        <p className="text-xs text-muted">{n.email}</p>
                      </div>
                      <Button size="sm" onClick={() => setApproved(n.uid, true)}><Check className="w-3.5 h-3.5" /> Aprobar</Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-lg font-serif font-bold mb-3">Activos ({activos.length})</h2>
              <div className="space-y-2">
                {activos.map(n => (
                  <div key={n.uid} className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm">{n.display_name} {n.role === 'super_admin' && <span className="text-[10px] text-accent font-bold uppercase ml-1">Admin</span>}</p>
                      <p className="text-xs text-muted">{n.email}</p>
                    </div>
                    {n.role !== 'super_admin' && (
                      <Button size="sm" variant="danger" onClick={() => setApproved(n.uid, false)}><X className="w-3.5 h-3.5" /> Desactivar</Button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
