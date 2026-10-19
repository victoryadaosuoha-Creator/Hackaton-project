import { Link } from 'react-router-dom'
import { CommunityMap } from '@/components/maps/CommunityMap'
import { ReportCard } from '@/components/reports/ReportCard'
import { MetricCard } from '@/components/ui/Card'
import { useAppState } from '@/context/AppState'
import { COMMUNITIES } from '@/data/catalog'
import { PublicLayout } from '@/layouts/PublicLayout'
import { countByCommunity, unresolvedCount } from '@/utils/stats'

export function MapPage() {
  const { reports } = useAppState()
  const byPlace = countByCommunity(reports)

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-brand-700 uppercase">Community map</p>
            <h1 className="font-display mt-2 text-4xl text-brand-900">Where demonstration reports cluster</h1>
          </div>
          <Link to="/dashboard" className="text-sm font-semibold text-brand-800">
            Open community dashboard
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <MetricCard label="Reports in view" value={String(reports.length)} hint="Includes labelled demo records" />
          <MetricCard label="Unresolved" value={String(unresolvedCount(reports))} hint="Not yet Resolved" />
          <MetricCard label="Localities" value={String(COMMUNITIES.length)} hint="Sample list only" />
        </div>
        <div className="mt-6">
          <CommunityMap reports={reports} />
        </div>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {byPlace.map((item) => {
            const name = COMMUNITIES.find((community) => community.id === item.communityId)?.name ?? item.communityId
            return (
              <li key={item.communityId} className="rounded-xl border border-line bg-white px-4 py-3 text-sm">
                <span className="font-semibold text-brand-900">{name}</span>
                <span className="text-muted"> · {item.count} reports (aggregated)</span>
              </li>
            )
          })}
        </ul>
        <div className="mt-8 grid gap-3">
          {reports.slice(0, 4).map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      </div>
    </PublicLayout>
  )
}
