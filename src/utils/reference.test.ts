import { describe, expect, it } from 'vitest'
import { generateIdempotencyKey, generateReference, isValidReferenceFormat, normaliseReference } from './reference'

describe('tracking references', () => {
  it('generates a unique-looking DG-YEAR-suffix code', () => {
    const value = generateReference(new Date('2026-10-19T00:00:00Z'))
    expect(value.startsWith('DG-2026-')).toBe(true)
    expect(isValidReferenceFormat(value)).toBe(true)
  })

  it('normalises spacing and case', () => {
    expect(normaliseReference(' dg-2026-0001 ')).toBe('DG-2026-0001')
  })

  it('rejects malformed codes', () => {
    expect(isValidReferenceFormat('ABC')).toBe(false)
    expect(isValidReferenceFormat('DG-26-1')).toBe(false)
  })

  it('creates an idempotency key', () => {
    expect(generateIdempotencyKey()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })
})
