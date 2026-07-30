import { useState } from 'react'
import { Eye, EyeOff, CheckCircle2, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Props {
  token: string
  clientName: string
  nutricionistaName: string
  initialStep?: 'register' | 'login'
  onComplete: () => void
}

type Step = 'register' | 'login' | 'forgot' | 'success'

export function ClientRegister({ token, clientName, nutricionistaName, initialStep = 'register', onComplete }: Props) {
  const [step, setStep] = useState<Step>(initialStep)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [forgotSent, setForgotSent] = useState(false)

  const firstName = clientName.split(' ')[0]

  const validatePassword = () => {
    if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres'
    if (password !== confirmPassword) return 'Las contraseñas no coinciden'
    return null
  }

  const handleRegister = async () => {
    setError('')
    const passError = validatePassword()
    if (passError) { setError(passError); return }
    if (!email.trim()) { setError('Introduce tu email'); return }

    setLoading(true)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { clientName, token } },
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        setError('Este email ya tiene cuenta. Inicia sesión.')
        setStep('login')
      } else {
        setError(authError.message)
      }
      setLoading(false)
      return
    }

    if (authData.user) {
      const { error: claimError } = await supabase.rpc('claim_client_by_token', { p_token: token })
      if (claimError) {
        setError('Error al vincular cuenta. Contacta con tu nutricionista.')
        setLoading(false)
        return
      }
      setStep('success')
      setLoading(false)
      setTimeout(onComplete, 1200)
      return
    }
    setLoading(false)
  }

  const handleLogin = async () => {
    setError('')
    if (!email.trim() || !password) { setError('Rellena todos los campos'); return }
    setLoading(true)
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password,
    })
    if (loginError) { setError('Email o contraseña incorrectos'); setLoading(false); return }
    onComplete()
    setLoading(false)
  }

  const handleForgotPassword = async () => {
    setError('')
    if (!email.trim()) { setError('Introduce tu email'); return }
    setLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: window.location.origin })
    setLoading(false)
    if (resetError) { setError(resetError.message); return }
    setForgotSent(true)
  }

  if (step === 'success') {
    return (
      <div className="min-h-[100dvh] bg-bg flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-ok/10 rounded-full flex items-center justify-center mb-5">
          <CheckCircle2 className="w-10 h-10 text-ok" />
        </div>
        <h2 className="text-2xl font-serif font-bold mb-2">¡Cuenta creada!</h2>
        <p className="text-muted text-sm">Accediendo a tu panel...</p>
      </div>
    )
  }

  if (step === 'forgot') {
    return (
      <div className="min-h-[100dvh] bg-bg flex flex-col items-center justify-center px-6 text-center">
        <div className="w-full max-w-sm">
          {forgotSent ? (
            <>
              <div className="w-16 h-16 bg-ok/10 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-8 h-8 text-ok" /></div>
              <h2 className="text-xl font-serif font-bold mb-2">Revisa tu email</h2>
              <p className="text-sm text-muted leading-relaxed">Te hemos mandado un enlace a <strong>{email}</strong> para elegir una nueva contraseña.</p>
              <button onClick={() => { setForgotSent(false); setStep('login') }} className="mt-6 w-full py-3.5 rounded-2xl bg-ink text-white font-bold text-sm">Volver al inicio de sesión</button>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-serif font-bold mb-2">¿Olvidaste tu contraseña?</h1>
              <p className="text-sm text-muted mb-8">Te mandamos un enlace a tu email para elegir una nueva.</p>
              <div className="text-left">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">Email</label>
                <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleForgotPassword()}
                  placeholder="tu@email.com"
                  className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-base outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" />
              </div>
              {error && <p className="mt-3 text-sm text-warn text-left">{error}</p>}
              <button onClick={handleForgotPassword} disabled={loading}
                className="w-full mt-6 py-3.5 rounded-2xl bg-ink text-white font-bold text-sm disabled:opacity-50">
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </button>
              <button onClick={() => { setError(''); setStep('login') }} className="w-full mt-4 text-sm text-muted hover:text-ink">← Volver al inicio de sesión</button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-bg flex flex-col">
      <div className="px-6 pt-12 pb-8 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4 bg-accent">
          {nutricionistaName[0]?.toUpperCase()}
        </div>
        <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">{nutricionistaName}</p>
        {step === 'register' ? (
          <>
            <h1 className="text-2xl font-serif font-bold">Hola, {firstName} 👋</h1>
            <p className="text-sm text-muted mt-2">Crea tu cuenta para acceder a tu panel de nutrición</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-serif font-bold">Bienvenido de nuevo</h1>
            <p className="text-sm text-muted mt-2">Inicia sesión para acceder a tu panel</p>
          </>
        )}
      </div>

      <div className="flex-1 px-6 space-y-4 max-w-sm mx-auto w-full">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">Email</label>
          <input type="email" inputMode="email" autoComplete="email" value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            placeholder="tu@email.com"
            className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-base outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">Contraseña</label>
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} autoComplete={step === 'register' ? 'new-password' : 'current-password'}
              value={password} onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-4 py-3.5 pr-12 bg-card border border-border rounded-2xl text-base outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" />
            <button type="button" onClick={() => setShowPassword(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {step === 'register' && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">Confirmar contraseña</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                placeholder="Repite la contraseña"
                onKeyDown={e => e.key === 'Enter' && handleRegister()}
                className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-base outline-none focus:border-accent transition-colors" />
              {confirmPassword && password === confirmPassword && (
                <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ok" />
              )}
            </div>
          </div>
        )}

        {step === 'login' && (
          <button onClick={() => { setError(''); setStep('forgot') }} className="text-sm text-accent hover:underline">
            ¿Olvidaste tu contraseña?
          </button>
        )}

        {error && (
          <div className="bg-warn/10 border border-warn/20 rounded-xl px-4 py-3">
            <p className="text-sm text-warn font-medium">{error}</p>
          </div>
        )}

        <button onClick={step === 'register' ? handleRegister : handleLogin} disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-ink text-white font-bold text-base disabled:opacity-50 transition-opacity active:scale-[0.98]"
          style={{ minHeight: '56px' }}>
          {loading
            ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <>{step === 'register' ? 'Crear cuenta' : 'Iniciar sesión'} <ArrowRight className="w-4 h-4" /></>
          }
        </button>

        <div className="text-center pt-2 pb-8">
          {step === 'register' ? (
            <p className="text-sm text-muted">
              ¿Ya tienes cuenta?{' '}
              <button onClick={() => { setStep('login'); setError(''); setConfirmPassword('') }} className="font-semibold text-accent hover:underline">
                Inicia sesión
              </button>
            </p>
          ) : (
            <p className="text-sm text-muted">
              ¿Primera vez?{' '}
              <button onClick={() => { setStep('register'); setError(''); setPassword('') }} className="font-semibold text-accent hover:underline">
                Crea tu cuenta
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
