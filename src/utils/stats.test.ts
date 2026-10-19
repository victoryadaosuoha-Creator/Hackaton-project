import { describe, expect, it } from 'vitest'
import { SEED_REPORTS } from '@/data/seed'
import { averageHandlingHours, resolutionRate } from './stats'

describe('dashboard calculations', () => {
  it('returns null resolution rate when there are no reports', () => {
    expect(resolutionRate([])).toBeNull()
  })

  it('computes a percentage when reports exist', () => {
    const rate = resolutionRate(SEED_REPORTS)
    expect(rate).not.toBeNull()
    expect(rate).toBeGreaterThanOrEqual(0)
  })

  it('returns null handling time when nothing is resolved', () => {
    expect(averageHandlingHours(SEED_REPORTS.filter((item) => item.status !== 'resolved'))).toBeNull()
  })
})
