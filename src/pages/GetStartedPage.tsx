import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PublicLayout } from '@/layouts/PublicLayout'

export function GetStartedPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-4xl text-brand-900">Start a public report</h1>
        <p className="mt-3 text-sm text-muted">
          Citizen accounts are not part of this MVP. You can submit a report without signing in. Staff and administrators
          use the sign-in page.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-bold text-brand-900">Report an issue</h2>
            <p className="mt-2 text-sm text-muted">Describe the problem, choose a locality, and receive a tracking reference after a successful save.</p>
            <ButtonLink to="/report" className="mt-4">
              Open the form
            </ButtonLink>
          </Card>
          <Card className="p-5">
            <h2 className="font-bold text-brand-900">Track a reference</h2>
            <p className="mt-2 text-sm text-muted">Look up a code such as DG-2026-0001 to see the public timeline.</p>
            <ButtonLink to="/track" variant="outline" className="mt-4">
              Track a report
            </ButtonLink>
          </Card>
        </div>
      </div>
    </PublicLayout>
  )
}
