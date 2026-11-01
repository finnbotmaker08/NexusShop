create or replace function public.is_ventex_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from auth.users
    where id = auth.uid()
      and email_confirmed_at is not null
      and pg_catalog.lower(email) in (
        'levikeus44@gmail.com',
        'levi.keus@icloud.com'
      )
  );
$$;

revoke all on function public.is_ventex_admin() from public, anon;
grant execute on function public.is_ventex_admin() to authenticated;

alter table public.products
  add column if not exists delivery_description text not null default '',
  add column if not exists external_url text,
  add column if not exists paddle_price_id text;

create unique index if not exists products_paddle_price_id_key
  on public.products (paddle_price_id)
  where paddle_price_id is not null;

alter table public.products enable row level security;

drop policy if exists "VENTEX admins manage products" on public.products;
create policy "VENTEX admins manage products"
  on public.products
  for all
  to authenticated
  using (public.is_ventex_admin())
  with check (public.is_ventex_admin());

grant select, insert, update, delete on public.products to authenticated;

create or replace function public.sync_ventex_product_category_name()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.name is distinct from old.name then
    update public.products
    set category = new.name
    where category = old.name;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_ventex_product_category_name() from public, anon, authenticated;

create table if not exists public.store_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.store_categories enable row level security;
revoke all on table public.store_categories from public, anon, authenticated;
grant select on table public.store_categories to anon, authenticated;
grant insert, update, delete on table public.store_categories to authenticated;

drop trigger if exists sync_ventex_product_category_name on public.store_categories;
create trigger sync_ventex_product_category_name
  after update of name on public.store_categories
  for each row
  execute function public.sync_ventex_product_category_name();

drop policy if exists "Public can view active store categories" on public.store_categories;
create policy "Public can view active store categories"
  on public.store_categories
  for select
  to anon, authenticated
  using (is_active);

drop policy if exists "VENTEX admins manage store categories" on public.store_categories;
create policy "VENTEX admins manage store categories"
  on public.store_categories
  for all
  to authenticated
  using (public.is_ventex_admin())
  with check (public.is_ventex_admin());

create table if not exists public.product_keys (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  key_value text not null,
  created_at timestamptz not null default now(),
  constraint product_keys_product_id_key_value_key unique (product_id, key_value)
);

alter table public.product_keys enable row level security;
revoke all on table public.product_keys from public, anon, authenticated;
grant select, insert, update, delete on table public.product_keys to authenticated;

drop policy if exists "VENTEX admins manage product keys" on public.product_keys;
create policy "VENTEX admins manage product keys"
  on public.product_keys
  for all
  to authenticated
  using (public.is_ventex_admin())
  with check (public.is_ventex_admin());

create table if not exists public.store_settings (
  id text primary key default 'default' check (id = 'default'),
  maintenance_mode boolean not null default false,
  maintenance_message text not null default 'We will be back shortly.',
  discord_server_url text not null default '',
  discord_support_url text not null default '',
  support_email text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.store_settings enable row level security;
revoke all on table public.store_settings from public, anon, authenticated;
grant select on table public.store_settings to anon, authenticated;
grant insert, update, delete on table public.store_settings to authenticated;

drop policy if exists "Public can read store settings" on public.store_settings;
create policy "Public can read store settings"
  on public.store_settings
  for select
  to anon, authenticated
  using (true);

drop policy if exists "VENTEX admins manage store settings" on public.store_settings;
create policy "VENTEX admins manage store settings"
  on public.store_settings
  for all
  to authenticated
  using (public.is_ventex_admin())
  with check (public.is_ventex_admin());

create table if not exists public.discord_webhook_settings (
  id text primary key default 'default' check (id = 'default'),
  webhook_url text not null,
  updated_at timestamptz not null default now()
);

alter table public.discord_webhook_settings enable row level security;
revoke all on table public.discord_webhook_settings from public, anon, authenticated;
grant select, insert, update, delete on table public.discord_webhook_settings to authenticated;

drop policy if exists "VENTEX admins manage Discord webhook settings" on public.discord_webhook_settings;
create policy "VENTEX admins manage Discord webhook settings"
  on public.discord_webhook_settings
  for all
  to authenticated
  using (public.is_ventex_admin())
  with check (public.is_ventex_admin());

create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  customer_email text not null,
  payment_provider text not null default 'paddle',
  provider_transaction_id text not null unique,
  status text not null check (
    status in ('pending', 'paid', 'fulfilled', 'canceled', 'refunded', 'disputed')
  ),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  total_amount_minor bigint not null check (total_amount_minor >= 0),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_orders
  add column if not exists discord_notified_at timestamptz;

create index if not exists store_orders_user_created_at_idx
  on public.store_orders (user_id, created_at desc);

alter table public.store_orders enable row level security;
revoke all on table public.store_orders from public, anon, authenticated;
grant select on table public.store_orders to authenticated;
grant all on table public.store_orders to service_role;

drop policy if exists "Customers and admins can view store orders" on public.store_orders;
create policy "Customers and admins can view store orders"
  on public.store_orders
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_ventex_admin());

