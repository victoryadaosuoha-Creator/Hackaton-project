import type { Session } from '@/data/types'
import { isSupabaseConfigured } from './backendMode'
import { getSupabase } from './supabaseClient'

export async function signInWithPassword(email: string, password: string): Promise<
  { ok: true; session: Session } | { ok: false; error: string }
> {
  const supabase = getSupabase()
  if (!isSupabaseConfigured() || !supabase) {
    return { ok: false, error: 'Supabase Auth is not configured. Use a labelled demonstration account, or set the public environment variables.' }
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    return { ok: false, error: error?.message ?? 'Sign-in failed.' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, institution_id, display_name, active, institutions(slug)')
    .eq('id', data.user.id)
    .maybeSingle()

  if (profileError) {
    await supabase.auth.signOut()
    return { ok: false, error: 'Could not load a staff profile.' }
  }

  if (!profile || !profile.active) {
    await supabase.auth.signOut()
    return { ok: false, error: 'denied' }
  }

  const institution = profile.institutions as { slug?: string } | { slug?: string }[] | null
  const slug = Array.isArray(institution) ? institution[0]?.slug : institution?.slug

  return {
    ok: true,
    session: {
      role: profile.role === 'admin' ? 'admin' : 'institution',
      label: profile.display_name,
      institutionId: slug ?? profile.institution_id,
      staffActive: true,
      isDemo: false,
      userId: data.user.id,
    },
  }
}

export async function signOutRemote() {
  const supabase = getSupabase()
  if (supabase) await supabase.auth.signOut()
}
