import { Link } from 'react-router-dom'
import { useI18n } from '@/i18n/LanguageContext'

export function PublicFooter() {
  const { t } = useI18n()
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="max-w-2xl">{t('footer.disclaimer')}</p>
        <div className="flex flex-wrap gap-4 font-semibold text-brand-800">
          <Link to="/privacy">{t('footer.privacy')}</Link>
          <Link to="/track">{t('footer.track')}</Link>
        </div>
      </div>
    </footer>
  )
}
