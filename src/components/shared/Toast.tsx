import { useState, useCallback, useEffect, useRef } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'
interface Toast { id: number; message: string; type?: 'ok' | 'warn' | 'info' }
let globalNextId = 0
let toastFn: ((msg: string, type?: Toast['type']) => void) | null = null
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(globalNextId)
  const show = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++nextId.current
    globalNextId = nextId.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])
  const dismiss = useCallback((id: number) => { setToasts(prev => prev.filter(t => t.id !== id)) }, [])
  useEffect(() => { toastFn = show }, [show])
  return { toasts, show, dismiss }
}
export function toast(message: string, type?: 'ok' | 'warn' | 'info') { toastFn?.(message, type) }
export function ToastContainer({ toasts }: { toasts: ReturnType<typeof useToast>['toasts'] }) {
  const { dismiss } = useToast()
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`animate-slide-up flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium shadow-lg border pointer-events-auto min-w-[200px] max-w-sm ${
          t.type === 'ok' ? 'bg-ok text-white border-ok/20' : t.type === 'warn' ? 'bg-warn text-white border-warn/20' : 'bg-ink text-white border-ink/20'
        }`}>
          <span className="flex-shrink-0">
            {t.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : t.type === 'warn' ? <AlertTriangle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
          </span>
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="flex-shrink-0 opacity-70 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
        </div>
      ))}
    </div>
  )
}
