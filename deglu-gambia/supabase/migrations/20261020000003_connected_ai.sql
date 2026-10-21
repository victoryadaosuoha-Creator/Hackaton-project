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
