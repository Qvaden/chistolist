import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

export interface ToastMessage {
  id: string
  text: string
}

interface ToastRegionProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

function ToastItem({
  toast,
  index,
  onDismiss,
}: {
  toast: ToastMessage
  index: number
  onDismiss: (id: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if ('showPopover' in el) {
      try {
        el.showPopover()
      } catch {
        // already open or polyfill pending
      }
    }
    const timer = window.setTimeout(() => {
      onDismiss(toast.id)
    }, 4500)
    return () => window.clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div
      ref={ref}
      {...({ popover: 'manual' } as Record<string, string>)}
      className="toast-item"
      style={{ bottom: `${20 + index * 58}px` }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className="telemetry-dot" aria-hidden="true" />
        <span>{toast.text}</span>
      </div>
      <button
        type="button"
        className="btn btn-sm"
        style={{ padding: '4px' }}
        onClick={() => onDismiss(toast.id)}
        aria-label="Закрыть уведомление"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

export function ToastRegion({ toasts, onDismiss }: ToastRegionProps) {
  return (
    <>
      <div role="region" aria-label="Уведомления" className="toast-region">
        {toasts.map((t, index) => (
          <ToastItem key={t.id} toast={t} index={index} onDismiss={onDismiss} />
        ))}
      </div>
      <div className="sr-only" aria-live="polite">
        {toasts[toasts.length - 1]?.text ?? ''}
      </div>
    </>
  )
}
