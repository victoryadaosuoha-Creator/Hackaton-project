import { describe, expect, it } from 'vitest'
import { translate } from './strings'

describe('language fallback', () => {
  it('falls back to English when a Wolof phrase is missing', () => {
    expect(translate('hero.title', 'wo')).toBe(translate('hero.title', 'en'))
  })

  it('uses a Wolof phrase when present', () => {
    expect(translate('nav.home', 'wo')).toBe('Kër')
  })
})
