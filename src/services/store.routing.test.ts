import { beforeEach, describe, expect, it } from 'vitest'
import { createDraft, demoAccounts, submitReport, updateRouting } from './store'

describe('category routing', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('routes using the current table and keeps unassigned reports', () => {
    const admin = demoAccounts().find((item) => item.role === 'admin')!
    updateRouting('other', null, admin)
    const draft = createDraft()
    draft.title = 'Shore debris'
    draft.description = 'Mixed debris along the walkway after the tide.'
    draft.category = 'other'
    draft.communityId = 'banjul'
    draft.landmark = 'Waterfront'
    draft.lat = 13.45
    draft.lng = -16.57
    const report = submitReport(draft)
    expect(report.assignment).toBe('unassigned')
    expect(report.institutionId).toBeNull()
  })

  it('rejects routing changes from non-admin sessions', () => {
    const staff = demoAccounts().find((item) => item.role === 'institution' && item.staffActive)!
    expect(() => updateRouting('waste_sanitation', 'bcc', staff)).toThrow()
  })
})
