-- Déglu Gambia core schema, RLS, and privileged functions.
-- Apply through the Supabase SQL editor or CLI. Do not treat this as live
-- until it has been applied to a project and verified.

create extension if not exists pgcrypto;

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique check (char_length(trim(name)) > 0),
  active boolean not null default true
);

create table if not exists public.categories (
  id text primary key,
  label text not null check (char_length(trim(label)) > 0),
  institution_id uuid references public.institutions (id)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('institution', 'admin')),
  institution_id uuid references public.institutions (id),
  display_name text not null,
  active boolean not null default true,
  constraint staff_requires_institution check (
    role <> 'institution' or institution_id is not null
  )
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  title text not null check (char_length(trim(title)) > 0),
  description text not null check (char_length(trim(description)) >= 12),
  category_id text not null references public.categories (id),
  status text not null check (
    status in ('submitted', 'under_review', 'assigned', 'in_progress', 'resolved')
  ),
  community_id text not null,
  landmark text not null check (char_length(trim(landmark)) > 0),
  location_label text not null,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  support_count integer not null default 1,
  institution_id uuid references public.institutions (id),
  assignment text not null check (assignment in ('assigned', 'unassigned')),
  idempotency_key text not null unique
);

create table if not exists public.report_updates (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  at timestamptz not null default timezone('utc', now()),
  status text not null,
  public_note text not null default '',
  internal_note text not null default '',
  actor_id uuid references public.profiles (id),
  author_role text not null,
  author_label text not null
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default timezone('utc', now()),
  actor_id uuid,
  actor_label text not null,
  action text not null,
  detail text not null
);

create index if not exists reports_institution_idx on public.reports (institution_id);
create index if not exists reports_status_idx on public.reports (status);
create index if not exists report_updates_report_idx on public.report_updates (report_id, at);

alter table public.institutions enable row level security;
alter table public.categories enable row level security;
alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.report_updates enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active
      and p.role = 'admin'
  );
$$;

create or replace function public.current_staff_institution()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.institution_id
  from public.profiles p
  where p.id = auth.uid()
    and p.active
    and p.role = 'institution';
$$;

drop policy if exists institutions_public_read on public.institutions;
create policy institutions_public_read on public.institutions
  for select to anon, authenticated
  using (true);

drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories
  for select to anon, authenticated
  using (true);

drop policy if exists categories_admin_update on public.categories;
create policy categories_admin_update on public.categories
  for update to authenticated
  using (public.is_active_admin())
  with check (public.is_active_admin());

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_active_admin());

drop policy if exists profiles_no_self_privilege on public.profiles;
create policy profiles_no_self_privilege on public.profiles
  for update to authenticated
  using (public.is_active_admin())
  with check (public.is_active_admin());

drop policy if exists reports_staff_select on public.reports;
create policy reports_staff_select on public.reports
  for select to authenticated
  using (
    public.is_active_admin()
    or institution_id = public.current_staff_institution()
  );

drop policy if exists updates_staff_select on public.report_updates;
create policy updates_staff_select on public.report_updates
  for select to authenticated
  using (
    exists (
      select 1
      from public.reports r
      where r.id = report_id
        and (
          public.is_active_admin()
          or r.institution_id = public.current_staff_institution()
        )
    )
  );

drop policy if exists audit_admin_select on public.audit_logs;
create policy audit_admin_select on public.audit_logs
  for select to authenticated
  using (public.is_active_admin());

create or replace function public.generate_report_reference()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  suffix text := '';
  i integer;
  bytes bytea;
begin
  bytes := gen_random_bytes(5);
  for i in 0..4 loop
    suffix := suffix || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return 'DG-' || to_char(timezone('utc', now()), 'YYYY') || '-' || suffix;
end;
$$;

create or replace function public.submit_public_report(
  p_title text,
  p_description text,
  p_category_id text,
  p_community_id text,
  p_landmark text,
  p_lat double precision,
  p_lng double precision,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.reports%rowtype;
  v_category public.categories%rowtype;
  v_institution_id uuid;
  v_assignment text;
  v_reference text;
  v_id uuid;
  v_now timestamptz := timezone('utc', now());
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'invalid idempotency key';
  end if;

  select * into v_existing from public.reports where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'reference', v_existing.reference, 'duplicate', true);
  end if;

  if char_length(trim(p_title)) = 0 or char_length(trim(p_description)) < 12 then
    raise exception 'invalid report fields';
  end if;

  select * into v_category from public.categories where id = p_category_id;
  if not found then
    raise exception 'unknown category';
  end if;

  v_institution_id := v_category.institution_id;
  v_assignment := case when v_institution_id is null then 'unassigned' else 'assigned' end;
  v_reference := public.generate_report_reference();
  v_id := gen_random_uuid();

  insert into public.reports (
    id, reference, title, description, category_id, status, community_id, landmark,
    location_label, lat, lng, created_at, updated_at, institution_id, assignment, idempotency_key
  ) values (
    v_id,
    v_reference,
    trim(p_title),
    trim(p_description),
    p_category_id,
    'submitted',
    p_community_id,
    trim(p_landmark),
    trim(p_community_id) || ' · ' || trim(p_landmark),
    p_lat,
    p_lng,
    v_now,
    v_now,
    v_institution_id,
    v_assignment,
    p_idempotency_key
  );

  insert into public.report_updates (
    report_id, at, status, public_note, internal_note, author_role, author_label
  ) values (
    v_id,
    v_now,
    'submitted',
    case
      when v_institution_id is null then
        'Report received. Routing is unavailable, so this was placed in the administrative review queue.'
      else
        'Report received and routed using the current category configuration.'
    end,
    '',
    'citizen',
    'Public form'
  );

  return jsonb_build_object('id', v_id, 'reference', v_reference, 'duplicate', false);