alter table public.product_keys
  add column if not exists assigned_order_id uuid
    references public.store_orders(id) on delete restrict,
  add column if not exists assigned_at timestamptz;

create index if not exists product_keys_available_by_product_idx
  on public.product_keys (product_id, created_at)
  where assigned_order_id is null;

drop policy if exists "Customers can view keys assigned to their orders" on public.product_keys;
create policy "Customers can view keys assigned to their orders"
  on public.product_keys
  for select
  to authenticated
  using (
    assigned_order_id is not null
    and exists (
      select 1
      from public.store_orders
      where store_orders.id = product_keys.assigned_order_id
        and (
          store_orders.user_id = auth.uid()
          or public.is_ventex_admin()
        )
    )
  );

create or replace function public.fulfill_store_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  target_order public.store_orders%rowtype;
  order_item jsonb;
  requested_quantity integer;
  selected_key_ids uuid[];
  all_key_ids uuid[] := '{}'::uuid[];
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and not public.is_ventex_admin() then
    raise exception 'Only verified administrators or trusted payment processing can fulfill orders'
      using errcode = '42501';
  end if;

  select *
  into target_order
  from public.store_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if target_order.status = 'fulfilled' then
    return true;
  end if;

  if target_order.status <> 'paid' then
    return false;
  end if;

  for order_item in
    select value
    from jsonb_array_elements(target_order.items)
  loop
    if order_item->>'product_id' is null
      or coalesce(order_item->>'quantity', '') !~ '^[1-9][0-9]{0,2}$' then
      return false;
    end if;

    requested_quantity := (order_item->>'quantity')::integer;

    select coalesce(array_agg(available.id), '{}'::uuid[])
    into selected_key_ids
    from (
      select id
      from public.product_keys
      where product_id = order_item->>'product_id'
        and assigned_order_id is null
      order by created_at, id
      limit requested_quantity
      for update skip locked
    ) as available;

    if cardinality(selected_key_ids) < requested_quantity then
      return false;
    end if;

    all_key_ids := all_key_ids || selected_key_ids;
  end loop;

  if cardinality(all_key_ids) = 0 then
    return false;
  end if;

  update public.product_keys
  set assigned_order_id = p_order_id,
      assigned_at = now()
  where id = any(all_key_ids);

  for order_item in
    select value
    from jsonb_array_elements(target_order.items)
  loop
    update public.products
    set stock = greatest(stock - (order_item->>'quantity')::integer, 0)
    where id::text = order_item->>'product_id'
      and stock is not null;
  end loop;

  update public.store_orders
  set status = 'fulfilled',
      updated_at = now()
  where id = p_order_id;

  return true;
end;
$$;

revoke all on function public.fulfill_store_order(uuid) from public, anon, authenticated;
grant execute on function public.fulfill_store_order(uuid) to authenticated, service_role;
