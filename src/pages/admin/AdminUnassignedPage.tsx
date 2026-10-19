import { INSTITUTIONS } from '@/data/catalog'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAppState } from '@/context/AppState'

export function AdminUnassignedPage() {
  const { reports, session, assign } = useAppState()
  const queue = reports.filter((item) => item.assignment === 'unassigned')
  if (!session) return null

  return (
    <div>
      <h1 className="font-display text-3xl text-brand-900">Unassigned reports</h1>
      <p className="mt-1 text-sm text-muted">
        These records were kept when routing was unavailable. They were not discarded.
      </p>
      <div className="mt-6 space-y-3">
        {queue.length === 0 ? <p className="text-sm text-muted">The review queue is empty.</p> : null}
        {queue.map((report) => (
          <Card key={report.id} className="p-4">
            <p className="font-semibold text-brand-900">{report.title}</p>
            <p className="font-mono text-xs text-brand-700">{report.reference}</p>
            <p className="mt-2 text-sm text-muted">{report.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {INSTITUTIONS.filter((item) => item.active).map((item) => (
                <Button key={item.id} size="sm" variant="outline" onClick={() => assign(report.id, item.id, session)}>
                  Assign to {item.name}
                </Button>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
