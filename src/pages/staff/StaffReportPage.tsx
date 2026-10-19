import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, Select, TextArea } from '@/components/ui/Field'
import { ProgressTimeline } from '@/components/ui/Timeline'
import { useAppState } from '@/context/AppState'
import { CATEGORY_LABELS, INSTITUTIONS, STATUS_LABELS } from '@/data/catalog'
import { REPORT_STATUSES, type ReportStatus } from '@/data/types'
import { formatDateTime } from '@/utils/dates'
import { allowedStatusTransition } from '@/utils/validation'

export function StaffReportPage() {
  const { id = '' } = useParams()
  const { reports, session, updateStatus } = useAppState()
  const report = reports.find((item) => item.id === id)
  const [status, setStatus] = useState<ReportStatus>(report?.status ?? 'submitted')
  const [publicNote, setPublicNote] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!report || !session) {
    return <p>Report not found in this workspace.</p>
  }

  const allowed = REPORT_STATUSES.filter((item) => allowedStatusTransition(report.status, item))

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/staff" className="text-sm font-semibold text-brand-800">
        Back to inbox
      </Link>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-brand-900">{report.title}</h1>
          <p className="mt-1 font-mono text-sm text-brand-700">{report.reference}</p>
        </div>
        <StatusBadge status={report.status} />
      </div>
      <p className="mt-3 text-sm text-muted">{report.description}</p>
      <p className="mt-2 text-xs text-muted">
        {CATEGORY_LABELS[report.category]} · {report.locationLabel} ·{' '}
        {INSTITUTIONS.find((item) => item.id === report.institutionId)?.name ?? 'Unassigned'}
      </p>
      <div className="mt-6">
        <ProgressTimeline current={report.status} />
      </div>
      <Card className="mt-6 p-5">
        <h2 className="font-bold text-brand-900">Update status</h2>
        <p className="mt-1 text-xs text-muted">Changes are recorded with a history entry. Public notes appear on tracking; internal notes do not.</p>
        <div className="mt-4 space-y-3">
          <Field label="New status" htmlFor="status">
            <Select id="status" value={status} onChange={(event) => setStatus(event.target.value as ReportStatus)}>
              {allowed.map((item) => (
                <option key={item} value={item}>
                  {STATUS_LABELS[item]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Public update" htmlFor="publicNote">
            <TextArea id="publicNote" value={publicNote} onChange={(event) => setPublicNote(event.target.value)} />
          </Field>
          <Field label="Internal note" htmlFor="internalNote" hint="Not shown on the public tracking page.">
            <TextArea id="internalNote" value={internalNote} onChange={(event) => setInternalNote(event.target.value)} />
          </Field>
          {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
          <Button
            onClick={() => {
              const result = updateStatus({
                id: report.id,
                status,
                publicNote,
                internalNote,
                session,
              })
              if (!result.ok) setError(result.error)
              else {
                setError(null)
                setPublicNote('')
                setInternalNote('')
              }
            }}
          >
            Save update
          </Button>
        </div>
      </Card>
      <ol className="mt-6 space-y-3">
        {report.updates.map((item) => (
          <li key={item.id} className="rounded-xl border border-line bg-white p-3">
            <p className="text-sm font-semibold text-brand-900">{STATUS_LABELS[item.status]}</p>
            <p className="text-sm">{item.publicNote}</p>
            {item.internalNote ? (
              <p className="mt-1 text-xs text-amber-800">Internal: {item.internalNote}</p>
            ) : null}
            <p className="mt-1 text-xs text-muted">
              {formatDateTime(item.at)} · {item.authorLabel}
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
}
