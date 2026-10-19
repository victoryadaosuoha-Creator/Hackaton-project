export type BackendMode = 'demo' | 'supabase_configured'

export function getBackendMode(): BackendMode {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (url && key) return 'supabase_configured'
  return 'demo'
}

export function isSupabaseConfigured(): boolean {
  return getBackendMode() === 'supabase_configured'
}
