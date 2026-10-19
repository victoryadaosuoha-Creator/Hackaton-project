import { COMMUNITIES, INSTITUTIONS } from '@/data/catalog'
import { SEED_REPORTS, SEED_ROUTING } from '@/data/seed'
import type {
  AuditEntry,
  DraftReport,
  PublicReport,
  Report,
  ReportCategory,
  ReportStatus,
  RoutingTable,
  Session,
} from '@/data/types'
import { generateIdempotencyKey, generateReference, isValidReferenceFormat, normaliseReference } from '@/utils/reference'
import { allowedStatusTransition } from '@/utils/validation'

const KEY = 'deglu-gambia.store.v1'
const SESSION_KEY = 'deglu-gambia.session.v1'

type Persisted = {
  reports: Report[]
  routing: RoutingTable
  audit: AuditEntry[]
}

function community(id: string) {
  return COMMUNITIES.find((item) => item.id === id)
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { reports: SEED_REPORTS, routing: SEED_ROUTING, audit: [] }
    const parsed = JSON.parse(raw) as Persisted
    if (!Array.isArray(parsed.reports) || !parsed.routing) {
      return { reports: SEED_REPORTS, routing: SEED_ROUTING, audit: [] }
    }
    const seedIds = new Set(SEED_REPORTS.map((r) => r.id))
    const extras = parsed.reports.filter((r) => r && r.id && !seedIds.has(r.id))
    return {
      reports: [...SEED_REPORTS, ...extras],
      routing: { ...SEED_ROUTING, ...parsed.routing },
      audit: Array.isArray(parsed.audit) ? parsed.audit : [],
    }
  } catch {
    return { reports: SEED_REPORTS, routing: SEED_ROUTING, audit: [] }
  }
}

function save(state: Persisted) {
  const extras = state.reports.filter((r) => !r.id.startsWith('seed-'))
  localStorage.setItem(
    KEY,
    JSON.stringify({ reports: extras, routing: state.routing, audit: state.audit }),
  )
}

function institutionName(id: string | null) {
  return INSTITUTIONS.find((item) => item.id === id)?.name ?? 'Unassigned review queue'
}

