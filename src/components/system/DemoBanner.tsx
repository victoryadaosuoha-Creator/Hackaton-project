import { useI18n } from '@/i18n/LanguageContext'
import { getBackendMode } from '@/services/backendMode'

export function DemoBanner() {
  const mode = getBackendMode()
  const { t } = useI18n()
  return (
    <div className="bg-gold/20 px-3 py-1.5 text-center text-[11px] font-semibold tracking-wide text-brand-900">
      {mode === 'demo' ? t('demo.local') : t('demo.configured')}
    </div>
  )
}
