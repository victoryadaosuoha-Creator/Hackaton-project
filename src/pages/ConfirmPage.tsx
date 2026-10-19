import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { Report } from '@/data/types'
import { PublicLayout } from '@/layouts/PublicLayout'
import { trackReference } from '@/services/reportsApi'
import { findReport } from '@/services/store'

export function ConfirmPage() {
  const { reference = '' } = useParams()
  const location = useLocation()
  const submitted = (location.state as { report?: Report } | null)?.report
  const local = findReport(reference)
  const [report, setReport] = useState<Report | null>(
    submitted && submitted.reference === reference
      ? submitted
      : local.kind === 'ok'
        ? local.report
        : null,
  )
  const [loading, setLoading] = useState(!report)

  useEffect(() => {
    if (report) return
    void trackReference(reference).then((result) => {
      if (result.kind === 'ok') {
        setReport(result.report as unknown as Report)
      }
      setLoading(false)
    })
  }, [reference, report])

  return (
    <PublicLayout>
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        {loading ? <p className="text-center text-sm text-muted">Checking the submission result…</p> : null}
        {!loading && report ? (
          <Card className="p-6 text-center">
            <p className="text-xs font-bold tracking-widest text-brand-700 uppercase">Report received</p>
            <h1 className="font-display mt-2 text-3xl text-brand-900">Keep this reference</h1>
            <p className="mt-4 font-mono text-xl font-bold text-brand-800">{report.reference}</p>
            <p className="mt-3 text-sm text-muted">
              {report.persistence === 'local_demo'
                ? 'This is a local demonstration record stored in this browser. It is not a Supabase case file.'
                : 'This report was stored in Supabase.'}
            </p>
            <ButtonLink to={`/track/${report.reference}`} className="mt-6">
              View public timeline
            </ButtonLink>
          </Card>
        ) : null}
        {!loading && !report ? (
          <Card className="p-6 text-center">
            <h1 className="font-display text-3xl text-brand-900">No confirmation is available</h1>
            <p className="mt-3 text-sm text-muted">
              A tracking reference is shown only after a report is successfully stored. This page does not invent a success
              message.
            </p>
            <ButtonLink to="/report" className="mt-6">
              Return to the form
            </ButtonLink>
          </Card>
        ) : null}
      </div>
    </PublicLayout>
  )
}
