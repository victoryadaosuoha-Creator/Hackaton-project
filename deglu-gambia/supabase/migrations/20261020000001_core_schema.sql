-- Déglu Gambia: core schema, RLS, and trusted functions (SRS v1.1 §6, §13, §14)
-- Design rules:
--   * Browser roles (anon/authenticated) get NO direct write access to reports or history.
--     All writes go through SECURITY DEFINER functions that validate input and authorisation.
--   * Every table has RLS enabled. Policies are least-privilege.
--   * History/audit tables are append-only (triggers block UPDATE/DELETE/TRUNCATE).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- types
create type public.app_role as enum ('citizen', 'staff', 'admin');
create type public.report_status as enum
  ('submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'rejected');

-- ---------------------------------------------------------------- shared trigger functions
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

create function public.reject_modification() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'table % is append-only', tg_table_name using errcode = '42501'; end $$;

-- ---------------------------------------------------------------- reference data
create table public.institutions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 2 and 120),
  description text check (length(description) <= 500),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index institutions_name_key on public.institutions (lower(btrim(name)));
create trigger institutions_updated before update on public.institutions
  for each row execute function public.set_updated_at();

create table public.service_areas (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 2 and 60),
  centre_lat numeric(8,5) check (centre_lat between 13.0 and 13.9),
  centre_lng numeric(8,5) check (centre_lng between -16.9 and -13.7),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index service_areas_name_key on public.service_areas (lower(btrim(name)));
create trigger service_areas_updated before update on public.service_areas
  for each row execute function public.set_updated_at();

create table public.report_categories (
  slug           text primary key check (slug ~ '^[a-z0-9_]{2,40}$'),
  label          text not null check (length(btrim(label)) between 2 and 80),
  institution_id uuid references public.institutions(id) on delete restrict, -- null = unassigned/admin queue
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger report_categories_updated before update on public.report_categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  display_name       text check (length(display_name) <= 80),
  role               public.app_role not null default 'citizen',
  institution_id     uuid references public.institutions(id) on delete restrict,
  is_active          boolean not null default true,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'wo', 'mnk')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check ((role = 'staff') = (institution_id is not null))
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- reports
create table public.reports (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique
                  check (reference ~ '^DG-[0-9]{4}-[A-HJ-KM-NP-Z2-9]{6}$'),
  idempotency_key uuid not null unique,
  reporter_id     uuid references public.profiles(id) on delete set null, -- NULL = anonymous
  title           text not null check (length(title) between 3 and 80),
  description     text not null check (length(description) between 10 and 500),
  category_slug   text not null references public.report_categories(slug) on delete restrict,
  area_id         uuid not null references public.service_areas(id) on delete restrict,
  landmark        text check (length(landmark) <= 100),
  lat             numeric(8,5),
  lng             numeric(8,5),
  status          public.report_status not null default 'submitted',
  institution_id  uuid references public.institutions(id) on delete restrict, -- routing snapshot
  is_public       boolean not null default false, -- set by staff/admin after review
  resolution_note text check (length(resolution_note) <= 1000), -- resolution note OR rejection reason
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check ((lat is null) = (lng is null)),
  check (lat is null or (lat between 13.0 and 13.9 and lng between -16.9 and -13.7)),
  check (status not in ('resolved', 'rejected') or resolution_note is not null),
  check (status <> 'resolved' or resolved_at is not null)
);
create index reports_queue_idx    on public.reports (institution_id, status, created_at desc);
create index reports_reporter_idx on public.reports (reporter_id) where reporter_id is not null;
create index reports_public_idx   on public.reports (created_at desc) where is_public;
create trigger reports_updated before update on public.reports
  for each row execute function public.set_updated_at();

-- Append-only status history. actor_id has no FK so history survives account deletion.
create table public.report_updates (
  id             bigint generated always as identity primary key,
  report_id      uuid not null references public.reports(id) on delete restrict,
  actor_id       uuid,                      -- NULL = system / initial submission
  old_status     public.report_status,
  new_status     public.report_status not null,
  note           text check (length(note) <= 1000),
  is_public      boolean not null default false, -- only public notes reach citizens
  institution_id uuid,                      -- snapshot at time of change
  created_at     timestamptz not null default now()
);
create index report_updates_report_idx on public.report_updates (report_id, created_at);

