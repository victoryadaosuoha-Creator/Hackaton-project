-- Security smoke checks. Run in the SQL editor or `psql` against a DEV database that has the
-- migration and seed applied. Everything is rolled back at the end. Any FAIL raises an error.
-- These cover anonymous access only. Staff/admin/citizen isolation tests need real auth users
-- (see docs/supabase-setup.md, "Next tests").

begin;
set local role anon;

do $$
declare
  v_key uuid := gen_random_uuid();
  v_ref text; v_ref2 text; v_track jsonb; v_cat text; v_area uuid;
begin
  select slug into v_cat from public.report_categories where is_active limit 1;
  select id into v_area from public.service_areas where is_active limit 1;
  if v_cat is null or v_area is null then raise exception 'FAIL: seed data missing'; end if;

  -- 1. anon cannot read private tables
  begin perform 1 from public.reports limit 1;
        raise exception 'FAIL: anon can read reports';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.report_internal_notes limit 1;
        raise exception 'FAIL: anon can read internal notes';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.audit_logs limit 1;
        raise exception 'FAIL: anon can read audit logs';
  exception when insufficient_privilege then null; end;

  -- 2. anon cannot write directly
  begin insert into public.reports (reference, idempotency_key, title, description, category_slug, area_id)
        values ('DG-2026-AAAAAA', gen_random_uuid(), 'abc', 'abcdefghij', v_cat, v_area);
        raise exception 'FAIL: anon can insert reports directly';
  exception when insufficient_privilege then null; end;

  -- 3. anon cannot call privileged functions
  begin perform public.update_report_status(gen_random_uuid(), 'under_review');
        raise exception 'FAIL: anon can call update_report_status';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_set_role(gen_random_uuid(), 'admin');
        raise exception 'FAIL: anon can call admin_set_role';
  exception when insufficient_privilege then null; end;

  -- 4. anonymous submission works, is idempotent, and rejects bad input
  v_ref  := public.submit_report(v_key, 'Blocked drain', 'Drain is blocked near the market', v_cat, v_area);
  v_ref2 := public.submit_report(v_key, 'Blocked drain', 'Drain is blocked near the market', v_cat, v_area);
  if v_ref is null or v_ref <> v_ref2 then raise exception 'FAIL: idempotency'; end if;
  begin perform public.submit_report(gen_random_uuid(), 'x', 'too short', v_cat, v_area);
        raise exception 'FAIL: invalid input accepted';
  exception when sqlstate '22023' then null; end;
  begin perform public.submit_report(gen_random_uuid(), 'Valid title', 'Valid description text', v_cat, v_area, null, null, null, true);
        raise exception 'FAIL: anonymous caller linked to an account';
  exception when sqlstate '42501' then null; end;

  -- 5. tracking returns safe fields only
  v_track := public.track_report(v_ref);
  if not (v_track ->> 'found')::boolean then raise exception 'FAIL: tracking did not find report'; end if;
  if v_track ?| array['description', 'title', 'reporter_id', 'lat', 'lng', 'landmark', 'id'] then
    raise exception 'FAIL: tracking leaked private fields';
  end if;
  if (public.track_report('DG-2026-ZZZZZZ') ->> 'found')::boolean then raise exception 'FAIL: phantom report'; end if;

  raise notice 'All anonymous-access checks passed';
end $$;

rollback;
