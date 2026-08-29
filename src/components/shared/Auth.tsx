import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Eye, EyeOff, Check, ArrowRight } from 'lucide-react'

interface AuthProps { onAuth: () => void; onDemo?: () => void }

const FEATURES = [
  { icon: '🥗', title: 'Plan de dieta', desc: 'Macros, comidas, suplementación y consejo personalizado por cliente.' },
  { icon: '⚖️', title: 'Seguimiento de peso', desc: 'Gráfica de evolución sincronizada, sin depender del móvil del cliente.' },
  { icon: '📸', title: 'Fotos de progreso', desc: 'El cliente sube fotos y tú ves su evolución visual.' },
  { icon: '✅', title: 'Check-in diario', desc: 'Adherencia, hambre, energía y ánimo cada día, sin preguntarlo por WhatsApp.' },
  { icon: '📱', title: 'Panel del cliente', desc: 'Acceso desde el móvil con un enlace. Sin registro. Sin contraseña.' },
  { icon: '📈', title: 'Adherencia y racha', desc: 'Ve de un vistazo quién sigue el plan y quién necesita un empujón.' },
]

export function Auth({ onAuth, onDemo }: AuthProps) {
  const [view, setView] = useState<'landing' | 'login' | 'register' | 'forgot'>('landing')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [registered, setRegistered] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  const handleLogin = async () => {
    setError(''); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Email o contraseña incorrectos')
    else onAuth()
    setLoading(false)
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) { setError('Introduce tu email'); return }
    setError(''); setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    setLoading(false)
    if (error) { setError(error.message); return }
    setForgotSent(true)
  }

  const handleRegister = async () => {
    if (!name.trim()) { setError('Introduce tu nombre'); return }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    setError(''); setLoading(true)
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: name, signup_type: 'nutricionista' } },
    })
    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false); setRegistered(true)
  }

  if (view === 'landing') return (
    <div className="min-h-screen bg-bg flex flex-col">
      <nav className="border-b border-border bg-bg/90 backdrop-blur-sm sticky top-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-serif font-bold">Nutri<span className="text-accent italic">Fit</span></span>
          <div className="flex items-center gap-3">
            {onDemo && (
              <button onClick={onDemo} className="hidden sm:block px-3 py-2 text-sm text-muted hover:text-ink transition-colors">Ver demo</button>
            )}
            <button onClick={() => setView('login')} className="px-4 py-2 text-sm font-medium text-muted hover:text-ink transition-colors">Entrar →</button>
            <button onClick={() => setView('register')} className="px-4 py-2 bg-ink text-white rounded-lg text-sm font-semibold hover:opacity-90">Solicitar acceso</button>
          </div>
        </div>
      </nav>
      <section className="flex flex-col items-center justify-center px-6 pt-20 pb-16 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent/5 blur-3xl" />
        </div>
        <p className="relative text-xs font-bold uppercase tracking-[0.25em] text-accent mb-8">· Software para nutricionistas ·</p>
        <h1 className="relative text-6xl sm:text-7xl lg:text-8xl font-serif font-bold leading-[0.92] mb-8 max-w-4xl">
          Un panel<br /><span className="text-accent italic">único</span><br />por cliente
        </h1>
        <p className="relative text-lg text-muted max-w-lg mx-auto mb-12 leading-relaxed">
          Cada cliente tiene su propio espacio: plan de dieta, seguimiento de peso, fotos y check-ins diarios.
        </p>
        <div className="relative flex flex-col sm:flex-row gap-3 justify-center mb-16">
          {onDemo && (
            <button onClick={onDemo} className="flex items-center justify-center gap-2 px-8 py-4 bg-ink text-white rounded-xl text-sm font-bold hover:opacity-90 shadow-lg">
              Ver demo en vivo <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => setView('register')} className={`flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-sm font-semibold transition-all ${
            onDemo ? 'border border-border text-muted hover:border-ink hover:text-ink' : 'bg-ink text-white hover:opacity-90 shadow-lg'
          }`}>
            Solicitar acceso
          </button>
        </div>
      </section>
      <section className="max-w-5xl mx-auto px-6 py-20 w-full">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-4 text-center">Qué incluye</p>
        <h2 className="text-4xl sm:text-5xl font-serif font-bold text-center mb-16 max-w-2xl mx-auto leading-tight">Todo lo que necesitas para gestionar a tus clientes</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map(({ icon, title, desc }) => (
            <div key={title} className="bg-card border border-border rounded-2xl p-8 hover:border-accent/40 hover:shadow-sm transition-all group">
              <div className="text-2xl mb-4 group-hover:scale-110 transition-transform inline-block">{icon}</div>
              <p className="font-serif font-bold text-base mb-2">{title}</p>
              <p className="text-sm text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )

  if (registered) return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-4xl font-serif font-bold mb-8">Nutri<span className="text-accent italic">Fit</span></h1>
        <div className="bg-card border border-border rounded-2xl p-8">
          <div className="w-14 h-14 bg-ok/10 rounded-full flex items-center justify-center mx-auto mb-4"><Check className="w-7 h-7 text-ok" /></div>
          <h2 className="font-serif font-bold text-xl mb-2">Solicitud enviada</h2>
          <p className="text-muted text-sm leading-relaxed">Tu cuenta ha sido creada. Recibirás confirmación de acceso en breve.</p>
          <button onClick={() => { setRegistered(false); setView('login') }} className="mt-6 w-full py-3 bg-ink text-white rounded-xl text-sm font-bold hover:opacity-90">Ir al inicio de sesión</button>
        </div>
      </div>
    </div>
  )

  if (view === 'forgot') return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-3xl font-serif font-bold mb-8">Nutri<span className="text-accent italic">Fit</span></h1>
        {forgotSent ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <div className="w-14 h-14 bg-ok/10 rounded-full flex items-center justify-center mx-auto mb-4"><Check className="w-7 h-7 text-ok" /></div>
            <h2 className="font-serif font-bold text-xl mb-2">Revisa tu email</h2>
            <p className="text-muted text-sm leading-relaxed">Te hemos mandado un enlace a <strong>{email}</strong> para elegir una nueva contraseña.</p>
            <button onClick={() => { setForgotSent(false); setView('login') }} className="mt-6 w-full py-3 bg-ink text-white rounded-xl text-sm font-bold hover:opacity-90">Volver al inicio de sesión</button>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-serif font-bold mb-2">¿Olvidaste tu contraseña?</h2>
            <p className="text-muted text-sm mb-8">Te mandamos un enlace a tu email para elegir una nueva.</p>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleForgotPassword()}
                placeholder="tu@email.com"
                className="w-full px-4 py-3 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
            </div>
            {error && <p className="mt-3 text-sm text-warn">{error}</p>}
            <button onClick={handleForgotPassword} disabled={loading}
              className="w-full mt-6 py-3.5 bg-ink text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50">
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>
            <button onClick={() => { setError(''); setView('login') }} className="w-full mt-4 text-center text-sm text-muted hover:text-ink">← Volver al inicio de sesión</button>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-bg flex">
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-ink text-white p-16">
        <span className="text-xl font-serif font-bold">Nutri<span className="text-accent italic">Fit</span></span>
        <div>
          <h2 className="text-5xl font-serif font-bold leading-tight mb-6">Tu consulta de<br /><span className="text-accent italic">nutrición</span><br />en un solo lugar</h2>
          <p className="text-white/50 text-sm leading-relaxed max-w-sm">Planes de dieta, seguimiento de peso y adherencia de tus clientes.</p>
        </div>
        <button onClick={() => setView('landing')} className="text-white/60 text-sm font-medium hover:text-white transition-colors text-left">← Volver a la página principal</button>
      </div>
      <div className="flex-1 flex items-center justify-center p-8" style={{ paddingTop: 'max(2rem, env(safe-area-inset-top, 0px))' }}>
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-8">
            <button onClick={() => setView('landing')} className="text-muted text-xs hover:text-ink mb-4 inline-block">← Volver</button>
            <h1 className="text-3xl font-serif font-bold">Nutri<span className="text-accent italic">Fit</span></h1>
          </div>
          <h2 className="text-2xl font-serif font-bold mb-2">{view === 'login' ? 'Bienvenido de nuevo' : 'Solicitar acceso'}</h2>
          <p className="text-muted text-sm mb-8">{view === 'login' ? 'Entra a tu panel de nutricionista.' : 'Crea tu cuenta y empieza a gestionar clientes.'}</p>
          <div className="space-y-4">
            {view === 'register' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Nombre completo</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre"
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (view === 'login' ? handleLogin() : handleRegister())}
                placeholder="tu@email.com"
                className="w-full px-4 py-3 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Contraseña</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (view === 'login' ? handleLogin() : handleRegister())}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-10 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
                <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          {view === 'login' && (
            <button onClick={() => { setError(''); setView('forgot') }} className="mt-2 text-sm text-muted hover:text-accent">¿Olvidaste tu contraseña?</button>
          )}
          {error && <p className="mt-3 text-sm text-warn">{error}</p>}
          <button className="w-full mt-6 py-3.5 bg-ink text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            onClick={view === 'login' ? handleLogin : handleRegister} disabled={loading}>
            {loading ? 'Cargando...' : view === 'login' ? 'Entrar' : 'Crear cuenta'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
          <p className="text-center text-sm text-muted mt-6">
            {view === 'login' ? '¿Sin cuenta? ' : '¿Ya tienes cuenta? '}
            <button onClick={() => { setView(view === 'login' ? 'register' : 'login'); setError('') }} className="text-accent hover:underline font-semibold">
              {view === 'login' ? 'Solicitar acceso' : 'Entrar'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
