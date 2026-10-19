import { ReportCard } from '@/components/reports/ReportCard'
import { MetricCard } from '@/components/ui/Card'
import { useAppState } from '@/context/AppState'
import { INSTITUTIONS } from '@/data/catalog'

export function StaffDashboardPage() {
  const { reports, session } = useAppState()
  const visible =
    session?.role === 'admin'
      ? reports
      : reports.filter((report) => report.institutionId === session?.institutionId)
  const institutionName = INSTITUTIONS.find((item) => item.id === session?.institutionId)?.name ?? 'All institutions'

  return (
    <div>
      <h1 className="font-display text-3xl text-brand-900">Assigned reports</h1>
      <p className="mt-1 text-sm text-muted">
        {session?.role === 'admin' ? 'Administrator view of demonstration records.' : institutionName}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Visible reports" value={String(visible.length)} />
        <MetricCard
          label="In progress"
          value={String(visible.filter((item) => item.status === 'in_progress').length)}
        />
        <MetricCard label="Resolved" value={String(visible.filter((item) => item.status === 'resolved').length)} />
      </div>
      <div className="mt-6 grid gap-3">
        {visible.map((report) => (
          <ReportCard key={report.id} report={report} href={`/staff/reports/${report.id}`} />
        ))}
      </div>
    </div>
  )
}
