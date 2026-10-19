import type { DraftReport, PublicReport, Report } from '@/data/types'
import { isSupabaseConfigured } from './backendMode'
import { findReport, submitReport, toPublicReport } from './store'
import { getSupabase } from './supabaseClient'

export type SubmitResult =
  | { ok: true; report: Report }
  | { ok: false; error: string }

export async function submitDraft(draft: DraftReport, preferLocalDemo = false): Promise<SubmitResult> {
  if (!isSupabaseConfigured() || preferLocalDemo) {
    return { ok: true, report: submitReport(draft) }
  }

  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: 'Supabase is not available.' }

  const { data, error } = await supabase.rpc('submit_public_report', {
    p_title: draft.title.trim(),
    p_description: draft.description.trim(),
    p_category_id: draft.category,
    p_community_id: draft.communityId,
    p_landmark: draft.landmark.trim(),
    p_lat: draft.lat,
    p_lng: draft.lng,
    p_idempotency_key: draft.idempotencyKey,
  })

  if (error || !data) {
    return {
      ok: false,
      error:
        error?.message ??
        'The report was not stored in Supabase. No success confirmation was recorded. You can retry, or save a labelled local demonstration copy.',
    }
  }

  const payload = data as { id: string; reference: string }
  return {
    ok: true,
    report: {
      ...submitShape(draft, payload.reference, payload.id),
      persistence: 'supabase',
      demo: false,
    },
  }
}

function submitShape(draft: DraftReport, reference: string, id: string): Report {
  const now = new Date().toISOString()
  return {
    id,
    reference,
    title: draft.title.trim(),
    description: draft.description.trim(),
    category: draft.category as Report['category'],
    status: 'submitted',
    communityId: draft.communityId,
    landmark: draft.landmark.trim(),
    locationLabel: `${draft.communityId} · ${draft.landmark.trim()}`,
    lat: draft.lat ?? 13.45,
    lng: draft.lng ?? -16.57,
    createdAt: now,
    updatedAt: now,
    supportCount: 1,
    attachment: draft.attachment,
    institutionId: null,
    assignment: 'unassigned',
    persistence: 'supabase',
    idempotencyKey: draft.idempotencyKey,
    demo: false,
    updates: [
      {
        id: crypto.randomUUID(),
        at: now,
        status: 'submitted',
        publicNote: 'Report received.',
        internalNote: '',
        authorRole: 'citizen',
        authorLabel: 'Public form',
      },
    ],
  }
}

export type TrackResult =
  | { kind: 'invalid' }
  | { kind: 'missing' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; report: PublicReport; source: 'local_demo' | 'supabase' }

export async function trackReference(reference: string): Promise<TrackResult> {
  const local = findReport(reference)

  if (isSupabaseConfigured()) {
    const supabase = getSupabase()
    if (!supabase) return { kind: 'error', message: 'Supabase is not available. Retry when the connection is restored.' }
    const { data, error } = await supabase.rpc('track_public_report', { p_reference: reference })
    if (error) {
      if (local.kind === 'ok') {
        return { kind: 'ok', report: toPublicReport(local.report), source: 'local_demo' }
      }
      return { kind: 'error', message: 'The tracking request failed. You can retry.' }
    }
    const payload = data as { found?: boolean; report?: PublicReport }
    if (payload?.found && payload.report) {
      return {
        kind: 'ok',
        report: {
          ...payload.report,
          hasLocalAttachment: false,
          persistence: 'supabase',
          demo: false,
          supportCount: 0,
          lat: 13.45,
          lng: -16.57,
          institutionId: null,
          idempotencyKey: '',
        } as PublicReport,
        source: 'supabase',
      }
    }
    if (local.kind === 'ok') return { kind: 'ok', report: toPublicReport(local.report), source: 'local_demo' }
    if (local.kind === 'invalid') return local
    return { kind: 'missing' }
  }

  if (local.kind === 'ok') return { kind: 'ok', report: toPublicReport(local.report), source: 'local_demo' }
  return local
}