create table public.report_internal_notes (
  id         bigint generated always as identity primary key,
  report_id  uuid not null references public.reports(id) on delete restrict,
  author_id  uuid not null,
  body       text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index report_internal_notes_report_idx on public.report_internal_notes (report_id);

create table public.audit_logs (
  id           bigint generated always as identity primary key,
  actor_id     uuid,
  action       text not null,
  target_table text not null,
  target_id    text,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- AI suggestions are advisory. Written only by the trusted Edge Function (service role).
create table public.ai_assessments (
  id          bigint generated always as identity primary key,
  report_id   uuid not null references public.reports(id) on delete restrict,
  kind        text not null check (kind in ('category', 'summary', 'priority', 'duplicate')),
  suggestion  jsonb not null,
  confidence  numeric(4,3) check (confidence between 0 and 1),
  model       text,
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'corrected', 'dismissed')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index ai_assessments_report_idx on public.ai_assessments (report_id);

-- append-only enforcement
create trigger report_updates_append_only before update or delete on public.report_updates
  for each row execute function public.reject_modification();
create trigger report_updates_no_truncate before truncate on public.report_updates
  for each statement execute function public.reject_modification();
create trigger internal_notes_append_only before update or delete on public.report_internal_notes
  for each row execute function public.reject_modification();
create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function public.reject_modification();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function public.reject_modification();

-- ---------------------------------------------------------------- authorisation helpers
-- SECURITY DEFINER so policies can call them without recursive RLS. Never trust client-supplied roles.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p
                 where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active)
$$;

create function public.is_staff_of(p_institution uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_institution is not null and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'staff' and p.is_active
      and p.institution_id = p_institution)
$$;

create function public.can_manage_report(p_report uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reports r
                 where r.id = p_report and (public.is_admin() or public.is_staff_of(r.institution_id)))
$$;

create function public.owns_report(p_report uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reports r
                 where r.id = p_report and r.reporter_id = (select auth.uid()))
$$;

-- ---------------------------------------------------------------- profile creation and protection
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Role is ALWAYS 'citizen' here; signup metadata is never trusted for privileges.
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80), ''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Defence in depth: even if a grant is widened later, non-admins cannot touch privileged columns.
-- Trusted contexts with no JWT (SQL editor, migrations) have auth.uid() = NULL and are allowed.
create function public.guard_profile_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() and (
       new.id is distinct from old.id or new.role is distinct from old.role
       or new.institution_id is distinct from old.institution_id
       or new.is_active is distinct from old.is_active) then
    raise exception 'not permitted to change privileged profile fields' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Generic audit trigger for admin-managed configuration tables.
create function public.log_admin_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values ((select auth.uid()), lower(tg_op), tg_table_name,
          coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'slug'),
          jsonb_build_object('new', to_jsonb(new)));
  return new;
end $$;
create trigger institutions_audit after insert or update on public.institutions
  for each row execute function public.log_admin_change();
create trigger service_areas_audit after insert or update on public.service_areas
  for each row execute function public.log_admin_change();
create trigger report_categories_audit after insert or update on public.report_categories
  for each row execute function public.log_admin_change();

-- ---------------------------------------------------------------- workflow helpers
create function public.generate_reference() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- 31 chars, no I/L/O/0/1
  b bytea := extensions.gen_random_bytes(6);
  s text := '';
begin
  for i in 0..5 loop
    s := s || substr(alphabet, (get_byte(b, i) % 31) + 1, 1);
  end loop;
  return 'DG-' || to_char(now() at time zone 'utc', 'YYYY') || '-' || s;
end $$;

create function public.status_transition_allowed(
  p_old public.report_status, p_new public.report_status, p_admin boolean) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(case p_old
    when 'submitted'    then p_new in ('under_review', 'assigned', 'rejected')
    when 'under_review' then p_new in ('assigned', 'in_progress', 'resolved', 'rejected')
    when 'assigned'     then p_new in ('under_review', 'in_progress', 'rejected')
    when 'in_progress'  then p_new in ('under_review', 'resolved', 'rejected')
    when 'resolved'     then p_admin and p_new = 'in_progress'  -- reopen: admin only
    when 'rejected'     then p_admin and p_new = 'under_review' -- reconsider: admin only
  end, false)
$$;

-- ---------------------------------------------------------------- public submission (anon + authenticated)
-- Validates on the trusted boundary, routes by category, and writes the report plus its first
-- history row in ONE transaction. A retry with the same idempotency key returns the same reference.
-- Anonymous callers never have identity stored. Signed-in callers are linked only if p_link_account = true.
create function public.submit_report(
  p_idempotency_key uuid, p_title text, p_description text, p_category_slug text,
  p_area_id uuid, p_landmark text default null, p_lat numeric default null,
  p_lng numeric default null, p_link_account boolean default false) returns text
language plpgsql security definer set search_path = '' as $$
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
end $$;

