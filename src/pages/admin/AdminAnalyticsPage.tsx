import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, MetricCard } from '@/components/ui/Card'
import { useAppState } from '@/context/AppState'
import { CATEGORY_LABELS, INSTITUTIONS } from '@/data/catalog'
import { averageHandlingHours, countByCategory, resolutionRate } from '@/utils/stats'

export function AdminAnalyticsPage() {
  const { reports } = useAppState()
  const rate = resolutionRate(reports)
  const hours = averageHandlingHours(reports)
  const byCategory = countByCategory(reports).map((row) => ({
    name: CATEGORY_LABELS[row.category],
    count: row.count,
  }))

  return (
    <div>
      <h1 className="font-display text-3xl text-brand-900">Operational analytics</h1>
      <p className="mt-1 text-sm text-muted">
        Unresolved means any status other than Resolved. Public charts stay aggregated and do not show private evidence.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Resolution rate" value={rate == null ? 'No data' : `${rate}%`} />
        <MetricCard
          label="Average handling time"
          value={hours == null ? 'No data' : `${hours} h`}
          hint="Resolved reports only, using recorded timestamps"
        />
        <MetricCard label="Reports" value={String(reports.length)} />
      </div>
      <Card className="mt-6 p-4">
        <h2 className="font-bold text-brand-900">Reports by category</h2>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCategory}>
              <XAxis dataKey="name" hide />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#14635D" radius={6} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="mt-4 p-4">
        <h2 className="font-bold text-brand-900">By institution</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {INSTITUTIONS.map((item) => (
            <li key={item.id} className="flex justify-between">
              <span>{item.name}</span>
              <span className="font-semibold">{reports.filter((report) => report.institutionId === item.id).length}</span>
            </li>
          ))}
          <li className="flex justify-between">
            <span>Unassigned</span>
            <span className="font-semibold">{reports.filter((report) => report.institutionId == null).length}</span>
          </li>
        </ul>
      </Card>
    </div>
  )
}