export function listReports(): Report[] {
  return load().reports.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getRouting(): RoutingTable {
  return load().routing
}

export function getAudit(): AuditEntry[] {
  return load().audit
}

export function findReport(reference: string): { kind: 'invalid' } | { kind: 'missing' } | { kind: 'ok'; report: Report } {
  const value = normaliseReference(reference)
  if (!isValidReferenceFormat(value)) return { kind: 'invalid' }
  const report = load().reports.find((item) => item.reference.toUpperCase() === value)
  if (!report) return { kind: 'missing' }
  return { kind: 'ok', report }
}

export function getReportById(id: string): Report | undefined {
  return load().reports.find((item) => item.id === id)
}

export function createDraft(): DraftReport {
  return {
    title: '',
    description: '',
    category: '',
    communityId: '',
    landmark: '',
    lat: null,
    lng: null,
    transcript: '',
    voiceDurationSeconds: 0,
    idempotencyKey: generateIdempotencyKey(),
  }
}

export function submitReport(draft: DraftReport): Report {
  const state = load()
  const existing = state.reports.find((item) => item.idempotencyKey === draft.idempotencyKey)
  if (existing) return existing

  const place = community(draft.communityId)
  const institutionId = draft.category ? state.routing[draft.category] : null
  const now = new Date().toISOString()
  const used = new Set(state.reports.map((item) => item.reference))
  let reference = generateReference()
  while (used.has(reference)) reference = generateReference()

  const report: Report = {
    id: crypto.randomUUID(),
    reference,
    title: draft.title.trim(),
    description: draft.description.trim(),
    category: draft.category as ReportCategory,
    status: 'submitted',
    communityId: draft.communityId,
    landmark: draft.landmark.trim(),
    locationLabel: `${place?.name ?? 'Unknown'} · ${draft.landmark.trim()}`,
    lat: draft.lat ?? place?.lat ?? 13.45,
    lng: draft.lng ?? place?.lng ?? -16.57,
    createdAt: now,
    updatedAt: now,
    supportCount: 1,
    attachment: draft.attachment,
    transcript: draft.transcript || undefined,
    voiceDurationSeconds: draft.voiceDurationSeconds || undefined,
    institutionId,
    assignment: institutionId ? 'assigned' : 'unassigned',
    persistence: 'local_demo',
    idempotencyKey: draft.idempotencyKey,
    demo: true,
    updates: [
      {
        id: crypto.randomUUID(),
        at: now,
        status: 'submitted',
        publicNote: institutionId
          ? 'Report received and routed using the current category configuration.'
          : 'Report received. Routing is unavailable, so this was placed in the administrative review queue.',
        internalNote: '',
        authorRole: 'citizen',
        authorLabel: 'Public form',
      },
    ],
  }
  state.reports.push(report)
  save(state)
  return report
}

export function supportReport(id: string): Report | undefined {
  const state = load()
  const report = state.reports.find((item) => item.id === id)
  if (!report) return undefined
  report.supportCount += 1
  report.updatedAt = new Date().toISOString()
  save(state)
  return report
}

export function updateReportStatus(input: {
  id: string
  status: ReportStatus
  publicNote: string
  internalNote: string
  session: Session
}): { ok: true; report: Report } | { ok: false; error: string } {
  const state = load()
  const report = state.reports.find((item) => item.id === input.id)
  if (!report) return { ok: false, error: 'Report not found.' }
  if (!input.session.staffActive) return { ok: false, error: 'Staff profile is not active.' }
  if (input.session.role === 'institution') {
    if (!input.session.institutionId || report.institutionId !== input.session.institutionId) {
      return { ok: false, error: 'This report is not assigned to your institution.' }
    }
  } else if (input.session.role !== 'admin') {
    return { ok: false, error: 'Not authorised to update status.' }
  }
  if (!allowedStatusTransition(report.status, input.status)) {
    return { ok: false, error: 'That status change is not allowed.' }
  }
  const now = new Date().toISOString()
  report.status = input.status
  report.updatedAt = now
  if (input.status !== 'submitted' && report.assignment === 'unassigned' && input.session.role === 'admin') {
    report.assignment = 'assigned'
  }
  report.updates.push({
    id: crypto.randomUUID(),
    at: now,
    status: input.status,
    publicNote: input.publicNote.trim(),
    internalNote: input.internalNote.trim(),
    authorRole: input.session.role,
    authorLabel: input.session.label,
  })
  save(state)
  return { ok: true, report }
}

export function updateRouting(category: ReportCategory, institutionId: string | null, session: Session) {
  if (session.role !== 'admin') throw new Error('Only administrators can change routing.')
  const state = load()
  state.routing[category] = institutionId
  state.audit.unshift({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actor: session.label,
    action: 'routing.update',
    detail: `${category} → ${institutionName(institutionId)}`,
  })
  save(state)
}

export function assignUnassigned(id: string, institutionId: string, session: Session) {
  if (session.role !== 'admin') throw new Error('Only administrators can assign unassigned reports.')
  const state = load()
  const report = state.reports.find((item) => item.id === id)
  if (!report) return
  report.institutionId = institutionId
  report.assignment = 'assigned'
  report.status = report.status === 'submitted' ? 'assigned' : report.status
  const now = new Date().toISOString()
  report.updatedAt = now
  report.updates.push({
    id: crypto.randomUUID(),
    at: now,
    status: report.status,
    publicNote: `Assigned to ${institutionName(institutionId)}.`,
    internalNote: '',
    authorRole: 'admin',
    authorLabel: session.label,
  })
  state.audit.unshift({
    id: crypto.randomUUID(),
    at: now,
    actor: session.label,
    action: 'report.assign',
    detail: `${report.reference} → ${institutionName(institutionId)}`,
  })
  save(state)
}

export function toPublicReport(report: Report): PublicReport {
  const { attachment, updates, ...rest } = report
  return {
    ...rest,
    hasLocalAttachment: Boolean(attachment),
    updates: updates.map((item) => ({
      id: item.id,
      at: item.at,
      status: item.status,
      publicNote: item.publicNote,
      authorLabel: item.authorLabel,
    })),
  }
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

export function saveSession(session: Session | null) {
  if (!session) localStorage.removeItem(SESSION_KEY)
  else localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function demoAccounts(): Session[] {
  return [
    { role: 'citizen', label: 'Citizen (demo)', institutionId: null, staffActive: false, isDemo: true },
    {
      role: 'institution',
      label: 'Awa Jallow · Banjul City Council',
      institutionId: 'bcc',
      staffActive: true,
      isDemo: true,
    },
    {
      role: 'institution',
      label: 'Inactive staff (access denied)',
      institutionId: 'bcc',
      staffActive: false,
      isDemo: true,
    },
    { role: 'admin', label: 'Platform administrator (demo)', institutionId: null, staffActive: true, isDemo: true },
  ]
}
