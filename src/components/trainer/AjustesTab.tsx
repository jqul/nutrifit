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
import { Palette, Globe, ClipboardList, MessageCircle, ShieldCheck, UserRound } from 'lucide-react'

type Section = 'cuenta' | 'experiencia' | 'marca' | 'legal'
const SECTIONS: { id: Section; label: string; hint: string }[] = [
  { id: 'cuenta', label: 'Cuenta', hint: 'Tus datos de acceso.' },
  { id: 'experiencia', label: 'Experiencia', hint: 'Experiencia del cliente: el cuestionario de salud que rellenan y las encuestas que reciben.' },
  { id: 'marca', label: 'Marca', hint: 'Cómo ven tu consulta tus clientes: logo, color, dominio y contacto.' },
  { id: 'legal', label: 'Legal', hint: 'Documentos que tus clientes deben aceptar antes de usar su panel.' },
]

export function AjustesTab({ userProfile, demoMode, onUpdateProfile }: {
  userProfile: UserProfile
  demoMode?: boolean
  onUpdateProfile: (updates: Partial<UserProfile>) => void
}) {
  const [section, setSection] = useState<Section>('cuenta')
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
      <h1 className="text-2xl font-serif font-bold">Ajustes</h1>

      <div>
        <div role="tablist" aria-label="Categorías de ajustes" className="flex gap-1 border-b border-border overflow-x-auto">
          {SECTIONS.map(sec => (
            <button key={sec.id} role="tab" aria-selected={section === sec.id} onClick={() => setSection(sec.id)}
              className={`px-3 sm:px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
                section === sec.id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}>
              {sec.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted mt-3">{SECTIONS.find(sec => sec.id === section)!.hint}</p>
      </div>

      {/* Las cuatro categorías se quedan montadas y solo se ocultan con CSS: así
          un formulario a medio rellenar no se pierde al cambiar de categoría. */}
      <div role="tabpanel" className={section === 'cuenta' ? 'space-y-6' : 'hidden'}>
        <div className="card p-5 space-y-3">
          <p className="font-semibold text-sm flex items-center gap-1.5"><UserRound className="w-4 h-4" /> Tu cuenta</p>
          <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            <dt className="text-muted">Nombre</dt><dd className="font-medium min-w-0 break-words">{userProfile.displayName}</dd>
            <dt className="text-muted">Email</dt><dd className="font-medium min-w-0 break-all">{userProfile.email}</dd>
          </dl>
        </div>

        <ChangePasswordCard demoMode={demoMode} />
      </div>

      <div role="tabpanel" className={section === 'experiencia' ? 'space-y-6' : 'hidden'}>
        <div className="card p-5 space-y-4">
          <p className="font-semibold text-sm flex items-center gap-1.5"><ClipboardList className="w-4 h-4" /> Preguntas personalizadas de anamnesis</p>
          <p className="text-xs text-muted">
            Se añaden al cuestionario de salud que rellenan tus clientes, después de las preguntas fijas.
          </p>
          <QuestionEditor questions={questions} onChange={setQuestions} />
          <Button onClick={saveQuestions} loading={savingQuestions}>Guardar preguntas</Button>
        </div>

        <SurveyManager nutricionistaId={userProfile.uid} demoMode={demoMode} demoSurveys={demoMode ? DEMO_CUSTOM_SURVEYS : undefined} />
      </div>

      <div role="tabpanel" className={section === 'marca' ? 'space-y-6' : 'hidden'}>
        <div className="card p-5 space-y-4">
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
            <p className="text-xs text-muted mt-1">Pega la URL pública de una imagen (ej. subida a Imgur, Google Drive público, o tu web).</p>
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
            <p className="text-xs text-muted mt-1">
              Guardar aquí el dominio no lo activa por sí solo: además tienes que apuntar su DNS a Vercel y añadirlo en
              los ajustes del proyecto en Vercel (Settings → Domains). Pídenos ayuda con ese paso si lo necesitas.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> Teléfono de WhatsApp</label>
            <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+34 600 123 456"
              className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
            <p className="text-xs text-muted mt-1">
              Le añade a tus clientes un botón de "Escribir por WhatsApp" en la cabecera de su panel, para dudas rápidas
              sobre el menú.
            </p>
          </div>
          <Button onClick={saveBranding} loading={savingBranding}>Guardar marca</Button>
        </div>
      </div>

      <div role="tabpanel" className={section === 'legal' ? 'space-y-6' : 'hidden'}>
        <div className="card p-5 space-y-4">
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
    </div>
  )
}
