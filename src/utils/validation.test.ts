import { describe, expect, it } from 'vitest'
import { createDraft } from '@/services/store'
import { allowedStatusTransition, validateDraft } from './validation'

describe('form validation', () => {
  it('keeps independent field errors', () => {
    const draft = createDraft()
    draft.title = 'Blocked drain'
    const errors = validateDraft(draft, 1)
    expect(errors.title).toBeUndefined()
    expect(errors.description).toBeTruthy()
    expect(errors.category).toBeTruthy()
  })

  it('requires locality details on step 2', () => {
    const draft = createDraft()
    draft.title = 'Blocked drain'
    draft.description = 'Water is standing after rain near the market.'
    draft.category = 'water_drainage'
    expect(validateDraft(draft, 2).communityId).toBeTruthy()
  })
})

describe('status transitions', () => {
  it('allows forward or same status only', () => {
    expect(allowedStatusTransition('submitted', 'in_progress')).toBe(true)
    expect(allowedStatusTransition('resolved', 'submitted')).toBe(false)
    expect(allowedStatusTransition('assigned', 'assigned')).toBe(true)
  })
})
