// Single service layer: components never call Supabase directly.
// Only the public URL + anon key are used here. Authorisation is enforced by RLS and RPCs in the database.
import { createClient } from '@supabase/supabase-js';

import { readConfig } from './config.js';
import { fetchWithTimeout } from './network.js';
const config = readConfig(import.meta.env);
export const live = config.live;
export const configurationError = config.error;
const sb = live ? createClient(config.url, config.key, { global: { fetch: (input, options) => fetchWithTimeout(input, options, String(input).includes('/functions/v1/ai') ? 45000 : 15000) } }) : null;

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
  if (e?.code === 'PGRST202' || e?.code === '42P01') return 'The database setup is incomplete. Ask the project owner to check the migrations.';
  if (e?.code === '23514') return 'That location is outside The Gambia. Choose a locality instead.';
  if (/fetch|network|timed out|abort/i.test(e?.message || '')) return 'Network problem. Your details are kept. Tap Submit again.';
  return 'Something went wrong. Please try again.';
};

// ---- auth (Supabase Auth: sessions persist and refresh automatically)
export const session = async () => (live ? (await sb.auth.getSession()).data.session : null);
export const onAuth = (cb) => { if (live) return sb.auth.onAuthStateChange((event, s) => cb(s, event)); };
export const signUp = (email, password, name) => sb.auth.signUp({ email, password, options: { data: { display_name: name } } }).then(ok);
export const signIn = (email, password) => sb.auth.signInWithPassword({ email, password }).then(ok);
export const signOut = () => sb.auth.signOut().then(ok);
export const updatePassword = (password) => sb.auth.updateUser({ password }).then(ok);
export const recover = (email) => sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/#/reset-password' }).then(ok);
export const profile = (uid) => sb.from('profiles').select('id,display_name,role,institution_id,is_active').eq('id', uid).maybeSingle().then(ok);
export const myReports = (uid) => sb.from('reports').select('reference,title,status,created_at').eq('reporter_id', uid).order('created_at', { ascending: false }).then(ok);

// ---- AI (server-side Edge Function; key never in the browser)
export async function ai(body) {
  if (!live) return { ai_available: false };
  try {
    const { data, error } = await sb.functions.invoke('ai', { body });
    if (error) {
      const status=error.context?.status;
      const message=status===429?'Too many requests. Please wait a few minutes.':status===401?'Sign in again or ask the owner to check AI client-key configuration.':status===403?'You do not have permission for this AI operation.':status===503?'AI assistance is unavailable. You can continue without it.':'AI assistance could not complete. You can continue without it.';
      return { ai_available:false,error:true,limited:status===429,status,message };
    }
    return data || { ai_available: false };
  } catch { return { ai_available: false, error: true }; }
}

// Staff queries stay subject to RLS; every mutation rechecks permission in the database.
export const staffReports = (institution) => {
  let q = sb.from('reports').select('id,reference,title,description,status,is_public,institution_id,category_slug,area_id,landmark,created_at').order('created_at', { ascending: false }).limit(200);
  if (institution) q = q.eq('institution_id', institution);
  return q.then(ok);
};
export const reportHistory = (id) => sb.from('report_updates').select('id,new_status,note,is_public,created_at').eq('report_id', id).order('created_at').then(ok);
export const internalNotes = (id) => sb.from('report_internal_notes').select('id,body,created_at').eq('report_id', id).order('created_at').then(ok);
export const addInternalNote = (report, author, body) => sb.from('report_internal_notes').insert({ report_id: report, author_id: author, body }).then(ok);
export const updateStatus = (id, status, note, isPublic) => sb.rpc('update_report_status', { p_report_id: id, p_new_status: status, p_note: note || null, p_public: isPublic }).then(ok);
export const setVisibility = (id, value) => sb.rpc('set_report_visibility', { p_report_id: id, p_public: value }).then(ok);
export const assignReport = (id, institution) => sb.rpc('assign_report', { p_report_id: id, p_institution_id: institution }).then(ok);
export const institutions = () => sb.from('institutions').select('id,name,is_active').order('name').then(ok);
export const profiles = () => sb.from('profiles').select('id,display_name,role,institution_id,is_active').order('created_at').limit(200).then(ok);
export const setRole = (id, role, institution) => sb.rpc('admin_set_role', { p_user: id, p_role: role, p_institution: institution || null }).then(ok);
export const categories = () => sb.from('report_categories').select('slug,label,institution_id,is_active').order('label').then(ok);
export const saveCategory = (slug, values, create = false) => (create ? sb.from('report_categories').insert({ slug, ...values }) : sb.from('report_categories').update(values).eq('slug', slug)).then(ok);
export const addInstitution = (name) => sb.from('institutions').insert({ name }).then(ok);
export const addArea = (name) => sb.from('service_areas').insert({ name }).then(ok);
export const auditLogs = () => sb.from('audit_logs').select('id,action,target_table,target_id,created_at').order('created_at', { ascending: false }).limit(100).then(ok);

// AI suggestions never mutate reports. Review outcomes use the existing authorised RPC.
export const reportAssessments = (id) => sb.from('ai_assessments').select('id,kind,suggestion,confidence,status,model,created_at').eq('report_id',id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(40).then(ok);
export const duplicateCandidates = (id) => sb.rpc('staff_duplicate_candidates',{p_report_id:id}).then(ok);
export const reviewAssessment = (id,outcome,corrected=null) => sb.rpc('review_ai_assessment',{p_id:id,p_outcome:outcome,p_corrected:corrected}).then(ok);
export const staffReport = (id) => sb.from('reports').select('id,reference,title,description,status,is_public,institution_id,category_slug,area_id,landmark,created_at').eq('id',id).maybeSingle().then(ok);
