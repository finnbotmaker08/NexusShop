create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.products
  add column if not exists short_description text not null default '',
  add column if not exists sale_price numeric(12, 2),
  add column if not exists delivery_type text not null default 'stock',
  add column if not exists updated_at timestamptz not null default now();

alter table public.products
  drop constraint if exists products_delivery_type_check,
  add constraint products_delivery_type_check
    check (delivery_type in ('stock', 'manual', 'link')),
  drop constraint if exists products_sale_price_check,
  add constraint products_sale_price_check
    check (sale_price is null or sale_price >= 0);

drop trigger if exists touch_ventex_products_updated_at on public.products;
create trigger touch_ventex_products_updated_at
  before update on public.products
  for each row
  execute function public.touch_updated_at();

alter table public.store_orders
  alter column provider_transaction_id drop not null,
  add column if not exists order_number text,
  add column if not exists payment_method text not null default 'paddle',
  add column if not exists manual_delivery text,
  add column if not exists expires_at timestamptz,
  add column if not exists payment_detected_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists delivered_at timestamptz;

update public.store_orders
set order_number = 'VX-' || upper(substr(replace(id::text, '-', ''), 1, 12))
where order_number is null;

alter table public.store_orders
  alter column order_number set not null;

create unique index if not exists store_orders_order_number_key
  on public.store_orders (order_number);

alter table public.store_orders
  drop constraint if exists store_orders_status_check,
  add constraint store_orders_status_check
    check (
      status in (
        'pending',
        'awaiting_payment',
        'payment_detected',
        'awaiting_approval',
        'paid',
        'processing',
        'fulfilled',
        'canceled',
        'expired',
        'rejected',
        'refunded',
        'disputed'
      )
    );

do $$
declare
  product_id_type text;
begin
  select pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
  into product_id_type
  from pg_catalog.pg_attribute as attribute
  where attribute.attrelid = 'public.products'::regclass
    and attribute.attname = 'id'
    and not attribute.attisdropped;

  if product_id_type is null then
    raise exception 'VENTEX migration requires public.products.id';
  end if;

  execute format(
    'create table if not exists public.store_order_items (
      id uuid primary key default gen_random_uuid(),
      order_id uuid not null references public.store_orders(id) on delete restrict,
      product_id %s not null references public.products(id) on delete restrict,
      product_name text not null,
      product_slug text,
      quantity integer not null check (quantity between 1 and 99),
      unit_amount_minor bigint not null check (unit_amount_minor >= 0),
      created_at timestamptz not null default now(),
      constraint store_order_items_order_product_key unique (order_id, product_id)
    )',
    product_id_type
  );
end;
$$;

create index if not exists store_order_items_product_id_idx
  on public.store_order_items (product_id);

alter table public.store_order_items enable row level security;
revoke all on table public.store_order_items from public, anon, authenticated;
grant select on table public.store_order_items to authenticated;
grant all on table public.store_order_items to service_role;

drop policy if exists "Customers and admins can view order items"
  on public.store_order_items;
create policy "Customers and admins can view order items"
  on public.store_order_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.store_orders
      where store_orders.id = store_order_items.order_id
        and (
          store_orders.user_id = auth.uid()
          or public.is_ventex_admin()
        )
    )
  );

create table if not exists public.store_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete restrict,
  provider text not null check (
    provider in ('paddle', 'bitcoin', 'litecoin', 'tikkie')
  ),
  status text not null default 'awaiting_payment' check (
    status in ('awaiting_payment', 'submitted', 'payment_detected', 'approved', 'rejected', 'expired')
  ),
  transaction_id text,
  expected_amount numeric(30, 12) not null check (expected_amount >= 0),
  received_amount numeric(30, 12),
  required_confirmations integer not null default 0
    check (required_confirmations between 0 and 100),
  payment_destination text not null default '',
  payment_instructions text not null default '',
  exchange_rate numeric(30, 12),
  quote_expires_at timestamptz,
  confirmations integer not null default 0 check (confirmations >= 0),
  detected_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  rejection_reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists store_payments_provider_transaction_key
  on public.store_payments (provider, transaction_id)
  where transaction_id is not null;
create unique index if not exists store_payments_one_active_payment_per_order
  on public.store_payments (order_id)
  where status in ('awaiting_payment', 'payment_detected');
create index if not exists store_payments_status_created_at_idx
  on public.store_payments (status, created_at desc);

drop trigger if exists touch_store_payments_updated_at on public.store_payments;
create trigger touch_store_payments_updated_at
  before update on public.store_payments
  for each row
  execute function public.touch_updated_at();

