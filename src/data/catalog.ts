import type { ReportCategory, ReportStatus, RoutingTable } from './types'

export const CATEGORY_LABELS: Record<ReportCategory, string> = {
  waste_sanitation: 'Waste & Sanitation',
  roads_transport: 'Roads & Transport',
  water_drainage: 'Water & Drainage',
  electricity_streetlights: 'Electricity & Streetlights',
  public_safety: 'Public Safety',
  public_facilities: 'Public Facilities',
  environmental: 'Environmental Issues',
  other: 'Other',
}

export const STATUS_LABELS: Record<ReportStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
}

export const COMMUNITIES = [
  { id: 'banjul', name: 'Banjul', lat: 13.4549, lng: -16.579 },
  { id: 'serrekunda', name: 'Serrekunda', lat: 13.4383, lng: -16.6781 },
  { id: 'brikama', name: 'Brikama', lat: 13.2714, lng: -16.6494 },
  { id: 'farafenni', name: 'Farafenni', lat: 13.5667, lng: -15.6 },
] as const

export const INSTITUTIONS = [
  { id: 'bcc', name: 'Banjul City Council', active: true, demo: true as const },
  { id: 'kanifing', name: 'Kanifing Municipal Council', active: true, demo: true as const },
]

export const DEPARTMENTS = [
  { id: 'sanitation', name: 'Sanitation', institutionId: 'bcc' },
  { id: 'roads', name: 'Roads & Works', institutionId: 'bcc' },
  { id: 'utilities', name: 'Utilities Liaison', institutionId: 'kanifing' },
]

export const DEFAULT_ROUTING: RoutingTable = {
  waste_sanitation: 'bcc',
  roads_transport: 'bcc',
  water_drainage: 'bcc',
  electricity_streetlights: 'kanifing',
  public_safety: 'bcc',
  public_facilities: 'bcc',
  environmental: 'kanifing',
  other: null,
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const REFERENCE_PATTERN = /^DG-\d{4}-[A-Z0-9]{4,8}$/i
