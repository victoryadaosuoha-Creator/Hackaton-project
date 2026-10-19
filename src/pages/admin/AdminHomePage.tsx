import { Link } from 'react-router-dom'
import { MetricCard } from '@/components/ui/Card'
import { useAppState } from '@/context/AppState'

export function AdminHomePage() {
  const { reports, audit } = useAppState()
  const unassigned = reports.filter((item) => item.assignment === 'unassigned')

  return (
    <div>
      <h1 className="font-display text-3xl text-brand-900">Administration</h1>
      <p className="mt-1 text-sm text-muted">
        Privileges come from the signed-in profile, not from visiting this URL. Routing changes are validated in the store
        or database function and written to the audit log.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Reports" value={String(reports.length)} />
        <MetricCard label="Unassigned" value={String(unassigned.length)} />
        <MetricCard label="Audit entries" value={String(audit.length)} hint={audit.length === 0 ? 'Empty log, not a missing count of events' : undefined} />
      </div>
      <ul className="mt-6 space-y-2 text-sm font-semibold text-brand-800">
        <li>
          <Link to="/admin/unassigned">Review reports awaiting assignment</Link>
        </li>
        <li>
          <Link to="/admin/routing">Maintain category routing</Link>
        </li>
        <li>
          <Link to="/admin/audit">Inspect the audit history</Link>
        </li>
        <li>
          <Link to="/admin/analytics">Monitor aggregate activity</Link>
        </li>
      </ul>
    </div>
  )
}
