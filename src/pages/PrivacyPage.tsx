import { PublicLayout } from '@/layouts/PublicLayout'

export function PrivacyPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-4xl text-brand-900">Privacy notice</h1>
        <div className="mt-6 space-y-3 text-sm leading-relaxed text-muted">
          <p>Basic reporting does not require your name or an account.</p>
          <p>
            A report stores the description you type, a category, a locality, a landmark or street, an approximate map
            point, and a generated tracking reference. Do not include unnecessary personal information in descriptions or
            photographs.
          </p>
          <p>
            In demonstration mode, records stay in this browser. When Supabase is connected and a submit succeeds,
            records are stored in that project under the published access policies.
          </p>
          <p>
            Public tracking shows only fields approved for public display. Internal staff notes, private storage paths,
            and authentication details are not shown on the tracking page.
          </p>
          <p>
            A tracking reference is not an unrestricted access token for confidential information. Retention, deletion,
            and moderation rules for an operational deployment have not been finalised.
          </p>
          <p>Voice recordings remain on this device unless a separate upload capability is approved and implemented.</p>
        </div>
      </div>
    </PublicLayout>
  )
}
