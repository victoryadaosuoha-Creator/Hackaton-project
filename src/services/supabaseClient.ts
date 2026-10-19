import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isSupabaseConfigured } from './backendMode'

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL!.trim()
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY!.trim()
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
  return client
}
