import { ButtonLink } from '@/components/ui/Button'
import { PublicLayout } from '@/layouts/PublicLayout'

export function NotFoundPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <p className="text-sm font-bold tracking-widest text-brand-700 uppercase">404</p>
        <h1 className="font-display mt-3 text-4xl text-brand-900">This page is not available.</h1>
        <p className="mt-3 text-muted">The route you opened is not part of the Déglu Gambia prototype.</p>
        <ButtonLink to="/" className="mt-6">
          Back to Home
        </ButtonLink>
      </div>
    </PublicLayout>
  )
}
