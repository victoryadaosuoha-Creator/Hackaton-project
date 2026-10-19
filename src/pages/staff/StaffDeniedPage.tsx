import { ButtonLink } from '@/components/ui/Button'
import { PublicLayout } from '@/layouts/PublicLayout'

export function StaffDeniedPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-display text-4xl text-brand-900">Staff workspace unavailable</h1>
        <p className="mt-3 text-sm text-muted">
          This account is authenticated or selected, but it does not have an active staff profile assigned to an
          institution. Access is denied.
        </p>
        <ButtonLink to="/signin" className="mt-6">
          Return to sign-in
        </ButtonLink>
      </div>
    </PublicLayout>
  )
}