alter table public.store_payments enable row level security;
revoke all on table public.store_payments from public, anon, authenticated;
grant select on table public.store_payments to authenticated;
grant all on table public.store_payments to service_role;

drop policy if exists "Customers and admins can view order payments"
  on public.store_payments;
create policy "Customers and admins can view order payments"
  on public.store_payments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.store_orders
      where store_orders.id = store_payments.order_id
        and (
          store_orders.user_id = auth.uid()
          or public.is_ventex_admin()
        )
    )
  );

create table if not exists public.store_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  amount numeric(12, 2) not null check (amount > 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  minimum_order_minor bigint not null default 0 check (minimum_order_minor >= 0),
  expires_at timestamptz,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_coupons_percentage_amount_check
    check (discount_type <> 'percentage' or amount <= 100)
);

create table if not exists public.store_coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.store_coupons(id) on delete restrict,
  order_id uuid not null unique references public.store_orders(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  discount_amount_minor bigint not null check (discount_amount_minor >= 0),
  redeemed_at timestamptz not null default now()
);

create index if not exists store_coupon_redemptions_coupon_idx
  on public.store_coupon_redemptions (coupon_id, redeemed_at desc);

drop trigger if exists touch_store_coupons_updated_at on public.store_coupons;
create trigger touch_store_coupons_updated_at
  before update on public.store_coupons
  for each row
  execute function public.touch_updated_at();

alter table public.store_coupons enable row level security;
alter table public.store_coupon_redemptions enable row level security;
revoke all on table public.store_coupons from public, anon, authenticated;
revoke all on table public.store_coupon_redemptions from public, anon, authenticated;
grant all on table public.store_coupons to service_role;
grant all on table public.store_coupon_redemptions to service_role;

drop policy if exists "VENTEX admins manage coupons" on public.store_coupons;
create policy "VENTEX admins manage coupons"
  on public.store_coupons
  for all
  to authenticated
  using (public.is_ventex_admin())
  with check (public.is_ventex_admin());
grant select, insert, update, delete on table public.store_coupons to authenticated;

drop policy if exists "VENTEX admins view coupon redemptions"
  on public.store_coupon_redemptions;
create policy "VENTEX admins view coupon redemptions"
  on public.store_coupon_redemptions
  for select
  to authenticated
  using (public.is_ventex_admin());
grant select on table public.store_coupon_redemptions to authenticated;

