// Pure helpers (no network, no Deno APIs) so they can be unit-tested directly.

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type Priority = typeof PRIORITIES[number];

export const clip = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

/** Strip angle brackets so user text cannot close our <report> delimiter. */
export const neutralise = (s: string): string => s.replace(/[<>]/g, ' ');

/** Remove obvious personal contact details before anything leaves our servers. */
export function redact(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, '[phone]');
}

export const prepare = (s: string, max: number): string => neutralise(redact(clip(s, max)));

// ---------------------------------------------------------------- transparent priority rules (documented)
// Rule 1: wording about immediate danger to life        -> urgent
// Rule 2: wording about injury, flooding, schools,
//         clinics, children, disease, no water/power    -> at least high
// Rule 3: 5+ related reports -> at least high; 3-4 -> at least medium
// Rule 4: a stated duration of weeks or months          -> at least medium
// Default: low. A model may suggest higher; the final suggestion is the HIGHER of rules and model.
const URGENT_RE = /\b(exposed (electric\w*|wires?|cables?)|live wires?|electrocut\w*|fire|explosion|collaps\w*|gas leak|drown\w*|contaminated (water|wells?))\b/i;
const HIGH_RE = /\b(injur\w*|accident|flood\w*|sinkholes?|open (manhole|drain)s?|no (water|power|electricity)|school|clinic|hospital|children|child|dangerous|unsafe|disease|cholera)\b/i;
const DURATION_RE = /\b(\d+|several|many|few)\s+(weeks?|months?)\b/i;

export const maxPriority = (a: Priority, b: Priority): Priority =>
  PRIORITIES[Math.max(PRIORITIES.indexOf(a), PRIORITIES.indexOf(b))];

export function rulePriority(text: string, relatedCount = 0): { priority: Priority; reasons: string[] } {
  let priority: Priority = 'low';
  const reasons: string[] = [];
  const bump = (p: Priority, why: string) => { priority = maxPriority(priority, p); reasons.push(why); };
  if (URGENT_RE.test(text)) bump('urgent', 'Wording suggests immediate danger');
  if (HIGH_RE.test(text)) bump('high', 'Mentions a safety, health, school or essential-service risk');
  if (relatedCount >= 5) bump('high', `${relatedCount} possibly related reports`);
  else if (relatedCount >= 3) bump('medium', `${relatedCount} possibly related reports`);
  if (DURATION_RE.test(text)) bump('medium', 'Problem has lasted weeks or months');
  return { priority, reasons };
}

// ---------------------------------------------------------------- keyword category fallback (used when AI is off)
const KW: Record<string, RegExp> = {
  waste_sanitation: /\b(waste|garbage|rubbish|trash|dump|bin|latrine|toilet)\b/i,
  roads_transport: /\b(road|pothole|bridge|traffic|bus|highway)\b/i,
  water_drainage: /\b(drain\w*|water|pipe|flood\w*|leak\w*|well)\b/i,
  electricity_streetlights: /\b(light|streetlight|power|electric\w*|cable|pole|transformer)\b/i,
  public_safety: /\b(unsafe|crime|danger\w*|theft|violence)\b/i,
};
export function ruleCategory(text: string, allowed: string[]): string | null {
  for (const slug of Object.keys(KW)) if (allowed.includes(slug) && KW[slug].test(text)) return slug;
  return null;
}

// ---------------------------------------------------------------- model output handling
export function parseJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(t); } catch { /* fall through */ }
  const m = t.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* ignore */ } }
  return null;
}

const validStringList = (v:unknown,n:number,len:number):v is string[] => Array.isArray(v) && v.length<=n && v.every(x=>typeof x==='string' && x.trim().length>0 && x.length<=len);
const strList = (v: unknown, n: number, len: number): string[] =>
  Array.isArray(v) ? v.map((x) => clip(x, len)).filter(Boolean).slice(0, n) : [];

export interface Analysis {
  category: string | null; category_confidence: number | null; summary: string;
  missing_details: string[]; priority: Priority; priority_reasons: string[];
}

/** Never trust model output: unknown categories/priorities are dropped, strings clipped. */
export function validateAnalysis(raw: unknown, allowedSlugs: string[]): Analysis | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (!(o.category === null || (typeof o.category === 'string' && allowedSlugs.includes(o.category)))
    || !(o.category_confidence === null || (typeof o.category_confidence === 'number' && Number.isFinite(o.category_confidence) && o.category_confidence >= 0 && o.category_confidence <= 1))
    || typeof o.summary !== 'string' || !o.summary.trim() || o.summary.length > 240
    || !PRIORITIES.includes(o.priority as Priority) || !validStringList(o.missing_details,4,140) || !validStringList(o.priority_reasons,3,140)) return null;
  const category = typeof o.category === 'string' && allowedSlugs.includes(o.category) ? o.category : null;
  const conf = typeof o.category_confidence === 'number' && o.category_confidence >= 0 && o.category_confidence <= 1
    ? Math.round(o.category_confidence * 1000) / 1000 : null;
  const priority = PRIORITIES.includes(o.priority as Priority) ? (o.priority as Priority) : 'low';
  return {
    category, category_confidence: category ? conf : null,
    summary: clip(o.summary, 240),
    missing_details: strList(o.missing_details, 4, 140),
    priority, priority_reasons: strList(o.priority_reasons, 3, 140),
  };
}

export interface Organised { title: string; description: string; missing_details: string[] }
export function validateOrganised(raw: unknown): Organised | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.title !== 'string' || o.title.length>80 || typeof o.description !== 'string' || o.description.length>500 || !validStringList(o.missing_details,4,140)) return null;
  const title = clip(o.title, 80), description = clip(o.description, 500);
  if (title.length < 3 || description.length < 10) return null;
  return { title, description, missing_details: strList(o.missing_details, 4, 140) };
}

export function cleanMessages(v: unknown, maxMsgs = 6, maxLen = 500): { role: 'user' | 'assistant'; content: string }[] {
  if (!Array.isArray(v)) return [];
  const out = v.slice(-maxMsgs).map((m) => ({
    role: (m?.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
    content: prepare(m?.content, maxLen),
  })).filter((m) => m.content.length > 0);
  while (out.length && out[0].role !== 'user') out.shift(); // providers require a user-first turn
  return out;
}
