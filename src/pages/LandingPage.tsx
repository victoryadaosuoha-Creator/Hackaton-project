import { MapPinned, Megaphone } from 'lucide-react'
import waterfront from '@/assets/waterfront.svg'
import { ButtonLink } from '@/components/ui/Button'
import { useAppState } from '@/context/AppState'
import { useI18n } from '@/i18n/LanguageContext'
import { PublicLayout } from '@/layouts/PublicLayout'
import { resolutionRate, unresolvedCount } from '@/utils/stats'

export function LandingPage() {
  const { t } = useI18n()
  const { reports } = useAppState()
  const resolvedShare = resolutionRate(reports)

  const stats = [
    { value: String(reports.length), label: 'Reports in this demo', hint: 'Sample records in this browser' },
    {
      value: resolvedShare == null ? 'No data' : `${resolvedShare}%`,
      label: 'Resolved share',
      hint: 'Missing data is shown as “No data”, not zero',
    },
    { value: '4', label: 'Sample localities', hint: 'Demonstration list' },
    { value: String(unresolvedCount(reports)), label: 'Not yet resolved', hint: 'Any status other than Resolved' },
  ]

  return (
    <PublicLayout>
      <section className="relative overflow-hidden">
        <img
          src={waterfront}
          alt="River waterfront with colourful traditional wooden boats at warm sunset"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-950/55 via-brand-900/25 to-transparent" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
          <div className="max-w-xl text-white">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-100">{t('hero.kicker')}</p>
            <h1 className="font-display mt-4 text-4xl leading-[1.08] font-semibold sm:text-5xl lg:text-6xl">
              {t('hero.title')}
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-white/90 sm:text-base">{t('hero.body')}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink to="/report" size="lg">
                <Megaphone size={18} />
                {t('hero.report')}
              </ButtonLink>
              <ButtonLink to="/map" variant="secondary" size="lg">
                <MapPinned size={18} />
                {t('hero.map')}
              </ButtonLink>
            </div>
          </div>
          <div className="relative hidden justify-end lg:flex">
            <p className="font-display absolute top-2 right-0 max-w-[11rem] rotate-[-8deg] text-right text-lg leading-snug text-cream/90 italic">
              The Gambia: The Smiling Coast of West Africa
            </p>
          </div>
        </div>
        <div className="relative bg-gradient-to-t from-brand-900/80 to-transparent">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-6 sm:grid-cols-4 sm:px-6">
            {stats.map((stat) => (
              <div key={stat.label} className="text-white">
                <p className="text-2xl font-extrabold sm:text-3xl">{stat.value}</p>
                <p className="text-sm font-semibold text-brand-100">{stat.label}</p>
                <p className="text-[11px] text-white/70">{stat.hint}</p>
              </div>
            ))}
          </div>
        </div>
        <svg className="block w-full text-brand-600" viewBox="0 0 1440 80" aria-hidden="true">
          <path fill="currentColor" d="M0 40c180 40 360-40 540 0s360 40 540 0 270-20 360 0v40H0z" />
          <path fill="#14635D" d="M0 58c200 28 380-28 560 0s360 28 520 0 240-12 360 8v14H0z" />
        </svg>
      </section>
    </PublicLayout>
  )
}
