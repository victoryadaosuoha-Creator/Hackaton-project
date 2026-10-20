begin;
-- Additive AI APIs. Existing tables, records, RLS policies and baseline migrations are preserved.
-- Staff receive candidate details only after BOTH source and candidate permissions are checked.
create function public.staff_duplicate_candidates(p_report_id uuid)
returns table(report_id uuid, reference text, title text, status public.report_status,
              similarity real, distance_km numeric, same_area boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not public.can_manage_report(p_report_id) then
    raise exception 'not permitted' using errcode='42501';
  end if;
  return query select d.* from public.find_duplicate_candidates(p_report_id) d
    where public.can_manage_report(d.report_id);
end $$;
revoke all on function public.staff_duplicate_candidates(uuid) from public, anon, authenticated;
grant execute on function public.staff_duplicate_candidates(uuid) to authenticated;

-- Runs with caller privileges and RLS. Aggregates all matching rows, without a REST row-limit bias.
-- No descriptions, titles, identities, coordinates or internal notes enter the result.
create function public.institution_report_insights(p_institution uuid default null, p_days integer default 30)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  p public.profiles; v_scope uuid; v_start timestamptz; v_result jsonb;
begin
  select * into p from public.profiles where id=(select auth.uid());
  if not found or not p.is_active or p.role not in ('staff','admin') then
    raise exception 'not permitted' using errcode='42501';
  end if;
  if p_days is null or p_days not between 1 and 90 then
    raise exception 'choose a window between 1 and 90 days' using errcode='22023';
  end if;
  if p.role='staff' then
    if p_institution is not null and p_institution is distinct from p.institution_id then
      raise exception 'not permitted' using errcode='42501';
    end if;
    v_scope := p.institution_id;
  else v_scope := p_institution;
  end if;
  v_start := now() - make_interval(days=>p_days);
  with scoped as materialized (
    select r.status,r.category_slug,r.area_id,r.created_at from public.reports r
     where r.created_at>=v_start and r.created_at<=now()
       and (v_scope is null or r.institution_id=v_scope)
  ), cats as (
    select s.category_slug as key,coalesce(c.label,s.category_slug) as label,
      count(*) as count,count(*) filter(where s.status not in ('resolved','rejected')) as unresolved
      from scoped s left join public.report_categories c on c.slug=s.category_slug
      group by s.category_slug,c.label
  ), areas as (
    select s.area_id as id,coalesce(a.name,'Unavailable locality') as label,
      count(*) as count,count(*) filter(where s.status not in ('resolved','rejected')) as unresolved
      from scoped s left join public.service_areas a on a.id=s.area_id group by s.area_id,a.name
  )
  select jsonb_build_object(
    'institution_id',v_scope,'days',p_days,'window_start',v_start,'window_end',now(),
    'total',(select count(*) from scoped),
    'unresolved',(select count(*) from scoped where status not in ('resolved','rejected')),
    'by_status',coalesce((select jsonb_object_agg(status,n) from (select status,count(*) n from scoped group by status) x),'{}'::jsonb),
    'categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.count desc,c.key) from cats c),'[]'::jsonb),
    'areas',coalesce((select jsonb_agg(to_jsonb(a) order by a.unresolved desc,a.id) from areas a),'[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;
revoke all on function public.institution_report_insights(uuid,integer) from public, anon, authenticated;
grant execute on function public.institution_report_insights(uuid,integer) to authenticated;

-- Record suggestions atomically under the caller's current report permission.
-- Duplicate snapshots contain opaque IDs and evidence, not stale private titles/references.
create function public.record_ai_assessment(p_report uuid,p_analysis jsonb,p_model text,p_source text)
returns setof public.ai_assessments language plpgsql security definer set search_path = '' as $$
declare v_candidates jsonb; v_conf numeric;
begin
  if (select auth.uid()) is null or not public.can_manage_report(p_report) then
    raise exception 'not permitted' using errcode='42501';
  end if;
  if jsonb_typeof(p_analysis) is distinct from 'object' or p_source is null or p_source not in ('ai','rules')
    or p_model is null or length(p_model) not between 1 and 120
    or jsonb_typeof(p_analysis->'summary') is distinct from 'string'
    or length(p_analysis->>'summary')>240
    or (p_analysis->>'priority') is null or (p_analysis->>'priority') not in ('low','medium','high','urgent')
    or jsonb_typeof(p_analysis->'missing_details') is distinct from 'array'
    or jsonb_typeof(p_analysis->'priority_reasons') is distinct from 'array' then
    raise exception 'invalid analysis' using errcode='22023';
  end if;
  if jsonb_array_length(p_analysis->'missing_details')>4 or jsonb_array_length(p_analysis->'priority_reasons')>4
    or exists(select 1 from jsonb_array_elements((p_analysis->'missing_details')||(p_analysis->'priority_reasons')) x
              where jsonb_typeof(x) is distinct from 'string' or length(x#>>'{}')>140) then
    raise exception 'invalid details' using errcode='22023';
  end if;
  if p_analysis->>'category' is not null and not exists(select 1 from public.report_categories c where c.slug=p_analysis->>'category' and c.is_active) then
    raise exception 'unknown category' using errcode='22023';
  end if;
  if coalesce(jsonb_typeof(p_analysis->'category_confidence'),'null') not in ('number','null') then
    raise exception 'invalid confidence' using errcode='22023';
  end if;
  v_conf := (p_analysis->>'category_confidence')::numeric;
  if v_conf<0 or v_conf>1 then raise exception 'invalid confidence' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('report_id',d.report_id,'similarity',d.similarity,
     'distance_km',d.distance_km,'same_area',d.same_area)),'[]'::jsonb) into v_candidates
    from public.staff_duplicate_candidates(p_report) d;
  return query insert into public.ai_assessments(report_id,kind,suggestion,confidence,model)
    values
      (p_report,'category',jsonb_build_object('category',p_analysis->>'category','source',p_source),v_conf,p_model),
      (p_report,'summary',jsonb_build_object('summary',p_analysis->>'summary','missing_details',p_analysis->'missing_details','source',p_source),null,p_model),
      (p_report,'priority',jsonb_build_object('priority',p_analysis->>'priority','reasons',p_analysis->'priority_reasons','source',p_source),null,p_model),
      (p_report,'duplicate',jsonb_build_object('method','SQL text similarity and approximate locality','candidates',v_candidates,'source','database'),null,'sql-trigram-v1')
    returning *;
end $$;
revoke all on function public.record_ai_assessment(uuid,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.record_ai_assessment(uuid,jsonb,text,text) to authenticated;

-- Owner-run integration tests; all fixture users, records and review changes roll back.

do $$
declare
  inst_a uuid;inst_b uuid;area_a uuid;area_near uuid;area_far uuid;
  staff_a uuid:=gen_random_uuid();staff_b uuid:=gen_random_uuid();citizen uuid:=gen_random_uuid();admin_id uuid:=gen_random_uuid();
  cat text:='ai_'||substr(replace(gen_random_uuid()::text,'-',''),1,20);
  source_ref text;other_ref text;source_id uuid;same_id uuid;near_id uuid;far_id uuid;other_id uuid;old_id uuid;
  v_ref text;v_json jsonb;v_analysis jsonb;v_assessment bigint;v_before bigint;v_count int;
begin
  insert into public.institutions(name) values('AI isolation A '||staff_a) returning id into inst_a;
  insert into public.institutions(name) values('AI isolation B '||staff_a) returning id into inst_b;
  insert into public.service_areas(name) values('AI area '||staff_a) returning id into area_a;
  insert into public.service_areas(name) values('AI near '||staff_a) returning id into area_near;
  insert into public.service_areas(name) values('AI far '||staff_a) returning id into area_far;
  insert into public.report_categories(slug,label,institution_id) values(cat,'AI fixture water',inst_a);
  insert into auth.users(id,raw_user_meta_data) values(staff_a,'{}'),(staff_b,'{}'),(citizen,'{}'),(admin_id,'{}');
  update public.profiles set role='staff',institution_id=inst_a where id=staff_a;
  update public.profiles set role='staff',institution_id=inst_b where id=staff_b;
  update public.profiles set role='admin' where id=admin_id;
  source_ref:=public.submit_report(gen_random_uuid(),'Blocked drain at market','Drain blocked beside the market for several weeks.',cat,area_a,null,13.45,-16.58);
  select id into source_id from public.reports where reference=source_ref;
  v_ref:=public.submit_report(gen_random_uuid(),'Blocked drain at market','Drain blocked beside the market for several weeks.',cat,area_a);
  select id into same_id from public.reports where reference=v_ref;
  v_ref:=public.submit_report(gen_random_uuid(),'Blocked drain at market','Drain blocked beside the market for several weeks.',cat,area_near,null,13.46,-16.58);
  select id into near_id from public.reports where reference=v_ref;
  v_ref:=public.submit_report(gen_random_uuid(),'Blocked drain at market','Drain blocked beside the market for several weeks.',cat,area_far,null,13.31,-14.21);
  select id into far_id from public.reports where reference=v_ref;
  update public.reports set status='resolved',resolution_note='Fixture resolution',resolved_at=now() where id=far_id;
  other_ref:=public.submit_report(gen_random_uuid(),'Blocked drain at market','Drain blocked beside the market for several weeks.',cat,area_a);
  select id into other_id from public.reports where reference=other_ref;
  update public.reports set institution_id=inst_b where id=other_id;
  v_ref:=public.submit_report(gen_random_uuid(),'Blocked drain at market','Drain blocked beside the market for several weeks.',cat,area_a);
  select id into old_id from public.reports where reference=v_ref;
  update public.reports set created_at=now()-interval '100 days' where id=old_id;
  select count(*) into v_before from public.reports;
  v_analysis:=jsonb_build_object('category',cat,'category_confidence',0.8,'summary','Drain blocked beside market.','missing_details',jsonb_build_array('How long?'),'priority','high','priority_reasons',jsonb_build_array('Open drain'));

  set local role anon;
  begin perform public.staff_duplicate_candidates(source_id);raise exception 'FAIL: anon duplicate access';exception when insufficient_privilege then null;end;
  begin perform public.institution_report_insights(inst_a,30);raise exception 'FAIL: anon insight access';exception when insufficient_privilege then null;end;
  begin perform public.record_ai_assessment(source_id,v_analysis,'test-model','ai');raise exception 'FAIL: anon assessment write';exception when insufficient_privilege then null;end;
  reset role;
  perform set_config('request.jwt.claim.sub',citizen::text,true);set local role authenticated;
  begin perform public.staff_duplicate_candidates(source_id);raise exception 'FAIL: citizen duplicate access';exception when insufficient_privilege then null;end;
  begin perform public.institution_report_insights(inst_a,30);raise exception 'FAIL: citizen insight access';exception when insufficient_privilege then null;end;
  begin perform public.record_ai_assessment(source_id,v_analysis,'test-model','ai');raise exception 'FAIL: citizen assessment write';exception when insufficient_privilege then null;end;
  reset role;

  perform set_config('request.jwt.claim.sub',staff_a::text,true);set local role authenticated;
  select count(*) into v_count from public.staff_duplicate_candidates(source_id);
  if v_count<>2 then raise exception 'FAIL: expected same-locality and nearby matches, got %',v_count;end if;
  if exists(select 1 from public.staff_duplicate_candidates(source_id) where report_id not in (same_id,near_id)) then raise exception 'FAIL: foreign, distant or old candidate leaked';end if;
  begin perform public.staff_duplicate_candidates(other_id);raise exception 'FAIL: foreign source accessible';exception when insufficient_privilege then null;end;
  begin perform public.find_duplicate_candidates(source_id);raise exception 'FAIL: raw service-only search granted to staff';exception when insufficient_privilege then null;end;
  v_json:=public.institution_report_insights(inst_a,30);
  if (v_json->>'total')::int<>4 or (v_json->>'unresolved')::int<>3 then raise exception 'FAIL: inaccurate insight counts %',v_json;end if;
  if v_json::text like '%Blocked%' or v_json::text like '%reporter_id%' or v_json::text like '%description%' then raise exception 'FAIL: private text in insights';end if;
  begin perform public.institution_report_insights(inst_b,30);raise exception 'FAIL: cross-institution insights';exception when insufficient_privilege then null;end;
  begin perform public.institution_report_insights(inst_a,91);raise exception 'FAIL: unbounded insight window';exception when sqlstate '22023' then null;end;
  select count(*) into v_count from public.record_ai_assessment(source_id,v_analysis,'test-model','ai');
  if v_count<>4 then raise exception 'FAIL: assessment components not saved atomically';end if;
  select id into v_assessment from public.ai_assessments where report_id=source_id and kind='priority' order by id desc limit 1;
  perform public.review_ai_assessment(v_assessment,'accepted');
  if (select status from public.ai_assessments where id=v_assessment)<>'accepted' then raise exception 'FAIL: priority confirmation not saved';end if;
  if exists(select 1 from public.ai_assessments where report_id=source_id and kind='duplicate' and (suggestion::text like '%Blocked%' or suggestion::text like '%DG-%')) then raise exception 'FAIL: private candidate titles/references persisted';end if;
  begin perform public.record_ai_assessment(source_id,jsonb_set(v_analysis,'{priority}','"catastrophic"'),'test-model','ai');raise exception 'FAIL: invalid priority accepted';exception when sqlstate '22023' then null;end;
  if (select status from public.reports where id=source_id)<>'submitted' then raise exception 'FAIL: AI changed report status';end if;
  reset role;

  perform set_config('request.jwt.claim.sub',staff_b::text,true);set local role authenticated;
  if exists(select 1 from public.ai_assessments where report_id=source_id) then raise exception 'FAIL: cross-institution assessment read';end if;
  begin perform public.record_ai_assessment(source_id,v_analysis,'test-model','ai');raise exception 'FAIL: cross-institution assessment write';exception when insufficient_privilege then null;end;
  v_json:=public.institution_report_insights(null,30);if (v_json->>'total')::int<>1 then raise exception 'FAIL: default staff insight scope';end if;
  reset role;

  perform set_config('request.jwt.claim.sub','',true);
  update public.reports set institution_id=inst_b where id=same_id;
  perform set_config('request.jwt.claim.sub',staff_a::text,true);set local role authenticated;
  if exists(select 1 from public.staff_duplicate_candidates(source_id) where report_id=same_id) then raise exception 'FAIL: reassigned candidate leaked';end if;
  reset role;
  perform set_config('request.jwt.claim.sub','',true);update public.profiles set is_active=false where id=staff_a;
  perform set_config('request.jwt.claim.sub',staff_a::text,true);set local role authenticated;
  begin perform public.institution_report_insights(null,30);raise exception 'FAIL: inactive staff insights';exception when insufficient_privilege then null;end;
  begin perform public.record_ai_assessment(source_id,v_analysis,'test-model','ai');raise exception 'FAIL: inactive staff assessment';exception when insufficient_privilege then null;end;
  reset role;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);set local role authenticated;
  v_json:=public.institution_report_insights(null,30);if (v_json->>'total')::int<5 then raise exception 'FAIL: admin insight scope';end if;
  reset role;
  perform set_config('request.jwt.claim.sub','',true);
  if (select count(*) from public.reports)<>v_before then raise exception 'FAIL: AI deleted or merged reports';end if;
  raise notice 'All connected-AI security checks passed';
end $$;


select 'PASS: connected AI migration and security tests; transaction rolled back' as result;
rollback;
