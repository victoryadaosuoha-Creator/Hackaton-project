import { useAppState } from '@/context/AppState'
import { formatDateTime } from '@/utils/dates'

export function AdminAuditPage() {
  const { audit } = useAppState()
  return (
    <div>
      <h1 className="font-display text-3xl text-brand-900">Audit history</h1>
      <p className="mt-1 text-sm text-muted">Privileged routing and assignment actions are listed here.</p>
      {audit.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No audit entries yet. This is an empty log, not a count of zero events from missing data.</p>
      ) : (
        <ol className="mt-6 space-y-3">
          {audit.map((entry) => (
            <li key={entry.id} className="rounded-xl border border-line bg-white p-4 text-sm">
              <p className="font-semibold text-brand-900">{entry.action}</p>
              <p>{entry.detail}</p>
              <p className="mt-1 text-xs text-muted">
                {formatDateTime(entry.at)} · {entry.actor}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
