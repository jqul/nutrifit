import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from './Toast'
import { FileText, Upload, Loader2, X } from 'lucide-react'

/** Sube el PDF de consentimiento informado (el que redacte tu propio
 * abogado) al bucket "consent-documents" — mismo patrón que
 * RecipePhotoUpload, pero para un único PDF por nutricionista en vez de
 * una foto por receta. Se sobrescribe siempre en la misma ruta (upsert)
 * para no acumular versiones sueltas cada vez que se reemplaza. */
export function ConsentDocumentUpload({ nutricionistaId, currentUrl, demoMode, onUploaded, onRemoved }: {
  nutricionistaId: string
  currentUrl: string | null
  demoMode?: boolean
  onUploaded: (url: string) => void
  onRemoved: () => void
}) {
  const [uploading, setUploading] = useState(false)

  const handleFile = async (file: File) => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    if (file.type !== 'application/pdf') { toast('El documento debe ser un PDF', 'warn'); return }
    setUploading(true)
    const path = `${nutricionistaId}/consentimiento.pdf`
    const { error } = await supabase.storage.from('consent-documents').upload(path, file, { upsert: true })
    if (error) { toast('Error al subir el documento', 'warn'); setUploading(false); return }
    const { data } = supabase.storage.from('consent-documents').getPublicUrl(path)
    // Cache-bust: la ruta es siempre la misma al reemplazar, así que sin
    // esto el navegador (o el cliente, la próxima vez que abra su enlace)
    // podría seguir viendo la versión anterior cacheada del PDF.
    setUploading(false)
    onUploaded(`${data.publicUrl}?v=${Date.now()}`)
    toast('Documento subido ✓', 'ok')
  }

  return (
    <div className="space-y-2">
      {currentUrl ? (
        <div className="flex items-center gap-3 p-3 bg-bg-alt rounded-xl">
          <FileText className="w-5 h-5 text-accent flex-shrink-0" />
          <a href={currentUrl} target="_blank" rel="noreferrer" className="flex-1 text-sm font-medium text-accent hover:underline truncate">
            Ver documento actual
          </a>
          <label className="text-xs font-semibold text-muted hover:text-ink cursor-pointer flex-shrink-0">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reemplazar'}
            <input type="file" accept="application/pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </label>
          <button onClick={onRemoved} title="Quitar documento" className="text-muted hover:text-warn flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 p-4 border border-dashed border-border rounded-xl cursor-pointer hover:border-accent transition-colors text-sm text-muted hover:text-accent">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Subiendo...' : 'Subir documento de consentimiento (PDF)'}
          <input type="file" accept="application/pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </label>
      )}
    </div>
  )
}
