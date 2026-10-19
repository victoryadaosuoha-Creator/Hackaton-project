import { STATUS_LABELS } from '@/data/catalog'
import type { ReportStatus } from '@/data/types'

const tone: Record<ReportStatus, string> = {
  submitted: 'bg-sky-50 text-sky-800 border-sky-200',
  under_review: 'bg-amber-50 text-amber-800 border-amber-200',
  assigned: 'bg-violet-50 text-violet-800 border-violet-200',
  in_progress: 'bg-teal-50 text-brand-800 border-brand-200',
  resolved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
}

export function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

export function Pill({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-800">
      {children}
    </span>
  )
}
