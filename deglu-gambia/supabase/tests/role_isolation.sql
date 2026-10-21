-- Owner-run integration tests. All fixture users, reports, notes and audit entries roll back.
begin;
do $$
declare
  citizen_a uuid := gen_random_uuid(); citizen_b uuid := gen_random_uuid();
  staff_a uuid := gen_random_uuid(); staff_b uuid := gen_random_uuid(); admin_id uuid := gen_random_uuid();
  inst_a uuid; inst_b uuid; area uuid; category text := 'test_' || substr(replace(gen_random_uuid()::text,'-',''),1,20);
  ref_a text; ref_b text; report_a uuid; report_b uuid; tracked jsonb; count_rows int;
begin
  insert into public.institutions(name) values ('Isolation A ' || citizen_a) returning id into inst_a;
  insert into public.institutions(name) values ('Isolation B ' || citizen_a) returning id into inst_b;
  insert into public.service_areas(name) values ('Isolation ' || citizen_a) returning id into area;
  insert into public.report_categories(slug,label,institution_id) values(category,'Isolation category',inst_a);
  insert into auth.users(id,raw_user_meta_data) values (citizen_a,'{"role":"admin","display_name":"Citizen A"}'),(citizen_b,'{}'),(staff_a,'{}'),(staff_b,'{}'),(admin_id,'{}');
  if (select role from public.profiles where id=citizen_a) <> 'citizen' then raise exception 'FAIL: signup metadata escalated role'; end if;
  update public.profiles set role='staff',institution_id=inst_a where id=staff_a;
  update public.profiles set role='staff',institution_id=inst_b where id=staff_b;
  update public.profiles set role='admin' where id=admin_id;

  perform set_config('request.jwt.claim.sub',citizen_a::text,true);
  set local role authenticated;
  ref_a := public.submit_report(gen_random_uuid(),'Isolation report A','Private description for citizen A',category,area,null,null,null,true);
  select id into report_a from public.reports where reference=ref_a;
  if report_a is null then raise exception 'FAIL: citizen cannot read linked report'; end if;
  begin update public.profiles set role='admin' where id=citizen_a; raise exception 'FAIL: role escalation'; exception when insufficient_privilege then null; end;
  begin perform public.update_report_status(report_a,'under_review'); raise exception 'FAIL: citizen changed status'; exception when insufficient_privilege then null; end;
  begin perform public.set_report_visibility(report_a,true); raise exception 'FAIL: citizen published report'; exception when insufficient_privilege then null; end;
  begin insert into public.report_internal_notes(report_id,author_id,body) values(report_a,citizen_a,'Forbidden'); raise exception 'FAIL: citizen wrote staff note'; exception when insufficient_privilege then null; end;

  reset role;
  perform set_config('request.jwt.claim.sub',citizen_b::text,true);
  set local role authenticated;
  select count(*) into count_rows from public.reports where id=report_a;
  if count_rows <> 0 then raise exception 'FAIL: citizen B read A report'; end if;
  ref_b := public.submit_report(gen_random_uuid(),'Anonymous report','Description deliberately unlinked',category,area,null,null,null,false);
  if exists(select 1 from public.reports where reference=ref_b) then raise exception 'FAIL: unlinked report visible in citizen account'; end if;
  begin perform public.admin_set_role(citizen_b,'admin'); raise exception 'FAIL: citizen called admin role setter'; exception when insufficient_privilege then null; end;

  reset role;
  select id into report_b from public.reports where reference=ref_b;
  if (select reporter_id from public.reports where id=report_b) is not null then raise exception 'FAIL: anonymous identity stored'; end if;
  perform set_config('request.jwt.claim.sub',staff_b::text,true);
  set local role authenticated;
  if exists(select 1 from public.reports where id=report_a) then raise exception 'FAIL: cross-institution read'; end if;
  begin perform public.update_report_status(report_a,'under_review'); raise exception 'FAIL: cross-institution status change'; exception when insufficient_privilege then null; end;
  begin perform public.set_report_visibility(report_a,true); raise exception 'FAIL: cross-institution publication'; exception when insufficient_privilege then null; end;

  reset role;
  perform set_config('request.jwt.claim.sub',staff_a::text,true);
  set local role authenticated;
  if not exists(select 1 from public.reports where id=report_a) then raise exception 'FAIL: staff cannot read own institution'; end if;
  perform public.update_report_status(report_a,'under_review','Checking location',true);
  begin perform public.update_report_status(report_a,'resolved'); raise exception 'FAIL: resolved without note'; exception when sqlstate '22023' then null; end;
  insert into public.report_internal_notes(report_id,author_id,body) values(report_a,staff_a,'PRIVATE STAFF NOTE');
  perform public.update_report_status(report_a,'in_progress','PRIVATE PROGRESS NOTE',false);
  perform public.set_report_visibility(report_a,true);
  if not exists(select 1 from public.public_reports() where title='Isolation report A') then raise exception 'FAIL: approved report not public'; end if;
  perform public.update_report_status(report_a,'resolved','Repaired drain',true);
  begin perform public.update_report_status(report_a,'in_progress','Reopen'); raise exception 'FAIL: staff reopened resolved report'; exception when sqlstate '22023' then null; end;
  begin perform public.assign_report(report_a,inst_b); raise exception 'FAIL: staff reassigned report'; exception when insufficient_privilege then null; end;

  reset role;
  perform set_config('request.jwt.claim.sub',citizen_a::text,true);
  set local role authenticated;
  if exists(select 1 from public.report_internal_notes where report_id=report_a) then raise exception 'FAIL: citizen read internal notes'; end if;
  if exists(select 1 from public.report_updates where report_id=report_a and not is_public) then raise exception 'FAIL: citizen read private history'; end if;
  tracked := public.track_report(ref_a);
  if tracked ?| array['description','title','reporter_id','landmark','lat','lng','id'] or tracked::text like '%PRIVATE%' then raise exception 'FAIL: tracking leaked private data'; end if;
  if not (tracked->>'found')::boolean then raise exception 'FAIL: tracking failed'; end if;

  reset role;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  set local role authenticated;
  perform public.assign_report(report_a,inst_b);
  perform public.update_report_status(report_a,'in_progress','Admin reopened report');
  perform public.admin_set_role(citizen_b,'staff',inst_b);
  begin perform public.admin_set_role(admin_id,'citizen'); raise exception 'FAIL: admin removed own role'; exception when sqlstate '22023' then null; end;
  if not exists(select 1 from public.audit_logs where target_id=report_a::text) then raise exception 'FAIL: audit missing'; end if;
  reset role;
  perform set_config('request.jwt.claim.sub','',true);
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity) then raise exception 'FAIL: table without RLS'; end if;
  raise notice 'All role-isolation checks passed';
end $$;
rollback;
