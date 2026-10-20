-- Read-only: compare every baseline function body with the manually applied schema.
select '20261020000001_core_schema.sql:set_updated_at' as object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='set_updated_at' and replace(p.prosrc,chr(13),'') = $body$
begin new.updated_at := now(); return new; end $body$) as matches
union all
select '20261020000001_core_schema.sql:reject_modification' as object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='reject_modification' and replace(p.prosrc,chr(13),'') = $body$
begin raise exception 'table % is append-only', tg_table_name using errcode = '42501'; end $body$) as matches
union all
select '20261020000001_core_schema.sql:is_admin' as object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='is_admin' and replace(p.prosrc,chr(13),'') = $body$
  select exists (select 1 from public.profiles p
                 where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active)
$body$) as matches
union all
select '20261020000001_core_schema.sql:is_staff_of' as object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='is_staff_of' and replace(p.prosrc,chr(13),'') = $body$
  select p_institution is not null and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'staff' and p.is_active
      and p.institution_id = p_institution)
$body$) as matches
union all
select '20261020000001_core_schema.sql:can_manage_report' as object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='can_manage_report' and replace(p.prosrc,chr(13),'') = $body$
  select exists (select 1 from public.reports r
                 where r.id = p_report and (public.is_admin() or public.is_staff_of(r.institution_id)))
$body$) as matches
union all
select '20261020000001_core_schema.sql:owns_report' as object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owns_report' and replace(p.prosrc,chr(13),'') = $body$
  select exists (select 1 from public.reports r
                 where r.id = p_report and r.reporter_id = (select auth.uid()))
$body$) as matches
union all
select '20261020000001_core_schema.sql:handle_new_user' as object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='handle_new_user' and replace(p.prosrc,chr(13),'') = $body$
begin
  -- Role is ALWAYS 'citizen' here; signup metadata is never trusted for privileges.
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80), ''))
  on conflict (id) do nothing;
  return new;
end $body$) as matches
union all
select '20261020000001_core_schema.sql:guard_profile_update' as object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='guard_profile_update' and replace(p.prosrc,chr(13),'') = $body$
begin
  if (select auth.uid()) is not null and not public.is_admin() and (
       new.id is distinct from old.id or new.role is distinct from old.role
       or new.institution_id is distinct from old.institution_id
       or new.is_active is distinct from old.is_active) then
    raise exception 'not permitted to change privileged profile fields' using errcode = '42501';
  end if;
  return new;
end $body$) as matches
union all
select '20261020000001_core_schema.sql:log_admin_change' as object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='log_admin_change' and replace(p.prosrc,chr(13),'') = $body$
begin
  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values ((select auth.uid()), lower(tg_op), tg_table_name,
          coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'slug'),
          jsonb_build_object('new', to_jsonb(new)));
  return new;
end $body$) as matches
union all
select '20261020000001_core_schema.sql:generate_reference' as object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='generate_reference' and replace(p.prosrc,chr(13),'') = $body$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- 31 chars, no I/L/O/0/1
  b bytea := extensions.gen_random_bytes(6);
  s text := '';
begin
  for i in 0..5 loop
    s := s || substr(alphabet, (get_byte(b, i) % 31) + 1, 1);
  end loop;
  return 'DG-' || to_char(now() at time zone 'utc', 'YYYY') || '-' || s;
end $body$) as matches
union all
select '20261020000001_core_schema.sql:status_transition_allowed' as object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='status_transition_allowed' and replace(p.prosrc,chr(13),'') = $body$
  select coalesce(case p_old
    when 'submitted'    then p_new in ('under_review', 'assigned', 'rejected')
    when 'under_review' then p_new in ('assigned', 'in_progress', 'resolved', 'rejected')
    when 'assigned'     then p_new in ('under_review', 'in_progress', 'rejected')
    when 'in_progress'  then p_new in ('under_review', 'resolved', 'rejected')
    when 'resolved'     then p_admin and p_new = 'in_progress'  -- reopen: admin only
    when 'rejected'     then p_admin and p_new = 'under_review' -- reconsider: admin only
  end, false)
