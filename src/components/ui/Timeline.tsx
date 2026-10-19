import { STATUS_LABELS } from '@/data/catalog'
import { REPORT_STATUSES, type ReportStatus } from '@/data/types'

export function ProgressTimeline({ current }: { current: ReportStatus }) {
  const currentIndex = REPORT_STATUSES.indexOf(current)

  return (
    <ol className="grid grid-cols-5 gap-2">
      {REPORT_STATUSES.map((status, index) => {
        const done = index <= currentIndex
        return (
          <li key={status} className="text-center">
            <span
              className={`mx-auto mb-2 block h-2 rounded-full ${done ? 'bg-brand-600' : 'bg-line'}`}
            />
            <span className={`text-[11px] font-semibold ${done ? 'text-brand-800' : 'text-muted'}`}>
              {STATUS_LABELS[status]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
