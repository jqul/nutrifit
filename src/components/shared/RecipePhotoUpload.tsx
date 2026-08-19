import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from './Toast'
import { Camera, Loader2 } from 'lucide-react'

/** Sube una foto real al bucket "recipe-photos" (antes solo se podía pegar
 * una URL externa ya publicada, que casi nadie tenía a mano). La ruta
 * empieza por el uid del nutricionista, que es lo que exige la política de
 * escritura del bucket. */
export function RecipePhotoUpload({ nutricionistaId, currentUrl, demoMode, size = 'sm', onUploaded }: {
  nutricionistaId: string
  currentUrl?: string | null
  demoMode?: boolean
  size?: 'sm' | 'lg'
  onUploaded: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)

  const handleFile = async (file: File) => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    setUploading(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${nutricionistaId}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('recipe-photos').upload(path, file, { upsert: true })
    if (error) { toast('Error al subir la foto', 'warn'); setUploading(false); return }
    const { data } = supabase.storage.from('recipe-photos').getPublicUrl(path)
    setUploading(false)
    onUploaded(data.publicUrl)
  }

  const dims = size === 'sm' ? 'w-9 h-9' : 'w-20 h-20'
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5'

  return (
    <label className={`${dims} rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 cursor-pointer bg-bg border border-dashed border-border hover:border-accent transition-colors relative`}>
      {uploading ? (
        <Loader2 className={`${iconSize} text-muted animate-spin`} />
      ) : currentUrl ? (
        <img src={currentUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <Camera className={`${iconSize} text-muted`} />
      )}
      <input type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </label>
  )
}
