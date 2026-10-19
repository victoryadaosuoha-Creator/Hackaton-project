export const LANGS = ['en', 'wo', 'mn'] as const
export type Lang = (typeof LANGS)[number]

export const LANG_LABELS: Record<Lang, string> = {
  en: 'English',
  wo: 'Wolof',
  mn: 'Mandinka',
}

export const EN: Record<string, string> = {
  'nav.home': 'Home',
  'nav.how': 'How It Works',
  'nav.map': 'Community Map',
  'nav.about': 'About',
  'nav.track': 'Track',
  'nav.signin': 'Sign In',
  'nav.start': 'Get Started',
  'lang.note': 'Verified Wolof and Mandinka translations are not yet supplied. Missing phrases appear in English.',
  'demo.local': 'Demonstration mode — reports are stored in this browser only. Not an official government channel. Supabase is not connected.',
  'demo.configured':
    'Supabase credentials are present. Live persistence is used only when a submit or lookup succeeds against the project. Failures are not shown as success.',
  'hero.kicker': 'Community · Transparency · Progress',
  'hero.title': 'Your voice. Our community. A better Gambia.',
  'hero.body':
    'Report public issues, track their progress, and help create safer, cleaner, and stronger communities across The Gambia.',
  'hero.report': 'Report a Problem',
  'hero.map': 'Explore Community Map',
  'footer.disclaimer':
    'This is a demonstration interface, not an official government reporting channel. Sample figures are not official statistics.',
  'footer.privacy': 'Privacy notice',
  'footer.track': 'Track a report',
}

export const WO: Partial<Record<string, string>> = {
  'nav.home': 'Kër',
  'nav.how': 'Naka la dox',
  'nav.map': 'Karte',
  'nav.about': 'Ci mbir mi',
  'nav.track': 'Topp',
  'nav.signin': 'Dugg',
  'nav.start': 'Tàmbali',
  'hero.report': 'Joxe ab jafe-jafe',
}

export const MN: Partial<Record<string, string>> = {
  'nav.home': 'Suu',
  'nav.how': 'A be kee la',
  'nav.map': 'Katiroo',
  'nav.about': 'Ñaatoo',
  'nav.track': 'Nooma',
  'nav.signin': 'Don',
  'nav.start': 'A dati',
  'hero.report': 'Safee kuŋo',
}

const tables: Record<Lang, Partial<Record<string, string>>> = {
  en: EN,
  wo: WO,
  mn: MN,
}

export function translate(key: string, lang: Lang): string {
  return tables[lang][key] ?? EN[key] ?? key
}
