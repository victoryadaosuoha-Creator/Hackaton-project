import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { LANGS, translate, type Lang } from './strings'

const KEY = 'deglu-gambia.lang.v1'

type Value = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: string) => string
  usingFallback: boolean
}

const LanguageContext = createContext<Value | null>(null)

function readLang(): Lang {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw && (LANGS as readonly string[]).includes(raw)) return raw as Lang
  } catch {
    /* ignore */
  }
  return 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang)

  const value = useMemo<Value>(
    () => ({
      lang,
      setLang: (next) => {
        setLangState(next)
        localStorage.setItem(KEY, next)
      },
      t: (key) => translate(key, lang),
      usingFallback: lang !== 'en',
    }),
    [lang],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useI18n() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('LanguageProvider is missing')
  return value
}
