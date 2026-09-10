-- Luxe Horizon production taxonomy fix
-- This removes the old limited category check that rejected categories such as
-- scarves, hats, eyewear, jewellery, wallets and belts during mobile review.

begin;

update public.products
set category = lower(trim(category))
where category is not null;

update public.products
set category = 'other'
where category is null
   or category = ''
   or lower(category) not in (
    'clothing',
    'footwear',
    'watches',
    'bags',
    'accessories',
    'eyewear',
    'jewellery',
    'wallets',
    'belts',
    'hats',
    'scarves',
    'other'
   );

alter table public.products
  alter column category set default 'other';

alter table public.products
  drop constraint if exists products_category_check;

alter table public.products
  add constraint products_category_check
  check (category in (
    'clothing',
    'footwear',
    'watches',
    'bags',
    'accessories',
    'eyewear',
    'jewellery',
    'wallets',
    'belts',
    'hats',
    'scarves',
    'other'
  ));

commit;
