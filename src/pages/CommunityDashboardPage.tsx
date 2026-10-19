import { ReportCard } from '@/components/reports/ReportCard'
import { Card, MetricCard } from '@/components/ui/Card'
import { useAppState } from '@/context/AppState'
import { CATEGORY_LABELS, STATUS_LABELS } from '@/data/catalog'
import { PublicLayout } from '@/layouts/PublicLayout'
import { countByCategory, countByStatus, resolutionRate } from '@/utils/stats'

export function CommunityDashboardPage() {
  const { reports } = useAppState()
  const byStatus = countByStatus(reports)
  const rate = resolutionRate(reports)

  return (
    <PublicLayout>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-4xl text-brand-900">Community dashboard</h1>
        <p className="mt-2 text-sm text-muted">
          Counts come from demonstration records in this browser. They are not official government statistics.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <MetricCard label="Reports" value={String(reports.length)} />
          <MetricCard label="Resolution rate" value={rate == null ? 'No data' : `${rate}%`} hint="Resolved ÷ all reports" />
          <MetricCard label="Resolved" value={String(byStatus.resolved)} />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-bold text-brand-900">By status</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {Object.entries(byStatus).map(([status, count]) => (
                <li key={status} className="flex justify-between">
                  <span>{STATUS_LABELS[status as keyof typeof STATUS_LABELS]}</span>
                  <span className="font-semibold">{count}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h2 className="font-bold text-brand-900">By category</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {countByCategory(reports).map((row) => (
                <li key={row.category} className="flex justify-between gap-3">
                  <span>{CATEGORY_LABELS[row.category]}</span>
                  <span className="font-semibold">{row.count}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="mt-6 grid gap-3">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      </div>
    </PublicLayout>
  )
}