end;
$$;

create or replace function public.track_public_report(p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports%rowtype;
  v_updates jsonb;
begin
  select * into v_report
  from public.reports
  where upper(reference) = upper(trim(p_reference));

  if not found then
    return jsonb_build_object('found', false);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', u.id,
        'at', u.at,
        'status', u.status,
        'publicNote', u.public_note,
        'authorLabel', u.author_label
      )
      order by u.at
    ),
    '[]'::jsonb
  )
  into v_updates
  from public.report_updates u
  where u.report_id = v_report.id;

  return jsonb_build_object(
    'found', true,
    'report', jsonb_build_object(
      'id', v_report.id,
      'reference', v_report.reference,
      'title', v_report.title,
      'description', v_report.description,
      'category', v_report.category_id,
      'status', v_report.status,
      'communityId', v_report.community_id,
      'landmark', v_report.landmark,
      'locationLabel', v_report.location_label,
      'createdAt', v_report.created_at,
      'updatedAt', v_report.updated_at,
      'assignment', v_report.assignment,
      'updates', v_updates
    )
  );
end;
$$;

create or replace function public.update_report_status(
  p_report_id uuid,
  p_status text,
  p_public_note text default '',
  p_internal_note text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_report public.reports%rowtype;
  v_order text[] := array['submitted', 'under_review', 'assigned', 'in_progress', 'resolved'];
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null or not v_profile.active then
    raise exception 'staff profile inactive or missing';
  end if;

  if p_status is null or not (p_status = any (v_order)) then
    raise exception 'invalid status';
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'report not found';
  end if;

  if v_profile.role = 'institution' then
    if v_report.institution_id is distinct from v_profile.institution_id then
      raise exception 'forbidden';
    end if;
  elsif v_profile.role <> 'admin' then
    raise exception 'forbidden';
  end if;

  if array_position(v_order, p_status) < array_position(v_order, v_report.status) then
    raise exception 'status transition not allowed';
  end if;

  update public.reports
  set
    status = p_status,
    updated_at = timezone('utc', now()),
    assignment = case
      when p_status <> 'submitted' and assignment = 'unassigned' and v_profile.role = 'admin'
        then 'assigned'
      else assignment
    end
  where id = p_report_id;

  insert into public.report_updates (
    report_id, at, status, public_note, internal_note, actor_id, author_role, author_label
  ) values (
    p_report_id,
    timezone('utc', now()),
    p_status,
    coalesce(p_public_note, ''),
    coalesce(p_internal_note, ''),
    auth.uid(),
    v_profile.role,
    v_profile.display_name
  );
end;
$$;

create or replace function public.set_category_routing(
  p_category_id text,
  p_institution_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null or not v_profile.active or v_profile.role <> 'admin' then
    raise exception 'forbidden';
  end if;

  update public.categories
  set institution_id = p_institution_id
  where id = p_category_id;

  insert into public.audit_logs (actor_id, actor_label, action, detail)
  values (
    auth.uid(),
    v_profile.display_name,
    'routing.update',
    p_category_id || ' → ' || coalesce(p_institution_id::text, 'unassigned')
  );
end;
$$;

revoke all on function public.submit_public_report(text, text, text, text, text, double precision, double precision, text) from public;
revoke all on function public.track_public_report(text) from public;
revoke all on function public.update_report_status(uuid, text, text, text) from public;
revoke all on function public.set_category_routing(text, uuid) from public;
revoke all on function public.is_active_admin() from public;
revoke all on function public.current_staff_institution() from public;

grant execute on function public.submit_public_report(text, text, text, text, text, double precision, double precision, text) to anon, authenticated;
grant execute on function public.track_public_report(text) to anon, authenticated;
grant execute on function public.update_report_status(uuid, text, text, text) to authenticated;
grant execute on function public.set_category_routing(text, uuid) to authenticated;

-- Demonstration reference data. Replace names before any operational deployment.
insert into public.institutions (slug, name, active)
values
  ('bcc', 'Banjul City Council', true),
  ('kanifing', 'Kanifing Municipal Council', true)
on conflict (slug) do nothing;

insert into public.categories (id, label, institution_id)
select v.id, v.label, i.id
from (
  values
    ('waste_sanitation', 'Waste & Sanitation', 'bcc'),
    ('roads_transport', 'Roads & Transport', 'bcc'),
    ('water_drainage', 'Water & Drainage', 'bcc'),
    ('electricity_streetlights', 'Electricity & Streetlights', 'kanifing'),
    ('public_safety', 'Public Safety', 'bcc'),
    ('public_facilities', 'Public Facilities', 'bcc'),
    ('environmental', 'Environmental Issues', 'kanifing'),
    ('other', 'Other', null)
) as v(id, label, slug)
left join public.institutions i on i.slug = v.slug
on conflict (id) do nothing;
