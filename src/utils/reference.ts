import { REFERENCE_PATTERN } from '@/data/catalog'

export function generateReference(now = new Date()): string {
  const year = now.getUTCFullYear()
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  const bytes = new Uint8Array(5)
  crypto.getRandomValues(bytes)
  for (const byte of bytes) suffix += alphabet[byte % alphabet.length]
  return `DG-${year}-${suffix}`
}

export function generateIdempotencyKey(): string {
  return crypto.randomUUID()
}

export function normaliseReference(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

export function isValidReferenceFormat(value: string): boolean {
  return REFERENCE_PATTERN.test(normaliseReference(value))
}
