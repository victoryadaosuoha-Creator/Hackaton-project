// Single service layer: components never call Supabase directly.
// Only the public URL + anon key are used here. Authorisation is enforced by RLS and RPCs in the database.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const live = Boolean(url && key);
const sb = live ? createClient(url, key) : null;

const STATIC_CATS = ['Waste & Sanitation', 'Roads & Transport', 'Water & Drainage', 'Electricity & Streetlights', 'Public Safety', 'Public Facilities', 'Environmental Issues', 'Other'];
const STATIC_AREAS = ['Banjul', 'Serrekunda', 'Brikama', 'Farafenni', 'Basse'];

const ok = ({ data, error }) => { if (error) throw error; return data; };

export async function refs() {
  if (!live) return { cats: STATIC_CATS.map((label) => ({ slug: null, label })), areas: STATIC_AREAS.map((name) => ({ id: null, name })) };
  const [c, a] = await Promise.all([
    sb.from('report_categories').select('slug,label').eq('is_active', true).order('label'),
    sb.from('service_areas').select('id,name').eq('is_active', true).order('name'),
  ]);
  return { cats: ok(c), areas: ok(a) };
}

export const submitReport = (d, idemKey) => sb.rpc('submit_report', {
  p_idempotency_key: idemKey, p_title: d.title, p_description: d.desc, p_category_slug: d.slug,
  p_area_id: d.areaId, p_landmark: d.mark || null, p_lat: d.coords?.[0] ?? null, p_lng: d.coords?.[1] ?? null,
  p_link_account: d.link,
}).then(ok);
export const track = (ref) => sb.rpc('track_report', { p_reference: ref }).then(ok);
export const publicReports = () => sb.rpc('public_reports').then(ok);
export const stats = () => sb.rpc('public_stats').then(ok);

export const explain = (e) => {
  if (e?.code === '22023' || e?.code === '42501') return e.message;
  if (e?.code === '23514') return 'That location is outside The Gambia. Choose a locality instead.';
  if (/fetch|network/i.test(e?.message || '')) return 'Network problem. Your details are kept. Tap Submit again.';
  return 'Something went wrong. Please try again.';
};

// ---- auth (Supabase Auth: sessions persist and refresh automatically)
export const session = async () => (live ? (await sb.auth.getSession()).data.session : null);
export const onAuth = (cb) => { if (live) sb.auth.onAuthStateChange((_e, s) => cb(s)); };
export const signUp = (email, password, name) => sb.auth.signUp({ email, password, options: { data: { display_name: name } } }).then(ok);
export const signIn = (email, password) => sb.auth.signInWithPassword({ email, password }).then(ok);
export const signOut = () => sb.auth.signOut();
export const recover = (email) => sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }).then(ok);
export const profile = () => sb.from('profiles').select('display_name,role').maybeSingle().then(ok);
export const myReports = (uid) => sb.from('reports').select('reference,title,status,created_at').eq('reporter_id', uid).order('created_at', { ascending: false }).then(ok);

// ---- AI (server-side Edge Function; key never in the browser)
export async function ai(body) {
  if (!live) return { ai_available: false };
  const { data, error } = await sb.functions.invoke('ai', { body });
  if (error) return { ai_available: false, error: true, limited: error.context?.status === 429 };
  return data;
}
