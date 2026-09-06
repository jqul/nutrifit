import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { LabReportRow } from '../../../lib/supabase-types'
import { toast } from '../../shared/Toast'
import { FileText, Upload, Trash2 } from 'lucide-react'

/**
 * PDF original del laboratorio para una extracción concreta (client_id +
 * date) — además de los valores numéricos que ya se registran marcador a
 * marcador. Un archivo por fecha (no por marcador), bucket privado desde
 * el principio (a diferencia de `photos`, que se creó público por error).
 */
export function LabReportAttachment({ clientId, date, demoMode }: { clientId: string; date: string; demoMode?: boolean }) {
  // undefined = todavía cargando (evita el parpadeo "sin adjuntar" mientras se consulta).
  const [report, setReport] = useState<LabReportRow | null | undefined>(undefined)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (demoMode) { setReport(null); return }
    let cancelled = false
    supabase.from('lab_reports').select('*').eq('client_id', clientId).eq('date', date).maybeSingle()
      .then(({ data }) => { if (!cancelled) setReport(data ?? null) })
    return () => { cancelled = true }
  }, [clientId, date, demoMode])

  const handleUpload = async (file: File) => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    if (file.type !== 'application/pdf') { toast('Solo se admiten archivos PDF', 'warn'); return }
    setUploading(true)
    const path = `${clientId}/${date}.pdf`
    const { error: upErr } = await supabase.storage.from('lab-reports').upload(path, file, { upsert: true })
    if (upErr) { toast('Error al subir el PDF', 'warn'); setUploading(false); return }
    const { data, error } = await supabase.from('lab_reports')
      .upsert({ client_id: clientId, date, file_path: path, file_name: file.name }, { onConflict: 'client_id,date' })
      .select().single()
    setUploading(false)
    if (error) { toast('Error al guardar el informe', 'warn'); return }
    setReport(data)
    toast('Informe adjuntado ✓', 'ok')
  }

  const handleView = async () => {
    if (!report) return
    const { data, error } = await supabase.storage.from('lab-reports').createSignedUrl(report.file_path, 300)
    if (error || !data) { toast('Error al abrir el informe', 'warn'); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const handleDelete = async () => {
    if (!report) return
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    await supabase.storage.from('lab-reports').remove([report.file_path])
    await supabase.from('lab_reports').delete().eq('id', report.id)
    setReport(null)
    toast('Informe eliminado', 'ok')
  }

  if (report === undefined) return null

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {report ? (
        <>
          <button onClick={handleView} title={report.file_name}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-accent/10 text-accent hover:bg-accent/20 transition-colors">
            <FileText className="w-3.5 h-3.5" /> Ver informe (PDF)
          </button>
          <button onClick={handleDelete} title="Quitar informe" className="p-1 text-muted hover:text-warn"><Trash2 className="w-3.5 h-3.5" /></button>
        </>
      ) : (
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-bg-alt text-muted hover:text-accent transition-colors disabled:opacity-50">
          <Upload className="w-3.5 h-3.5" /> {uploading ? 'Subiendo...' : 'Adjuntar PDF'}
        </button>
      )}
      <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
    </div>
  )
}
