-- Support objects for the `ai` Edge Function.
-- Both functions are executable ONLY by service_role (the Edge Function), never by browser roles.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------- rate limiting (fixed window)
create table public.ai_rate_limits (
  key          text primary key,           -- "<action>:<sha256 of salt+ip>" or "u:<user id>"
  window_start timestamptz not null,
  hits         int not null
);
alter table public.ai_rate_limits enable row level security;  -- no policies: service_role only
revoke all on public.ai_rate_limits from anon, authenticated;

-- Returns TRUE if the call is within the limit, FALSE if the caller is over it. Atomic.
create function public.ai_rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = '' as $$
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
end $$;

-- ---------------------------------------------------------------- duplicate candidates
-- Transparent, non-AI method: same category + same institution + last 90 days, then
-- (same area OR within ~2 km) AND trigram text similarity >= threshold.
-- Coordinates are stored rounded to 2 decimals (~1 km), so distance is approximate.
-- Candidates are ADVISORY. Nothing is merged, hidden or deleted.
create function public.find_duplicate_candidates(
  p_report_id uuid, p_threshold real default 0.35, p_limit int default 5)
returns table (report_id uuid, reference text, title text, status public.report_status,
               similarity real, distance_km numeric, same_area boolean, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
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
$$;

revoke all on function public.ai_rate_limit_hit(text, int, int) from public, anon, authenticated;
revoke all on function public.find_duplicate_candidates(uuid, real, int) from public, anon, authenticated;
grant execute on function public.ai_rate_limit_hit(text, int, int) to service_role;
grant execute on function public.find_duplicate_candidates(uuid, real, int) to service_role;
