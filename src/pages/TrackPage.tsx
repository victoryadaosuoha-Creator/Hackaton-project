import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ProgressTimeline } from '@/components/ui/Timeline'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, TextInput } from '@/components/ui/Field'
import { StatusBadge } from '@/components/ui/Badge'
import { CATEGORY_LABELS } from '@/data/catalog'
import type { PublicReport } from '@/data/types'
import { PublicLayout } from '@/layouts/PublicLayout'
import { trackReference } from '@/services/reportsApi'
import { formatDateTime } from '@/utils/dates'

export function TrackPage() {
  const { reference: routeReference } = useParams()
  const navigate = useNavigate()
  const [value, setValue] = useState(routeReference ?? '')
  const [status, setStatus] = useState<'idle' | 'loading' | 'invalid' | 'missing' | 'error' | 'ok'>('idle')
  const [message, setMessage] = useState('')
  const [report, setReport] = useState<PublicReport | null>(null)
  const [source, setSource] = useState<'local_demo' | 'supabase' | null>(null)

  async function lookup(code: string) {
    setStatus('loading')
    const result = await trackReference(code)
    if (result.kind === 'invalid') {
      setStatus('invalid')
      setReport(null)
      setMessage('That does not look like a Déglu Gambia reference. Use a code such as DG-2026-0001.')
      return
    }
    if (result.kind === 'missing') {
      setStatus('missing')
      setReport(null)
      setMessage('No report matches that reference. Check the code and try again.')
      return
    }
    if (result.kind === 'error') {
      setStatus('error')
      setReport(null)
      setMessage(result.message)
      return
    }
    setStatus('ok')
    setReport(result.report)
    setSource(result.source)
    setMessage('')
  }

  useEffect(() => {
    if (routeReference) {
      setValue(routeReference)
      void lookup(routeReference)
    }
  }, [routeReference])

  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-4xl text-brand-900">Track a report</h1>
        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            navigate(`/track/${value.trim()}`)
          }}
        >
          <Field label="Report reference" htmlFor="reference" className="flex-1">
            <TextInput
              id="reference"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="DG-2026-0001"
              autoComplete="off"
            />
          </Field>
          <Button type="submit" className="sm:mt-7">
            Look up
          </Button>
        </form>

        {status === 'loading' ? <p className="mt-6 text-sm text-muted">Searching…</p> : null}
        {status === 'error' ? (
          <Card className="mt-6 p-5">
            <p className="text-sm text-red-800">{message}</p>
            <Button className="mt-3" size="sm" onClick={() => void lookup(value)}>
              Retry
            </Button>
          </Card>
        ) : null}
        {status === 'invalid' || status === 'missing' ? (
          <Card className="mt-6 p-5">
            <p className="text-sm text-brand-900">{message}</p>
          </Card>
        ) : null}
        {status === 'ok' && report ? (
          <Card className="mt-6 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-brand-900">{report.title}</h2>
                <p className="mt-1 font-mono text-sm text-brand-700">{report.reference}</p>
              </div>
              <StatusBadge status={report.status} />
            </div>
            <p className="mt-3 text-sm text-muted">{report.description}</p>
            <p className="mt-2 text-xs text-muted">
              {CATEGORY_LABELS[report.category]} · {report.locationLabel}
            </p>
            <p className="mt-1 text-xs font-semibold text-amber-800">
              {source === 'local_demo'
                ? 'Local demonstration record. Internal staff notes are not shown.'
                : 'Public fields from Supabase. Internal notes are not included.'}
            </p>
            {report.hasLocalAttachment ? (
              <p className="mt-1 text-xs text-muted">A photograph was attached locally and has not been uploaded to storage.</p>
            ) : null}
            <div className="mt-6">
              <ProgressTimeline current={report.status} />
            </div>
            <ol className="mt-6 space-y-3">
              {report.updates.map((item) => (
                <li key={item.id} className="border-l-2 border-brand-200 pl-3">
                  <p className="text-sm font-semibold text-brand-900">{item.publicNote || 'Status updated.'}</p>
                  <p className="text-xs text-muted">
                    {formatDateTime(item.at)} · {item.authorLabel}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        ) : null}
      </div>
    </PublicLayout>
  )
}