-- Public tracking: returns ONLY safe fields. No description, title, landmark, coordinates,
-- reporter, internal notes, or staff identities. The reference is not a key to private data.
create function public.track_report(p_reference text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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
end $$;

-- ---------------------------------------------------------------- staff / admin operations
create function public.update_report_status(
  p_report_id uuid, p_new_status public.report_status,
  p_note text default null, p_public boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
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
end $$;

create function public.assign_report(p_report_id uuid, p_institution_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
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
end $$;

create function public.set_report_visibility(p_report_id uuid, p_public boolean) returns void
language plpgsql security definer set search_path = '' as $$
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
end $$;

create function public.admin_set_role(
  p_user uuid, p_role public.app_role, p_institution uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
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
end $$;

create function public.review_ai_assessment(
  p_id bigint, p_outcome text, p_corrected jsonb default null) returns void
language plpgsql security definer set search_path = '' as $$
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
end $$;

-- ---------------------------------------------------------------- public read APIs (approved fields only)
create function public.public_reports() returns table (
  title text, category text, area text, status public.report_status,
  created_at timestamptz, lat numeric, lng numeric)
language sql stable security definer set search_path = '' as $$
  select r.title, c.label, a.name, r.status, r.created_at, r.lat, r.lng
    from public.reports r
    join public.report_categories c on c.slug = r.category_slug
    join public.service_areas a on a.id = r.area_id
   where r.is_public
   order by r.created_at desc
   limit 500
$$;

create function public.public_stats() returns jsonb
language sql stable security definer set search_path = '' as $$
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
$$;

-- ---------------------------------------------------------------- row level security
alter table public.institutions          enable row level security;
alter table public.service_areas         enable row level security;
alter table public.report_categories     enable row level security;
alter table public.profiles              enable row level security;
alter table public.reports               enable row level security;
alter table public.report_updates        enable row level security;
alter table public.report_internal_notes enable row level security;
alter table public.audit_logs            enable row level security;
alter table public.ai_assessments        enable row level security;

-- reference data: readable when active; admin-managed
create policy institutions_read on public.institutions for select to anon, authenticated
  using (is_active or public.is_admin());
create policy institutions_ins on public.institutions for insert to authenticated with check (public.is_admin());
create policy institutions_upd on public.institutions for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy areas_read on public.service_areas for select to anon, authenticated
  using (is_active or public.is_admin());
create policy areas_ins on public.service_areas for insert to authenticated with check (public.is_admin());
create policy areas_upd on public.service_areas for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy categories_read on public.report_categories for select to anon, authenticated
  using (is_active or public.is_admin());
create policy categories_ins on public.report_categories for insert to authenticated with check (public.is_admin());
create policy categories_upd on public.report_categories for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- profiles: own row (or admin). Update limited to display_name / preferred_language by column grant.
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());
create policy profiles_upd_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- reports: read-only for browser roles. No insert/update/delete policy exists on purpose.
create policy reports_read on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_admin() or public.is_staff_of(institution_id));

-- history: citizens see only PUBLIC entries on their own reports; staff/admin see all in scope
create policy updates_read on public.report_updates for select to authenticated
  using (public.can_manage_report(report_id) or (is_public and public.owns_report(report_id)));

-- internal notes: staff/admin only, never citizens or the public
create policy notes_read on public.report_internal_notes for select to authenticated
  using (public.can_manage_report(report_id));
create policy notes_ins on public.report_internal_notes for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_manage_report(report_id));

create policy audit_read on public.audit_logs for select to authenticated using (public.is_admin());

create policy ai_read on public.ai_assessments for select to authenticated
  using (public.can_manage_report(report_id));

-- ---------------------------------------------------------------- grants (explicit, least privilege)
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on public.institutions, public.service_areas, public.report_categories to anon, authenticated;
grant insert, update on public.institutions, public.service_areas, public.report_categories to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, preferred_language) on public.profiles to authenticated;
grant select on public.reports, public.report_updates, public.report_internal_notes,
                public.audit_logs, public.ai_assessments to authenticated;
grant insert on public.report_internal_notes to authenticated;
grant usage on sequence public.report_internal_notes_id_seq to authenticated;

-- helpers used inside policies
grant execute on function public.is_admin(), public.is_staff_of(uuid),
                          public.can_manage_report(uuid), public.owns_report(uuid)
  to anon, authenticated;
-- public RPCs
grant execute on function public.submit_report(uuid, text, text, text, uuid, text, numeric, numeric, boolean),
                          public.track_report(text), public.public_reports(), public.public_stats()
  to anon, authenticated;
-- signed-in only RPCs (authorisation is re-checked inside each function)
grant execute on function public.update_report_status(uuid, public.report_status, text, boolean),
                          public.assign_report(uuid, uuid), public.set_report_visibility(uuid, boolean),
                          public.admin_set_role(uuid, public.app_role, uuid),
                          public.review_ai_assessment(bigint, text, jsonb)
  to authenticated;