$body$) as matches
union all
select '20261020000001_core_schema.sql:submit_report' as object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='submit_report' and replace(p.prosrc,chr(13),'') = $body$
declare
  v_uid uuid := (select auth.uid());
  v_title text := btrim(coalesce(p_title, ''));
  v_desc text := btrim(coalesce(p_description, ''));
  v_landmark text := nullif(btrim(coalesce(p_landmark, '')), '');
  v_inst uuid; v_ref text; v_id uuid; v_existing text; v_tries int := 0;
begin
  if p_idempotency_key is null then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;
  select reference into v_existing from public.reports where idempotency_key = p_idempotency_key;
  if found then return v_existing; end if;

  if length(v_title) not between 3 and 80 then raise exception 'title must be 3-80 characters' using errcode = '22023'; end if;
  if length(v_desc) not between 10 and 500 then raise exception 'description must be 10-500 characters' using errcode = '22023'; end if;
  if v_landmark is not null and length(v_landmark) > 100 then raise exception 'landmark too long' using errcode = '22023'; end if;
  if (p_lat is null) <> (p_lng is null) then raise exception 'provide both coordinates or neither' using errcode = '22023'; end if;
  if p_link_account and v_uid is null then raise exception 'sign in to link a report to an account' using errcode = '42501'; end if;

  select c.institution_id into v_inst from public.report_categories c
   where c.slug = p_category_slug and c.is_active;
  if not found then raise exception 'unknown category' using errcode = '22023'; end if;
  perform 1 from public.service_areas a where a.id = p_area_id and a.is_active;
  if not found then raise exception 'unknown area' using errcode = '22023'; end if;
  -- routing may be NULL (unrouted): the report is kept and appears in the admin queue.

  loop
    v_ref := public.generate_reference();
    begin
      insert into public.reports (reference, idempotency_key, reporter_id, title, description,
                                  category_slug, area_id, landmark, lat, lng, institution_id)
      values (v_ref, p_idempotency_key, case when p_link_account then v_uid end, v_title, v_desc,
              p_category_slug, p_area_id, v_landmark, round(p_lat, 2), round(p_lng, 2), v_inst)
      returning id into v_id;
      exit;
    exception when unique_violation then
      select reference into v_existing from public.reports where idempotency_key = p_idempotency_key;
      if found then return v_existing; end if;
      v_tries := v_tries + 1;
      if v_tries >= 5 then raise exception 'could not allocate a reference' using errcode = '55000'; end if;
    end;
  end loop;

  insert into public.report_updates (report_id, actor_id, old_status, new_status, note, is_public, institution_id)
  values (v_id, null, null, 'submitted', 'Report received', true, v_inst);
  return v_ref;
end $body$) as matches
union all
select '20261020000001_core_schema.sql:track_report' as object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='track_report' and replace(p.prosrc,chr(13),'') = $body$
declare
  v_ref text := upper(btrim(coalesce(p_reference, '')));
  r record;
begin
  if v_ref !~ '^DG-[0-9]{4}-[A-HJ-KM-NP-Z2-9]{6}$' then
    return jsonb_build_object('found', false, 'reason', 'invalid_format');
  end if;
  select rep.id, rep.status, rep.created_at, rep.updated_at, c.label as category, a.name as area
    into r
    from public.reports rep
    join public.report_categories c on c.slug = rep.category_slug
    join public.service_areas a on a.id = rep.area_id
   where rep.reference = v_ref;
  if not found then return jsonb_build_object('found', false, 'reason', 'not_found'); end if;
  return jsonb_build_object(
    'found', true, 'status', r.status, 'category', r.category, 'area', r.area,
    'submitted_at', r.created_at, 'updated_at', r.updated_at,
    'timeline', (select coalesce(jsonb_agg(jsonb_build_object(
                   'status', u.new_status, 'at', u.created_at,
                   'note', case when u.is_public then u.note end) order by u.created_at, u.id), '[]'::jsonb)
                 from public.report_updates u where u.report_id = r.id));
