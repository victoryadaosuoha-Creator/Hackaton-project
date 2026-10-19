import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-brand-950/40"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="relative w-full max-w-lg rounded-2xl bg-white p-5 shadow-[var(--shadow-card)]"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="dialog-title" className="text-lg font-bold text-brand-900">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
