import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PublicLayout } from '@/layouts/PublicLayout'

const steps = [
  { title: 'Describe the problem', body: 'Choose a category, write what is happening, and optionally review assistant suggestions before they are applied.' },
  { title: 'Add a locality', body: 'Select a community and a nearby landmark or street. Approximate map points are used, not private addresses.' },
  { title: 'Submit and receive a reference', body: 'A tracking code is shown only after the report is stored. Local demo copies are labelled separately from Supabase records.' },
  { title: 'Follow the timeline', body: 'Use the reference to see public status updates. Internal staff notes stay private.' },
]

export function HowItWorksPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-xs font-bold tracking-[0.2em] text-brand-700 uppercase">How it works</p>
        <h1 className="font-display mt-2 text-4xl text-brand-900">Four steps from a public issue to a tracked record</h1>
        <div className="mt-8 space-y-4">
          {steps.map((step, index) => (
            <Card key={step.title} className="p-5">
              <p className="text-xs font-bold text-brand-600">Step {index + 1}</p>
              <h2 className="mt-1 text-lg font-bold text-brand-900">{step.title}</h2>
              <p className="mt-1 text-sm text-muted">{step.body}</p>
            </Card>
          ))}
        </div>
        <ButtonLink to="/report" className="mt-8">
          Report a Problem
        </ButtonLink>
      </div>
    </PublicLayout>
  )
}