end $body$) as matches
union all
select '20261020000001_core_schema.sql:update_report_status' as object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='update_report_status' and replace(p.prosrc,chr(13),'') = $body$
declare
  v_uid uuid := (select auth.uid());
  v_admin boolean := public.is_admin();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  r public.reports;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into r from public.reports where id = p_report_id for update;
  -- identical error for "missing" and "not yours" so existence is not leaked
  if not found or not (v_admin or public.is_staff_of(r.institution_id)) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if not public.status_transition_allowed(r.status, p_new_status, v_admin) then
    raise exception 'transition % -> % is not allowed', r.status, p_new_status using errcode = '22023';
  end if;
  if p_new_status in ('resolved', 'rejected') and v_note is null then
    raise exception 'a resolution note or rejection reason is required' using errcode = '22023';
  end if;
  if length(v_note) > 1000 then raise exception 'note too long' using errcode = '22023'; end if;

  update public.reports set
    status = p_new_status,
    resolution_note = case when p_new_status in ('resolved', 'rejected') then v_note end,
    resolved_at = case when p_new_status = 'resolved' then now() end
  where id = r.id;

  insert into public.report_updates (report_id, actor_id, old_status, new_status, note, is_public, institution_id)
  values (r.id, v_uid, r.status, p_new_status, v_note,
          p_new_status in ('resolved', 'rejected') or coalesce(p_public, false), r.institution_id);
end $body$) as matches
union all
select '20261020000001_core_schema.sql:assign_report' as object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='assign_report' and replace(p.prosrc,chr(13),'') = $body$
declare
  v_uid uuid := (select auth.uid());
  v_name text; r public.reports;
begin
  if v_uid is null or not public.is_admin() then raise exception 'not permitted' using errcode = '42501'; end if;
  select name into v_name from public.institutions where id = p_institution_id and is_active;
  if not found then raise exception 'unknown or inactive institution' using errcode = '22023'; end if;
  select * into r from public.reports where id = p_report_id for update;
  if not found then raise exception 'not permitted' using errcode = '42501'; end if;

  update public.reports set institution_id = p_institution_id,
    status = case when status in ('submitted', 'under_review') then 'assigned' else status end
  where id = r.id;
  insert into public.report_updates (report_id, actor_id, old_status, new_status, note, is_public, institution_id)
  values (r.id, v_uid, r.status,
          case when r.status in ('submitted', 'under_review') then 'assigned'::public.report_status else r.status end,
          'Assigned to ' || v_name, true, p_institution_id);
  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (v_uid, 'assign_report', 'reports', r.id::text,
          jsonb_build_object('from', r.institution_id, 'to', p_institution_id));
end $body$) as matches
union all
select '20261020000001_core_schema.sql:set_report_visibility' as object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='set_report_visibility' and replace(p.prosrc,chr(13),'') = $body$
declare v_uid uuid := (select auth.uid()); r public.reports;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into r from public.reports where id = p_report_id for update;
  if not found or not (public.is_admin() or public.is_staff_of(r.institution_id)) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  update public.reports set is_public = coalesce(p_public, false) where id = r.id;
  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (v_uid, 'set_visibility', 'reports', r.id::text, jsonb_build_object('is_public', p_public));
end $body$) as matches
union all
select '20261020000001_core_schema.sql:admin_set_role' as object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_set_role' and replace(p.prosrc,chr(13),'') = $body$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not public.is_admin() then raise exception 'not permitted' using errcode = '42501'; end if;
  if p_user = v_uid and p_role <> 'admin' then
    raise exception 'admins cannot remove their own admin role' using errcode = '22023';
  end if;
  if p_role = 'staff' then
    perform 1 from public.institutions where id = p_institution and is_active;
    if not found then raise exception 'staff need an active institution' using errcode = '22023'; end if;
  end if;
  update public.profiles
     set role = p_role, institution_id = case when p_role = 'staff' then p_institution end
   where id = p_user;
  if not found then raise exception 'unknown user' using errcode = '22023'; end if;
  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (v_uid, 'set_role', 'profiles', p_user::text,
          jsonb_build_object('role', p_role, 'institution_id', p_institution));