create table if not exists public.store_payment_settings (
  id text primary key default 'default' check (id = 'default'),
  bitcoin_enabled boolean not null default false,
  bitcoin_address text not null default '',
  bitcoin_confirmations integer not null default 2 check (bitcoin_confirmations between 1 and 100),
  litecoin_enabled boolean not null default false,
  litecoin_address text not null default '',
  litecoin_confirmations integer not null default 6 check (litecoin_confirmations between 1 and 100),
  blockchain_provider text not null default 'blockcypher'
    check (blockchain_provider in ('blockcypher')),
  tikkie_enabled boolean not null default false,
  tikkie_url text not null default '',
  tikkie_instructions text not null default '',
  payment_timeout_minutes integer not null default 60
    check (payment_timeout_minutes between 5 and 10080),
  tikkie_reset_date date,
  tikkie_reminder_date date,
  tikkie_reminder_email text not null default '',
  tikkie_reminder_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.store_payment_settings enable row level security;
revoke all on table public.store_payment_settings from public, anon, authenticated;
grant select, insert, update, delete on table public.store_payment_settings to authenticated;
grant all on table public.store_payment_settings to service_role;

drop policy if exists "VENTEX admins manage payment settings"
  on public.store_payment_settings;
create policy "VENTEX admins manage payment settings"
  on public.store_payment_settings
  for all
  to authenticated
  using (public.is_ventex_admin())
  with check (public.is_ventex_admin());

insert into public.store_payment_settings (id)
values ('default')
on conflict (id) do nothing;

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
  delivery_kind text;
  delivery_url text;
  manual_delivery_needed boolean := false;
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

    select product.delivery_type, product.external_url
    into delivery_kind, delivery_url
    from public.products as product
    where product.id::text = order_item->>'product_id';

    if not found then
      return false;
    end if;

    if delivery_kind = 'manual' then
      manual_delivery_needed := true;
      continue;
    elsif delivery_kind = 'link' then
      if coalesce(order_item->>'external_url', delivery_url, '') = '' then
        return false;
      end if;
      continue;
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

  if manual_delivery_needed then
    update public.store_orders
    set status = 'processing',
        updated_at = now()
    where id = p_order_id;
    return false;
  end if;

  if cardinality(all_key_ids) > 0 then
    update public.product_keys
    set assigned_order_id = p_order_id,
        assigned_at = now()
    where id = any(all_key_ids);
  end if;

  for order_item in
    select value
    from jsonb_array_elements(target_order.items)
  loop
    update public.products
    set stock = greatest(stock - (order_item->>'quantity')::integer, 0)
    where id::text = order_item->>'product_id'
      and stock is not null
      and delivery_type = 'stock';
  end loop;

  update public.store_orders
  set status = 'fulfilled',
      delivered_at = now(),
      updated_at = now()
  where id = p_order_id;

  return true;
end;
$$;

revoke all on function public.fulfill_store_order(uuid) from public, anon, authenticated;
grant execute on function public.fulfill_store_order(uuid) to authenticated, service_role;

create or replace function public.complete_manual_store_order(
  p_order_id uuid,
  p_delivery_content text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not public.is_ventex_admin() then
    raise exception 'Only verified administrators can complete manual deliveries'
      using errcode = '42501';
  end if;
  if p_delivery_content is null
    or length(pg_catalog.btrim(p_delivery_content)) = 0
    or length(p_delivery_content) > 4000 then
    raise exception 'Delivery details must contain 1 to 4000 characters'
      using errcode = '22023';
  end if;

  update public.store_orders
  set manual_delivery = pg_catalog.btrim(p_delivery_content),
      status = 'fulfilled',
      delivered_at = now(),
      updated_at = now()
  where id = p_order_id
    and status = 'processing';

  return found;
end;
$$;

revoke all on function public.complete_manual_store_order(uuid, text)
  from public, anon, authenticated;
grant execute on function public.complete_manual_store_order(uuid, text)
  to authenticated;

create or replace function public.approve_store_payment(p_payment_id uuid)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  target_payment public.store_payments%rowtype;
  target_order public.store_orders%rowtype;
  required_confirmations integer;
begin
  if not public.is_ventex_admin() then
    raise exception 'Only verified administrators can approve payments'
      using errcode = '42501';
  end if;

  select *
  into target_payment
  from public.store_payments
  where id = p_payment_id
  for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;

  select *
  into target_order
  from public.store_orders
  where id = target_payment.order_id
  for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if target_payment.status = 'approved' then
    return target_order.status;
  end if;

  if target_payment.provider in ('bitcoin', 'litecoin') then
    select case target_payment.provider
      when 'bitcoin' then bitcoin_confirmations
      else litecoin_confirmations
    end
    into required_confirmations
    from public.store_payment_settings
    where id = 'default';

    if target_payment.status <> 'payment_detected'
      or target_payment.confirmations < coalesce(required_confirmations, 1) then
      raise exception 'The required blockchain confirmations have not been reached'
        using errcode = '22023';
    end if;
  elsif target_payment.provider = 'tikkie' then
    if target_payment.status <> 'submitted'
      or target_order.status <> 'awaiting_approval' then
      raise exception 'This Tikkie payment is not awaiting manual approval'
        using errcode = '22023';
    end if;
  else
    raise exception 'This payment method cannot be approved manually'
      using errcode = '22023';
  end if;

  update public.store_payments
  set status = 'approved',
      approved_at = now(),
      approved_by = auth.uid(),
      updated_at = now()
  where id = target_payment.id;

  update public.store_orders
  set status = 'paid',
      approved_at = now(),
      updated_at = now()
  where id = target_order.id;

  perform public.fulfill_store_order(target_order.id);

  select status
  into target_order.status
  from public.store_orders
  where id = target_order.id;

  return target_order.status;
end;
$$;

revoke all on function public.approve_store_payment(uuid)
  from public, anon, authenticated;
grant execute on function public.approve_store_payment(uuid) to authenticated;

create or replace function public.reject_store_payment(
  p_payment_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  target_payment public.store_payments%rowtype;
  target_order public.store_orders%rowtype;
begin
  if not public.is_ventex_admin() then
    raise exception 'Only verified administrators can reject payments'
      using errcode = '42501';
  end if;
  if p_reason is null or length(pg_catalog.btrim(p_reason)) not between 3 and 500 then
    raise exception 'A rejection reason between 3 and 500 characters is required'
      using errcode = '22023';
  end if;

  select *
  into target_payment
  from public.store_payments
  where id = p_payment_id
  for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  if target_payment.status not in ('awaiting_payment', 'submitted', 'payment_detected') then
    raise exception 'This payment is no longer awaiting a decision'
      using errcode = '22023';
  end if;
  select *
  into target_order
  from public.store_orders
  where id = target_payment.order_id
  for update;
  if not found
    or target_order.status not in ('awaiting_payment', 'payment_detected', 'awaiting_approval') then
    raise exception 'This order is no longer awaiting payment review'
      using errcode = '22023';
  end if;

  update public.store_payments
  set status = 'rejected',
      rejection_reason = pg_catalog.btrim(p_reason),
      updated_at = now()
  where id = target_payment.id;

  update public.store_orders
  set status = 'rejected',
      updated_at = now()
  where id = target_payment.order_id
    and status in ('awaiting_payment', 'payment_detected', 'awaiting_approval');

  if not found then
    raise exception 'Order status changed during payment rejection'
      using errcode = '40001';
  end if;

  return found;
end;
$$;

revoke all on function public.reject_store_payment(uuid, text)
  from public, anon, authenticated;
grant execute on function public.reject_store_payment(uuid, text)
  to authenticated;

create or replace function public.record_store_payment_detection(
  p_payment_id uuid,
  p_transaction_id text,
  p_received_amount numeric,
  p_confirmations integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  target_payment public.store_payments%rowtype;
  target_order public.store_orders%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only trusted blockchain verification can record a payment'
      using errcode = '42501';
  end if;
  if p_transaction_id is null
    or length(p_transaction_id) > 128
    or p_received_amount is null
    or p_received_amount <= 0
    or p_confirmations is null
    or p_confirmations < 0 then
    raise exception 'Invalid blockchain payment details'
      using errcode = '22023';
  end if;

  select *
  into target_payment
  from public.store_payments
  where id = p_payment_id
  for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  if target_payment.provider not in ('bitcoin', 'litecoin')
    or target_payment.status not in ('awaiting_payment', 'payment_detected')
    or (
      target_payment.transaction_id is not null
      and target_payment.transaction_id <> p_transaction_id
    ) then
    raise exception 'Payment is not eligible for this blockchain update'
      using errcode = '22023';
  end if;
  select *
  into target_order
  from public.store_orders
  where id = target_payment.order_id
  for update;
  if not found or target_order.status not in ('awaiting_payment', 'payment_detected') then
    raise exception 'Order is not awaiting blockchain payment'
      using errcode = '22023';
  end if;

  update public.store_payments
  set transaction_id = p_transaction_id,
      status = 'payment_detected',
      received_amount = p_received_amount,
      confirmations = p_confirmations,
      detected_at = coalesce(detected_at, now()),
      updated_at = now()
  where id = target_payment.id;

  update public.store_orders
  set status = 'payment_detected',
      payment_detected_at = coalesce(payment_detected_at, now()),
      updated_at = now()
  where id = target_payment.order_id
    and status in ('awaiting_payment', 'payment_detected');

  if not found then
    raise exception 'Order status changed during blockchain verification'
      using errcode = '40001';
  end if;

  return found;
end;
$$;

revoke all on function public.record_store_payment_detection(uuid, text, numeric, integer)
  from public, anon, authenticated;
grant execute on function public.record_store_payment_detection(uuid, text, numeric, integer)
  to service_role;

create or replace function public.submit_tikkie_payment(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  target_payment public.store_payments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in before submitting Tikkie payment'
      using errcode = '42501';
  end if;

  select payment.*
  into target_payment
  from public.store_payments as payment
  join public.store_orders as order_row on order_row.id = payment.order_id
  where payment.order_id = p_order_id
    and order_row.user_id = auth.uid()
    and payment.provider = 'tikkie'
    and payment.status = 'awaiting_payment'
    and order_row.status = 'awaiting_payment'
  for update of payment, order_row;
  if not found then
    raise exception 'Tikkie payment is not awaiting customer submission'
      using errcode = '22023';
  end if;

  update public.store_payments
  set status = 'submitted',
      updated_at = now()
  where id = target_payment.id;

  update public.store_orders
  set status = 'awaiting_approval',
      updated_at = now()
  where id = p_order_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Tikkie order status changed during submission'
      using errcode = '40001';
  end if;

  return found;
end;
$$;

revoke all on function public.submit_tikkie_payment(uuid)
  from public, anon;
grant execute on function public.submit_tikkie_payment(uuid)
  to authenticated;

create table if not exists public.store_email_outbox (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  recipient text not null,
  template text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed')),
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.store_email_outbox enable row level security;
revoke all on table public.store_email_outbox from public, anon, authenticated;
grant all on table public.store_email_outbox to service_role;
