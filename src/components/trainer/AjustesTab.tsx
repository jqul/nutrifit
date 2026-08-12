import { useState } from 'react'
import { UserProfile, CustomAnamnesisQuestion } from '../../types'
import { supabase } from '../../lib/supabase'
import { Button } from '../shared/Button'
import { toast } from '../shared/Toast'
import { SurveyManager } from './SurveyManager'
import { DEMO_CUSTOM_SURVEYS } from '../../lib/demo-data'
import { Plus, Trash2, Palette, Globe, ClipboardList } from 'lucide-react'

function newId() { return crypto.randomUUID() }

export function AjustesTab({ userProfile, demoMode, onUpdateProfile }: {
  userProfile: UserProfile
  demoMode?: boolean
  onUpdateProfile: (updates: Partial<UserProfile>) => void
}) {
  const [questions, setQuestions] = useState<CustomAnamnesisQuestion[]>(userProfile.customAnamnesisQuestions)
  const [newQuestion, setNewQuestion] = useState('')
  const [savingQuestions, setSavingQuestions] = useState(false)

  const [logoUrl, setLogoUrl] = useState(userProfile.logoUrl || '')
  const [accentColor, setAccentColor] = useState(userProfile.accentColor || '#3f7d4f')
  const [customDomain, setCustomDomain] = useState(userProfile.customDomain || '')
  const [savingBranding, setSavingBranding] = useState(false)

  const addQuestion = () => {
    if (!newQuestion.trim()) return
    setQuestions([...questions, { id: newId(), label: newQuestion.trim() }])
    setNewQuestion('')
  }
  const removeQuestion = (id: string) => setQuestions(questions.filter(q => q.id !== id))

  const saveQuestions = async () => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    setSavingQuestions(true)
    const { error } = await supabase.from('nutricionistas').update({ custom_anamnesis_questions: questions }).eq('uid', userProfile.uid)
    setSavingQuestions(false)
    if (error) { toast('Error: ' + error.message, 'warn'); return }
    onUpdateProfile({ customAnamnesisQuestions: questions })
    toast('Preguntas guardadas ✓', 'ok')
  }

  const saveBranding = async () => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    setSavingBranding(true)
    const { error } = await supabase.from('nutricionistas').update({
      logo_url: logoUrl.trim() || null,
      accent_color: accentColor.trim() || null,
      custom_domain: customDomain.trim() || null,
    }).eq('uid', userProfile.uid)
    setSavingBranding(false)
    if (error) { toast('Error: ' + (error.message.includes('duplicate') ? 'Ese dominio ya está en uso' : error.message), 'warn'); return }
    onUpdateProfile({ logoUrl: logoUrl.trim() || null, accentColor: accentColor.trim() || null, customDomain: customDomain.trim() || null })
    toast('Marca guardada ✓', 'ok')
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-serif font-bold mb-2">Ajustes</h1>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <p className="font-semibold text-sm flex items-center gap-1.5"><ClipboardList className="w-4 h-4" /> Preguntas personalizadas de anamnesis</p>
        <p className="text-xs text-muted">
          Se añaden al cuestionario de salud que rellenan tus clientes, después de las preguntas fijas.
        </p>
        {questions.length > 0 && (
          <div className="space-y-2">
            {questions.map(q => (
              <div key={q.id} className="flex items-center gap-2 bg-bg-alt rounded-lg px-3 py-2">
                <span className="flex-1 text-sm">{q.label}</span>
                <button onClick={() => removeQuestion(q.id)} className="text-muted hover:text-warn flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input value={newQuestion} onChange={e => setNewQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addQuestion()}
            placeholder="Ej. ¿Sigues alguna dieta religiosa o cultural?"
            className="flex-1 px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
          <button onClick={addQuestion} className="p-2.5 bg-bg-alt rounded-xl text-muted hover:text-accent flex-shrink-0"><Plus className="w-4 h-4" /></button>
        </div>
        <Button onClick={saveQuestions} loading={savingQuestions}>Guardar preguntas</Button>
      </div>

      <SurveyManager nutricionistaId={userProfile.uid} demoMode={demoMode} demoSurveys={demoMode ? DEMO_CUSTOM_SURVEYS : undefined} />

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <p className="font-semibold text-sm flex items-center gap-1.5"><Palette className="w-4 h-4" /> Marca blanca</p>
        <p className="text-xs text-muted">
          Personaliza el logo y el color que ven tus clientes en su panel, y el tuyo propio en el panel de nutricionista.
        </p>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">URL del logo</label>
          <div className="flex items-center gap-3">
            {logoUrl && <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-full object-cover border border-border flex-shrink-0" />}
            <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..."
              className="flex-1 px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
          </div>
          <p className="text-[11px] text-muted mt-1">Pega la URL pública de una imagen (ej. subida a Imgur, Google Drive público, o tu web).</p>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Color de acento</label>
          <div className="flex items-center gap-3">
            <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : '#3f7d4f'}
              onChange={e => setAccentColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-border cursor-pointer flex-shrink-0 bg-transparent" />
            <input value={accentColor} onChange={e => setAccentColor(e.target.value)} placeholder="#3f7d4f"
              className="flex-1 px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Dominio propio</label>
          <input value={customDomain} onChange={e => setCustomDomain(e.target.value)} placeholder="miconsulta.com"
            className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
          <p className="text-[11px] text-muted mt-1">
            Guardar aquí el dominio no lo activa por sí solo: además tienes que apuntar su DNS a Vercel y añadirlo en
            los ajustes del proyecto en Vercel (Settings → Domains). Pídenos ayuda con ese paso si lo necesitas.
          </p>
        </div>
        <Button onClick={saveBranding} loading={savingBranding}>Guardar marca</Button>
      </div>
    </div>
  )
}
