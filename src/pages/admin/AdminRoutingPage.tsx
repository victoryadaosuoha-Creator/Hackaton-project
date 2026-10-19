import { CATEGORY_LABELS, INSTITUTIONS } from '@/data/catalog'
import { REPORT_CATEGORIES } from '@/data/types'
import { Card } from '@/components/ui/Card'
import { useAppState } from '@/context/AppState'

export function AdminRoutingPage() {
  const { routing, session, setRouting } = useAppState()
  if (!session) return null

  return (
    <div>
      <h1 className="font-display text-3xl text-brand-900">Category routing</h1>
      <p className="mt-1 text-sm text-muted">
        Existing reports keep their original assignment when these rules change. Categories with no institution go to the
        review queue instead of being discarded.
      </p>
      <div className="mt-6 space-y-3">
        {REPORT_CATEGORIES.map((category) => (
          <Card key={category} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold text-brand-900">{CATEGORY_LABELS[category]}</p>
            <div className="flex flex-wrap gap-2">
              <select
                className="rounded-xl border border-line px-3 py-2 text-sm"
                value={routing[category] ?? ''}
                onChange={(event) => setRouting(category, event.target.value || null, session)}
              >
                <option value="">Unassigned / review queue</option>
                {INSTITUTIONS.filter((item) => item.active).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
