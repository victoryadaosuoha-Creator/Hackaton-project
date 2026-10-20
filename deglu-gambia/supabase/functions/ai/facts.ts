// Verified against the repository's report form, RPC statuses, account flow and staff portal.
// The model selects these facts; it cannot write new policies or claim a report was repaired.
export const FACTS: Record<string,string> = {
  report: 'Open Report, enter a title and description, choose a category and locality, review the details, then submit. Keep the reference code.',
  track: 'Open Track and enter your reference code to see the status and public timeline. This assistant cannot look up or confirm an individual report status.',
  statuses: 'Submitted means received; Under Review means being checked; Assigned means routed to an institution; In Progress means work has started; Resolved means staff recorded a resolution note; Rejected means staff recorded a reason.',
  account: 'You can report without an account. When signed in, tick Link this report to my account to see it in My account. Unlinked reports stay anonymous and do not appear there.',
  details: 'Describe what is wrong, where it is, and how long it has been a problem. Avoid names, contact information and other personal details.',
  photos: 'Photos are validated on your device but are not uploaded in this version.',
  voice: 'Where the browser supports speech recognition, choose Speak, then review and edit the description before submitting. Recognition is configured for English; Wolof and Mandinka are not verified.',
  visibility: 'Reports appear on the community map only after an authorised staff member or admin approves them for public display.',
  recovery: 'Open Sign in, choose Forgot password, and follow the recovery email to set a new password. Email delivery and allowed redirects must be configured by the project owner.',
  safety: 'Déglu Gambia is a demonstration project, not an official government channel. It does not guarantee response times or institutional action.',
};
export function selectFacts(raw: unknown): { fact_ids:string[]; uncertain:boolean } | null {
  if (!raw || typeof raw!=='object' || Array.isArray(raw)) return null;
  const o=raw as Record<string,unknown>;
  if (!Array.isArray(o.fact_ids) || o.fact_ids.length>3 || o.fact_ids.some(x=>typeof x!=='string'||!Object.hasOwn(FACTS,x)) || typeof o.uncertain!=='boolean') return null;
  return {fact_ids:[...new Set(o.fact_ids as string[])],uncertain:o.uncertain};
}
export function factReply(selection:{fact_ids:string[];uncertain:boolean}):string {
  const text=selection.fact_ids.map(id=>FACTS[id]).join(' ');
  return (selection.uncertain || !text ? 'I do not have verified information to answer that fully. ' : '') + (text || 'I can explain reporting, tracking, accounts, and how this application works.');
}
export function fallbackFacts(question:string) {
  const rules:[string,RegExp][]=[['track',/track|reference|my report|fixed|repaired/i],['statuses',/status|resolved|rejected|assigned|progress|review/i],['account',/account|anonymous|sign.?in|log.?in/i],['photos',/photo|image|upload/i],['voice',/voice|speak|microphone|wolof|mandinka|language/i],['recovery',/password|reset|recover/i],['visibility',/map|public|approve/i],['report',/submit|report a|how.*report/i],['details',/detail|describe|information/i]];
  const ids=rules.filter(([,re])=>re.test(question)).map(([id])=>id).slice(0,3);
  // Policy/deadline/contact questions have no verified governmental answer.
  return {fact_ids:ids,uncertain:!ids.length || /policy|policies|deadline|fee|phone|minister|guarantee|when.*(fix|repair)/i.test(question)};
}
