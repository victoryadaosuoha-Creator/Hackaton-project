export const REPORT_STATUSES = [
  'submitted',
  'under_review',
  'assigned',
  'in_progress',
  'resolved',
] as const

export type ReportStatus = (typeof REPORT_STATUSES)[number]

export const REPORT_CATEGORIES = [
  'waste_sanitation',
  'roads_transport',
  'water_drainage',
  'electricity_streetlights',
  'public_safety',
  'public_facilities',
  'environmental',
  'other',
] as const

export type ReportCategory = (typeof REPORT_CATEGORIES)[number]

export const USER_ROLES = ['citizen', 'institution', 'admin'] as const

export type UserRole = (typeof USER_ROLES)[number]

export type PersistenceMode = 'local_demo' | 'supabase'

export type Community = {
  id: string
  name: string
  lat: number
  lng: number
}

export type ReportUpdate = {
  id: string
  at: string
  status: ReportStatus
  publicNote: string
  internalNote: string
  authorRole: UserRole
  authorLabel: string
}

export type LocalAttachment = {
  name: string
  mime: string
  size: number
  dataUrl: string
  uploadedToStorage: false
}

export type Report = {
  id: string
  reference: string
  title: string
  description: string
  category: ReportCategory
  status: ReportStatus
  communityId: string
  landmark: string
  locationLabel: string
  lat: number
  lng: number
  createdAt: string
  updatedAt: string
  supportCount: number
  attachment?: LocalAttachment
  voiceDurationSeconds?: number
  transcript?: string
  institutionId: string | null
  assignment: 'assigned' | 'unassigned'
  updates: ReportUpdate[]
  persistence: PersistenceMode
  idempotencyKey: string
  demo: boolean
}

export type Institution = {
  id: string
  name: string
  active: boolean
  demo: boolean
}

export type Department = {
  id: string
  name: string
  institutionId: string
}

export type RoutingTable = Record<ReportCategory, string | null>

export type AuditEntry = {
  id: string
  at: string
  actor: string
  action: string
  detail: string
}

export type Session = {
  role: UserRole
  label: string
  institutionId: string | null
  staffActive: boolean
  isDemo: boolean
  userId?: string
}

export type PublicReportUpdate = {
  id: string
  at: string
  status: ReportStatus
  publicNote: string
  authorLabel: string
}

export type PublicReport = Omit<Report, 'updates' | 'attachment'> & {
  updates: PublicReportUpdate[]
  hasLocalAttachment: boolean
}

export type DraftReport = {
  title: string
  description: string
  category: ReportCategory | ''
  communityId: string
  landmark: string
  lat: number | null
  lng: number | null
  attachment?: LocalAttachment
  transcript: string
  voiceDurationSeconds: number
  idempotencyKey: string
}
