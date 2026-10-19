import { Link } from 'react-router-dom'
import { CATEGORY_LABELS } from '@/data/catalog'
import type { Report } from '@/data/types'
import { StatusBadge } from '@/components/ui/Badge'
import { formatDate } from '@/utils/dates'

export function ReportCard({ report, href }: { report: Report; href?: string }) {
  return (
    <Link
      to={href ?? `/track/${report.reference}`}
      className="block rounded-2xl border border-line bg-white p-4 shadow-[var(--shadow-soft)] hover:border-brand-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-brand-900">{report.title}</p>
          <p className="mt-1 text-xs text-muted">
            {CATEGORY_LABELS[report.category]} · {report.locationLabel} · {formatDate(report.createdAt)}
          </p>
          <p className="mt-1 font-mono text-[11px] text-brand-700">{report.reference}</p>
        </div>
        <StatusBadge status={report.status} />
      </div>
      {report.persistence === 'local_demo' ? (
        <p className="mt-2 text-[11px] font-semibold text-amber-800">Local demonstration record</p>
      ) : (
        <p className="mt-2 text-[11px] font-semibold text-brand-700">Stored in Supabase</p>
      )}
    </Link>
  )
}
