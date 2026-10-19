import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AssistantPanel } from '@/components/reports/AssistantPanel'
import { EvidenceFields } from '@/components/reports/EvidenceFields'
import { LocationPicker } from '@/components/maps/LocationPicker'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field'
import { useAppState } from '@/context/AppState'
import { CATEGORY_LABELS, COMMUNITIES, INSTITUTIONS } from '@/data/catalog'
import { REPORT_CATEGORIES } from '@/data/types'
import { PublicLayout } from '@/layouts/PublicLayout'
import { isSupabaseConfigured } from '@/services/backendMode'
import { createDraft } from '@/services/store'
import { useToast } from '@/components/ui/Toast'
import { validateDraft } from '@/utils/validation'

export function ReportPage() {
  const { submit, routing } = useAppState()
  const toast = useToast()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState(createDraft)
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const errors = useMemo(() => validateDraft(draft, step), [draft, step])
  const hasErrors = Object.keys(errors).length > 0

  function patch(next: Partial<typeof draft>) {
    setDraft((current) => ({ ...current, ...next }))
  }

  function onCommunity(communityId: string) {
    const place = COMMUNITIES.find((item) => item.id === communityId)
    patch({
      communityId,
      lat: place?.lat ?? null,
      lng: place?.lng ?? null,
    })
  }

  async function onSubmit(preferLocalDemo = false) {
    const allErrors = validateDraft(draft, 3)
    if (Object.keys(allErrors).length) {
      setStep(Object.keys(allErrors).some((key) => key === 'communityId' || key === 'landmark' || key === 'location') ? 2 : 1)
      return
    }
    setBusy(true)
    setSubmitError(null)
    const result = await submit(draft, preferLocalDemo)
    setBusy(false)
    if (!result.ok) {
      setSubmitError(result.error)
      toast('Submission did not succeed. No confirmation was issued.')
      return
    }
    navigate(`/report/confirm/${result.report.reference}`, { replace: true, state: { report: result.report } })
  }

  const routedTo = draft.category ? routing[draft.category] : null
  const routedName = INSTITUTIONS.find((item) => item.id === routedTo)?.name ?? 'Administrative review queue'

  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-4xl text-brand-900">Report a problem</h1>
        <p className="mt-2 text-sm text-muted">Required fields are checked before submit. Valid entries are kept if something is missing.</p>
        <p className="mt-3 text-xs font-semibold text-brand-800">Step {step} of 3</p>

        {step === 1 ? (
          <Card className="mt-6 space-y-4 p-5">
            <Field label="Short title" htmlFor="title" error={errors.title}>
              <TextInput
                id="title"
                value={draft.title}
                aria-invalid={Boolean(errors.title)}
                onChange={(event) => patch({ title: event.target.value })}
              />
            </Field>
            <Field label="Category" htmlFor="category" error={errors.category}>
              <Select
                id="category"
                value={draft.category}
                aria-invalid={Boolean(errors.category)}
                onChange={(event) => patch({ category: event.target.value as typeof draft.category })}
              >
                <option value="">Select a category</option>
                {REPORT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Description"
              htmlFor="description"
              error={errors.description}
              hint="Do not include unnecessary personal information."
            >
              <TextArea
                id="description"
                value={draft.description}
                aria-invalid={Boolean(errors.description)}
                onChange={(event) => patch({ description: event.target.value })}
              />
            </Field>
            <AssistantPanel
              onApprove={(suggestion) =>
                patch({
                  category: suggestion.category ?? draft.category,
                  title: suggestion.title ?? draft.title,
                  description: suggestion.summary ? `${suggestion.summary}\n\n${draft.description}`.trim() : draft.description,
                })
              }
            />
          </Card>
        ) : null}

        {step === 2 ? (
          <Card className="mt-6 space-y-4 p-5">
            <Field label="Community or locality" htmlFor="community" error={errors.communityId}>
              <Select
                id="community"
                value={draft.communityId}
                aria-invalid={Boolean(errors.communityId)}
                onChange={(event) => onCommunity(event.target.value)}
              >
                <option value="">Select a locality</option>
                {COMMUNITIES.map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nearest landmark or street" htmlFor="landmark" error={errors.landmark}>
              <TextInput
                id="landmark"
                value={draft.landmark}
                aria-invalid={Boolean(errors.landmark)}
                onChange={(event) => patch({ landmark: event.target.value })}
              />
            </Field>
            <LocationPicker lat={draft.lat} lng={draft.lng} onPick={(lat, lng) => patch({ lat, lng })} />
            {errors.location ? <p className="text-xs font-medium text-red-700">{errors.location}</p> : null}
          </Card>
        ) : null}

        {step === 3 ? (
          <Card className="mt-6 space-y-4 p-5">
            <EvidenceFields draft={draft} onChange={patch} />
            <div className="rounded-xl bg-brand-50 p-4 text-sm">
              <p className="font-bold text-brand-900">Review</p>
              <p className="mt-1">{draft.title}</p>
              <p className="mt-1 text-muted">{draft.description}</p>
              <p className="mt-2 text-xs">
                Category: {draft.category ? CATEGORY_LABELS[draft.category] : '—'} · Routed to: {routedName}
              </p>
              <p className="mt-1 text-xs text-muted">
                {isSupabaseConfigured()
                  ? 'A reference is issued only if Supabase accepts the report.'
                  : 'This copy will be stored in this browser as a labelled demonstration record.'}
              </p>
            </div>
            {submitError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <p>{submitError}</p>
                <Button className="mt-2" size="sm" variant="outline" onClick={() => void onSubmit(true)}>
                  Save as local demonstration instead
                </Button>
              </div>
            ) : null}
          </Card>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep((value) => value - 1)}>
              Back
            </Button>
          ) : null}
          {step < 3 ? (
            <Button
              onClick={() => {
                if (hasErrors) return
                setStep((value) => value + 1)
              }}
            >
              Continue
            </Button>
          ) : (
            <Button disabled={busy} onClick={() => void onSubmit(false)}>
              {busy ? 'Submitting…' : 'Submit report'}
            </Button>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}
