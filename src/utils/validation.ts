import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/data/catalog'
import { REPORT_CATEGORIES, type DraftReport, type ReportStatus } from '@/data/types'

export type FieldErrors = Partial<Record<keyof DraftReport | 'location', string>>

export function validateDraft(draft: DraftReport, step: number): FieldErrors {
  const errors: FieldErrors = {}
  if (step >= 1) {
    if (!draft.title.trim()) errors.title = 'Enter a short issue title.'
    if (draft.title.trim().length > 80) errors.title = 'Keep the title under 80 characters.'
    if (!draft.description.trim()) errors.description = 'Describe the issue so others can understand it.'
    if (draft.description.trim().length < 12) {
      errors.description = 'Add a little more detail (at least 12 characters).'
    }
    if (!draft.category || !REPORT_CATEGORIES.includes(draft.category)) {
      errors.category = 'Select a category.'
    }
  }
  if (step >= 2) {
    if (!draft.communityId) errors.communityId = 'Choose a community or locality.'
    if (!draft.landmark.trim()) errors.landmark = 'Add a nearby landmark or street.'
    if (draft.lat == null || draft.lng == null) {
      errors.location = 'Choose a locality so an approximate map position can be recorded.'
    }
  }
  return errors
}

export function allowedStatusTransition(from: ReportStatus | string, to: ReportStatus | string): boolean {
  const order: ReportStatus[] = ['submitted', 'under_review', 'assigned', 'in_progress', 'resolved']
  const a = order.indexOf(from as ReportStatus)
  const b = order.indexOf(to as ReportStatus)
  if (a < 0 || b < 0) return false
  return b >= a
}

export async function inspectImageFile(file: File): Promise<string | null> {
  if (file.size > MAX_IMAGE_BYTES) return 'Photos must be 5 MB or smaller.'
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Use a JPEG, PNG, or WebP photograph.'
  }
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const jpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
  const png =
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47
  const webp =
    header[0] === 0x52 &&
    header[1] === 0x49 &&
    header[2] === 0x46 &&
    header[3] === 0x46 &&
    header[8] === 0x57 &&
    header[9] === 0x45 &&
    header[10] === 0x42 &&
    header[11] === 0x50
  if (!jpeg && !png && !webp) return 'The file contents do not match a permitted image type.'
  return null
}
