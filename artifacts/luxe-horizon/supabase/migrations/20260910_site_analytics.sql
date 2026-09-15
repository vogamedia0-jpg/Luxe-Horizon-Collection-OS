create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  event_type text not null default 'site_visit',
  path text not null default '/',
  ref text,
  product_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists site_visits_created_at_idx on public.site_visits (created_at desc);
create index if not exists site_visits_visitor_id_idx on public.site_visits (visitor_id);
create index if not exists site_visits_event_type_idx on public.site_visits (event_type);
create index if not exists site_visits_ref_idx on public.site_visits (ref);

alter table public.site_visits enable row level security;
