import { LANGS, LANG_LABELS } from '@/i18n/strings'
import { useI18n } from '@/i18n/LanguageContext'

export function LanguageSwitch() {
  const { lang, setLang, usingFallback, t } = useI18n()
  return (
    <div className="flex flex-col items-end gap-1">
      <label className="sr-only" htmlFor="language">
        Language
      </label>
      <select
        id="language"
        value={lang}
        onChange={(event) => setLang(event.target.value as (typeof LANGS)[number])}
        className="rounded-lg border border-line bg-white px-2 py-1 text-sm font-semibold text-brand-800"
      >
        {LANGS.map((item) => (
          <option key={item} value={item}>
            {LANG_LABELS[item]}
          </option>
        ))}
      </select>
      {usingFallback ? <span className="max-w-[11rem] text-right text-[10px] text-muted">{t('lang.note')}</span> : null}
    </div>
  )
}
