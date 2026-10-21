export interface Bucket { key?:string; id?:string; label:string; count:number; unresolved:number }
export interface InsightData { institution_id:string|null; days:number; window_start:string; window_end:string; total:number; unresolved:number; by_status:Record<string,number>; categories:Bucket[]; areas:Bucket[] }
const count=(x:unknown):x is number=>Number.isSafeInteger(x)&&Number(x)>=0;
export function validInsights(raw:unknown):raw is InsightData {
  if(!raw||typeof raw!=='object'||Array.isArray(raw)) return false;
  const d=raw as InsightData;
  if(!count(d.total)||!count(d.unresolved)||d.unresolved>d.total||!Number.isInteger(d.days)||d.days<1||d.days>90||!Number.isFinite(Date.parse(d.window_start))||!Number.isFinite(Date.parse(d.window_end)))return false;
  if(!d.by_status||typeof d.by_status!=='object'||Array.isArray(d.by_status)||Object.entries(d.by_status).some(([key,n])=>!['submitted','under_review','assigned','in_progress','resolved','rejected'].includes(key)||!count(n)))return false;
  if(Object.values(d.by_status).reduce((a,b)=>a+b,0)!==d.total)return false;
  for(const [rows,key] of [[d.categories,'key'],[d.areas,'id']] as const){
    if(!Array.isArray(rows)||rows.some(b=>!b||typeof b[key]!=='string'||typeof b.label!=='string'||!count(b.count)||!count(b.unresolved)||b.unresolved>b.count))return false;
    if(rows.reduce((a,b)=>a+b.count,0)!==d.total)return false;
  }
  return true;
}
export interface Highlights { category_keys:string[]; area_ids:string[] }
export function validateHighlights(raw:unknown,data:InsightData):Highlights|null {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
  const o=raw as Highlights;
  if(!Array.isArray(o.category_keys)||!Array.isArray(o.area_ids)||o.category_keys.length>3||o.area_ids.length>3)return null;
  if(o.category_keys.some(x=>typeof x!=='string'||!data.categories.some(c=>c.key===x&&c.count>0))||o.area_ids.some(x=>typeof x!=='string'||!data.areas.some(a=>a.id===x&&a.count>0)))return null;
  return {category_keys:[...new Set(o.category_keys)],area_ids:[...new Set(o.area_ids)]};
}
export function dataHighlights(data:InsightData):Highlights {
  return {category_keys:[...data.categories].sort((a,b)=>b.count-a.count).slice(0,3).map(c=>c.key!),area_ids:[...data.areas].sort((a,b)=>b.unresolved-a.unresolved).slice(0,3).map(a=>a.id!)};
}
export function insightSummary(data:InsightData,picks:Highlights):string {
  const parts=[data.total+' reports were submitted in this scope during the last '+data.days+' days; '+data.unresolved+' are currently unresolved.'];
  if(!data.total)return parts[0]+' There is no report data to summarise in this window.';
  for(const key of picks.category_keys){const c=data.categories.find(c=>c.key===key)!;parts.push(c.label+': '+c.count+' reports, '+c.unresolved+' unresolved.');}
  for(const id of picks.area_ids){const a=data.areas.find(a=>a.id===id)!;parts.push(a.label+': '+a.count+' reports, '+a.unresolved+' unresolved.');}
  return parts.join(' ');
}
