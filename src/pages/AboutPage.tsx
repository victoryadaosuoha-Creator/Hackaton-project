import { PublicLayout } from '@/layouts/PublicLayout'

export function AboutPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-xs font-bold tracking-[0.2em] text-brand-700 uppercase">About</p>
        <h1 className="font-display mt-2 text-4xl text-brand-900">Déglu Gambia</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Déglu Gambia is a civic reporting prototype. It helps people describe a public problem, receive a tracking
          reference, and follow a public status timeline. Institution staff can update assigned reports. Administrators
          can maintain category routing and review unassigned cases.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          This demonstration is not an official government channel and does not claim live institutional integrations.
          Notifications, connected AI, and persistent photograph storage are specified for later phases and are not
          marked as operational here.
        </p>
      </div>
    </PublicLayout>
  )
}
