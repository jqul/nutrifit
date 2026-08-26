import { useState } from 'react'
import { UserProfile, CustomAnamnesisQuestion } from '../../types'
import { supabase } from '../../lib/supabase'
import { Button } from '../shared/Button'
import { toast } from '../shared/Toast'
import { SurveyManager } from './SurveyManager'
import { QuestionEditor } from '../shared/QuestionEditor'
import { ChangePasswordCard } from '../shared/ChangePasswordCard'
import { ConsentDocumentUpload } from '../shared/ConsentDocumentUpload'
import { DEMO_CUSTOM_SURVEYS } from '../../lib/demo-data'
import { Palette, Globe, ClipboardList, MessageCircle, ShieldCheck } from 'lucide-react'

export function AjustesTab({ userProfile, demoMode, onUpdateProfile }: {
  userProfile: UserProfile
  demoMode?: boolean
  onUpdateProfile: (updates: Partial<UserProfile>) => void
}) {
  const [questions, setQuestions] = useState<CustomAnamnesisQuestion[]>(userProfile.customAnamnesisQuestions)
  const [savingQuestions, setSavingQuestions] = useState(false)

  const [consentDocumentUrl, setConsentDocumentUrl] = useState(userProfile.consentDocumentUrl)

  const saveConsentDocument = async (url: string | null) => {
    if (demoMode) { setConsentDocumentUrl(url); return }
    const { error } = await supabase.from('nutricionistas').update({ consent_document_url: url }).eq('uid', userProfile.uid)
    if (error) { toast('Error: ' + error.message, 'warn'); return }
    setConsentDocumentUrl(url)
    onUpdateProfile({ consentDocumentUrl: url })
  }

  const [logoUrl, setLogoUrl] = useState(userProfile.logoUrl || '')
  const [accentColor, setAccentColor] = useState(userProfile.accentColor || '#3f7d4f')
  const [customDomain, setCustomDomain] = useState(userProfile.customDomain || '')
  const [contactPhone, setContactPhone] = useState(userProfile.contactPhone || '')
  const [savingBranding, setSavingBranding] = useState(false)

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
      contact_phone: contactPhone.trim() || null,
    }).eq('uid', userProfile.uid)
    setSavingBranding(false)
    if (error) { toast('Error: ' + (error.message.includes('duplicate') ? 'Ese dominio ya está en uso' : error.message), 'warn'); return }
    onUpdateProfile({ logoUrl: logoUrl.trim() || null, accentColor: accentColor.trim() || null, customDomain: customDomain.trim() || null, contactPhone: contactPhone.trim() || null })
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
        <QuestionEditor questions={questions} onChange={setQuestions} />
        <Button onClick={saveQuestions} loading={savingQuestions}>Guardar preguntas</Button>
      </div>

      <SurveyManager nutricionistaId={userProfile.uid} demoMode={demoMode} demoSurveys={demoMode ? DEMO_CUSTOM_SURVEYS : undefined} />

      <ChangePasswordCard demoMode={demoMode} />

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
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> Teléfono de WhatsApp</label>
          <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+34 600 123 456"
            className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
          <p className="text-[11px] text-muted mt-1">
            Le añade a tus clientes un botón de "Escribir por WhatsApp" en la cabecera de su panel, para dudas rápidas
            sobre el menú.
          </p>
        </div>
        <Button onClick={saveBranding} loading={savingBranding}>Guardar marca</Button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <p className="font-semibold text-sm flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Consentimiento informado</p>
        <p className="text-xs text-muted">
          Sube el documento de consentimiento (protección de datos, condiciones del servicio...) que te haya
          preparado tu propio abogado. Si lo subes, cada cliente nuevo tendrá que leerlo y firmarlo electrónicamente
          (nombre completo + fecha) antes de poder usar su panel — los que ya tenías dados de alta no se ven
          afectados salvo que quieras pedírselo tú aparte.
        </p>
        <ConsentDocumentUpload nutricionistaId={userProfile.uid} currentUrl={consentDocumentUrl} demoMode={demoMode}
          onUploaded={url => saveConsentDocument(url)} onRemoved={() => saveConsentDocument(null)} />
      </div>
    </div>
  )
}