end $body$) as matches
union all
select '20261020000001_core_schema.sql:review_ai_assessment' as object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='review_ai_assessment' and replace(p.prosrc,chr(13),'') = $body$
declare v_uid uuid := (select auth.uid()); a public.ai_assessments;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_outcome not in ('accepted', 'corrected', 'dismissed') then
    raise exception 'invalid outcome' using errcode = '22023';
  end if;
  select * into a from public.ai_assessments where id = p_id for update;
  if not found or not public.can_manage_report(a.report_id) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  update public.ai_assessments
     set status = p_outcome, reviewed_by = v_uid, reviewed_at = now(),
         suggestion = case when p_outcome = 'corrected' and p_corrected is not null then p_corrected else suggestion end
   where id = a.id;
end $body$) as matches
union all
select '20261020000001_core_schema.sql:public_reports' as object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='public_reports' and replace(p.prosrc,chr(13),'') = $body$
  select r.title, c.label, a.name, r.status, r.created_at, r.lat, r.lng
    from public.reports r
    join public.report_categories c on c.slug = r.category_slug
    join public.service_areas a on a.id = r.area_id
   where r.is_public
   order by r.created_at desc
   limit 500
$body$) as matches
union all
select '20261020000001_core_schema.sql:public_stats' as object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='public_stats' and replace(p.prosrc,chr(13),'') = $body$
  select jsonb_build_object(
    'total', (select count(*) from public.reports),
    'by_status', coalesce((select jsonb_object_agg(status, n) from
                  (select status, count(*) n from public.reports group by status) s), '{}'::jsonb),
    'by_category', coalesce((select jsonb_object_agg(c.label, n) from
                  (select category_slug, count(*) n from public.reports group by category_slug) x
                  join public.report_categories c on c.slug = x.category_slug), '{}'::jsonb),
    'by_area', coalesce((select jsonb_object_agg(a.name, n) from
                  (select area_id, count(*) n from public.reports group by area_id) x
                  join public.service_areas a on a.id = x.area_id), '{}'::jsonb))
$body$) as matches
union all
select '20261020000002_ai_support.sql:ai_rate_limit_hit' as object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ai_rate_limit_hit' and replace(p.prosrc,chr(13),'') = $body$
declare v_hits int;
begin
  insert into public.ai_rate_limits (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when public.ai_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
                then 1 else public.ai_rate_limits.hits + 1 end,
    window_start = case when public.ai_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
                        then now() else public.ai_rate_limits.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end $body$) as matches
union all
select '20261020000002_ai_support.sql:find_duplicate_candidates' as object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='find_duplicate_candidates' and replace(p.prosrc,chr(13),'') = $body$
  select * from (
    select c.id as report_id, c.reference, c.title, c.status,
           extensions.similarity(c.title || ' ' || c.description, s.title || ' ' || s.description)::real as similarity,
           d.dist as distance_km,
           (c.area_id = s.area_id) as same_area,
           c.created_at
      from public.reports s
      join public.reports c
        on c.id <> s.id
       and c.category_slug = s.category_slug
       and c.institution_id is not distinct from s.institution_id
       and c.created_at > now() - interval '90 days'
      cross join lateral (
        select case when s.lat is not null and c.lat is not null then
          round((6371 * 2 * asin(sqrt(
            power(sin(radians(c.lat - s.lat) / 2), 2) +
            cos(radians(s.lat)) * cos(radians(c.lat)) * power(sin(radians(c.lng - s.lng) / 2), 2)
          )))::numeric, 2) end as dist) d
     where s.id = p_report_id
  ) x
  where x.similarity >= p_threshold and (x.same_area or x.distance_km <= 2)
  order by x.similarity desc
  limit least(greatest(p_limit, 1), 20)
$body$) as matches;
