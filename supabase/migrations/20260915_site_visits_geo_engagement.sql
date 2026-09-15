alter table public.site_visits
  add column if not exists session_id text,
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists duration_seconds integer,
  add column if not exists scroll_depth integer;

create index if not exists site_visits_session_id_idx
  on public.site_visits (session_id);

create index if not exists site_visits_country_idx
  on public.site_visits (country);

create index if not exists site_visits_city_idx
  on public.site_visits (city);
