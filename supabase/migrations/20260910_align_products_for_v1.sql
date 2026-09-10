-- Luxe Horizon V1 production schema alignment
-- Safe to run more than once.

begin;

alter table public.products
  add column if not exists ai_suggested_gender text,
  add column if not exists ai_suggested_category text,
  add column if not exists ai_suggested_brand text,
  add column if not exists ai_confidence numeric,
  add column if not exists review_status text default 'pending',
  add column if not exists is_active boolean default true,
  add column if not exists is_published boolean default false,
  add column if not exists sort_order integer default 0,
  add column if not exists updated_at timestamptz default now();

-- Normalize required/default values so uploads, review, publish and catalogue
-- all share one consistent contract.
update public.products
set
  gender = coalesce(nullif(trim(gender), ''), 'unknown'),
  category = coalesce(nullif(trim(category), ''), 'other'),
  brand = coalesce(brand, ''),
  review_status = coalesce(nullif(trim(review_status), ''), 'pending'),
  is_active = coalesce(is_active, true),
  is_published = coalesce(is_published, false),
  sort_order = coalesce(sort_order, 0),
  updated_at = coalesce(updated_at, created_at, now());

alter table public.products
  alter column gender set default 'unknown',
  alter column category set default 'other',
  alter column brand set default '',
  alter column review_status set default 'pending',
  alter column is_active set default true,
  alter column is_published set default false,
  alter column sort_order set default 0,
  alter column updated_at set default now();

alter table public.products
  alter column review_status set not null,
  alter column is_active set not null,
  alter column is_published set not null,
  alter column sort_order set not null;

-- Keep review states predictable without blocking an existing deployment that
-- may already have a differently named constraint.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_review_status_check'
  ) then
    alter table public.products
      add constraint products_review_status_check
      check (review_status in ('pending', 'reviewed', 'approved'));
  end if;
end $$;

create index if not exists products_collection_created_idx
  on public.products (collection_id, created_at desc);

create index if not exists products_collection_review_idx
  on public.products (collection_id, review_status);

create index if not exists products_collection_publish_idx
  on public.products (collection_id, is_published, is_active);

create index if not exists product_images_product_sort_idx
  on public.product_images (product_id, sort_order);

-- Make updated_at reliable for admin edits without requiring app code to set it.
create or replace function public.set_luxe_horizon_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_luxe_horizon_updated_at();

commit;
