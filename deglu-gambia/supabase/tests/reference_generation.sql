-- Stress-check the existing generator. This test does not change schema or persist data.
begin;
do $$
begin
  if exists(select 1 from generate_series(1,2000) where public.generate_reference() !~ '^DG-[0-9]{4}-[A-HJ-KM-NP-Z2-9]{6}$') then raise exception 'FAIL: malformed reference generated'; end if;
  raise notice '2000 reference-generation checks passed';
end $$;
rollback;
