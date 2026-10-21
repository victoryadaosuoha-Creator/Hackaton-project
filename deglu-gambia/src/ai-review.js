import * as api from './api.js';
import { el, field, button } from './dom.js';
const text=(value)=>typeof value==='string'?value:'';
const PRIORITIES=['low','medium','high','urgent'];
const select=(pairs,value)=>{const input=el('select',{},pairs.map(([id,label])=>el('option',{value:id},label)));input.value=value;return input;};
export function mountAIReview(parent,reportId,categories,onCandidate) {
  const root=el('section',{class:'ai-review'},el('h3',{},'Report analysis and duplicate review'));
  parent.append(root);
  const feedback=el('p',{role:'status'}),body=el('div');
  const run=button('Analyse report',async()=>{
    feedback.textContent='Analysing this report...';
    const result=await api.ai({action:'assess_report',report_id:reportId});
    if(!root.isConnected)return;
    if(result.error||!Array.isArray(result.assessments)){feedback.textContent=result.message||'Analysis is unavailable. Ordinary report management still works.';return;}
    feedback.textContent=result.source==='ai'?'AI suggestions saved for review. Check them against the original report.':'AI unavailable: saved labelled keyword/priority rules and database duplicate matches.';
    await load();
  });
  root.append(el('p',{},'Suggestions only. Confirm or correct them; review decisions do not change report routing, status, or merge records.'),run,feedback,body);
  async function review(row,outcome,corrected=null) {
    try{await api.reviewAssessment(row.id,outcome,corrected);await load();feedback.textContent='Review decision saved. No report fields were changed.';}
    catch(e){feedback.textContent=api.explain(e);}
  }
  async function load() {
    try {
      const [all,candidates]=await Promise.all([api.reportAssessments(reportId),api.duplicateCandidates(reportId)]);
      if(!root.isConnected)return;
      body.replaceChildren();
      for(const kind of ['category','summary','priority','duplicate']) {
        const row=all.find(a=>a.kind===kind);if(!row)continue;
        const s=row.suggestion||{},section=el('div',{class:'assessment'},el('h4',{},kind==='duplicate'?'Duplicate assessment':kind[0].toUpperCase()+kind.slice(1)+' suggestion'),el('p',{},'Review: '+row.status+' | '+(s.source==='ai'?'AI':s.source==='database'?'Database similarity':'Rules')+' | '+text(row.model)));
        let correction=null;
        if(kind==='category') {
          const label=categories.find(c=>c.slug===s.category)?.label||'No clear category';section.append(el('p',{},label));
          correction=select([['','No clear category'],...categories.map(c=>[c.slug,c.label])],s.category||'');section.append(field('Corrected category suggestion',correction));
        } else if(kind==='summary') {
          section.append(el('p',{class:'report-description'},text(s.summary)||'No AI summary is available. Read the original report above.'));
          const missing=Array.isArray(s.missing_details)?s.missing_details.filter(x=>typeof x==='string'):[];
          if(missing.length)section.append(el('b',{},'Missing details to clarify'),el('ul',{},missing.map(x=>el('li',{},x))));
          correction=el('textarea',{rows:3,maxlength:240},text(s.summary));section.append(field('Corrected summary suggestion',correction));
        } else if(kind==='priority') {
          section.append(el('p',{},'Recommended priority: '+text(s.priority)),el('ul',{},(Array.isArray(s.reasons)?s.reasons:[]).filter(x=>typeof x==='string').map(x=>el('li',{},x))));
          correction=select(PRIORITIES.map(p=>[p,p]),PRIORITIES.includes(s.priority)?s.priority:'low');section.append(field('Corrected priority suggestion',correction));
        } else section.append(el('p',{},'Matches are advisory. Candidate details below are rechecked against current permissions. Accepting does not link or merge reports.'));
        section.append(button('Confirm '+kind,()=>review(row,'accepted'),true),button('Dismiss '+kind,()=>review(row,'dismissed'),true));
        if(correction)section.append(button('Save '+kind+' correction',async()=>{
          const corrected={...s};
          if(kind==='summary'){if(!correction.value.trim()){feedback.textContent='Write a summary before saving a correction.';return;}corrected.summary=correction.value.trim();}
          else if(kind==='category')corrected.category=correction.value||null;
          else corrected.priority=correction.value;
          await review(row,'corrected',corrected);
        },true));
        body.append(section);
      }
      if(!all.length)body.append(el('p',{},'No assessment saved yet. Analyse the report to generate reviewable suggestions.'));
      const matches=el('div',{class:'assessment'},el('h4',{},'Possible duplicate reports'),el('p',{},'SQL text similarity, same category and institution, within 90 days, and same locality or about 2 km. No reports are merged or deleted.'));
      if(!candidates.length)matches.append(el('p',{},'No possible matches found with the current method. This does not prove the report is unique.'));
      for(const candidate of candidates)matches.append(el('div',{class:'duplicate-match'},el('b',{},candidate.title),el('p',{},candidate.reference+' | similarity '+Math.round(candidate.similarity*100)+'% | '+(candidate.distance_km==null?'same locality':candidate.distance_km+' km approximately')),button('Review '+candidate.reference,async()=>{try{await onCandidate(candidate.report_id);}catch(e){feedback.textContent=api.explain(e);}},true)));
      body.append(matches);
    } catch(e) {if(root.isConnected)feedback.textContent=e?.code==='PGRST202'?'AI review needs the connected-AI database migration. Other report controls still work.':api.explain(e);}
  }
  void load();
}
export function mountInsights(parent,profile,institutions) {
  const root=el('section',{class:'card insights'},el('h3',{},'Institutional insights'));
  parent.append(root);
  const days=select([['7','Last 7 days'],['30','Last 30 days'],['90','Last 90 days']],'30');
  const scope=profile.role==='admin'?select([['','All institutions'],...institutions.filter(i=>i.is_active).map(i=>[i.id,i.name])],''):null;
  const feedback=el('p',{role:'status'}),body=el('div');
  root.append(el('p',{},'Actual submitted-report counts in your permitted scope. No report text, identities or private notes are sent to the AI provider.'),field('Insight reporting window',days));
  if(scope)root.append(field('Insight institution',scope));
  root.append(button('Load institutional insights',async()=>{
    feedback.textContent='Loading report aggregates...';body.replaceChildren();
    const result=await api.ai({action:'institution_insights',days:Number(days.value),institution_id:scope?scope.value||null:profile.institution_id});
    if(!root.isConnected)return;
    if(result.error||!result.data){feedback.textContent=result.message||'Insights are unavailable. Report management is still available.';return;}
    feedback.textContent=result.source==='ai'?'AI-selected highlights; all numbers are computed from the database.':'Database summary; AI highlights are unavailable or unnecessary.';
    const d=result.data;
    body.append(el('p',{class:'insight-summary'},result.summary),el('p',{},'Window: '+new Date(d.window_start).toLocaleDateString()+' to '+new Date(d.window_end).toLocaleDateString()+'. Unresolved excludes resolved and rejected reports.'));
    const table=(title,rows)=>el('div',{},el('h4',{},title),el('table',{},el('thead',{},el('tr',{},['Name','Reports','Unresolved'].map(h=>el('th',{scope:'col'},h)))),el('tbody',{},rows.map(r=>el('tr',{},el('td',{},r.label),el('td',{},String(r.count)),el('td',{},String(r.unresolved)))))));
    body.append(table('Reports by category',d.categories),table('Reports by locality',d.areas));
    body.append(el('p',{},Object.entries(d.by_status).map(([status,count])=>status.replaceAll('_',' ')+': '+count).join(' | ')));
  }),feedback,body);
}
