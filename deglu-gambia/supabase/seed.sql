-- DEVELOPMENT SEED ONLY. Runs on `supabase db reset` (local). Never run against production.
-- Institution names and routing are PLACEHOLDERS for the demo: confirm real names with the
-- project team (SRS Appendix C, item 4) before any real deployment.
-- No users are seeded. Create the first admin using docs/supabase-setup.md.

insert into public.institutions (name, description) values
  ('Banjul City Council (demo)',            'Placeholder: city services for Banjul'),
  ('Kanifing Municipal Council (demo)',     'Placeholder: municipal services for Serrekunda area'),
  ('Brikama Area Council (demo)',           'Placeholder: local services for Brikama area'),
  ('Ministry of Works (demo)',              'Placeholder: roads and public infrastructure'),
  ('Water and Utilities Authority (demo)',  'Placeholder: water, drainage, electricity');

insert into public.service_areas (name, centre_lat, centre_lng) values
  ('Banjul',     13.45490, -16.57900),
  ('Serrekunda', 13.43830, -16.67810),
  ('Brikama',    13.27140, -16.64940),
  ('Farafenni',  13.56670, -15.60000),
  ('Basse',      13.31000, -14.21000);

-- Category -> institution routing. A NULL institution means "unrouted": the report is kept
-- and shown in the admin review queue.
insert into public.report_categories (slug, label, institution_id) values
  ('waste_sanitation',        'Waste & Sanitation',        (select id from public.institutions where name like 'Kanifing%')),
  ('roads_transport',         'Roads & Transport',         (select id from public.institutions where name like 'Ministry of Works%')),
  ('water_drainage',          'Water & Drainage',          (select id from public.institutions where name like 'Water and Utilities%')),
  ('electricity_streetlights','Electricity & Streetlights',(select id from public.institutions where name like 'Water and Utilities%')),
  ('public_safety',           'Public Safety',             null),
  ('public_facilities',       'Public Facilities',         (select id from public.institutions where name like 'Brikama%')),
  ('environmental_issues',    'Environmental Issues',      null),
  ('other',                   'Other',                     null);
