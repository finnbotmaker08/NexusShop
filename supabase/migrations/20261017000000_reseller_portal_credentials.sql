-- Add a reseller-only password and server-managed portal sessions.
-- Existing Supabase users, shop logins, products, orders, and reseller data remain intact.
alter table public.reseller_profiles
  add column if not exists portal_password_hash text;

create table if not exists public.reseller_portal_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.reseller_profiles(user_id) on delete restrict,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists reseller_portal_sessions_user_expiry_idx
  on public.reseller_portal_sessions (user_id, expires_at desc);

alter table public.reseller_portal_sessions enable row level security;
revoke all on public.reseller_portal_sessions from public, anon, authenticated;
grant all on public.reseller_portal_sessions to service_role;

create or replace function public.create_reseller_ticket_for_user(
  p_reseller_id uuid, p_subject text, p_body text
)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare new_ticket uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Server access is required' using errcode = '42501';
  end if;
  if p_reseller_id is null or length(btrim(coalesce(p_subject, ''))) not between 3 and 160
    or length(btrim(coalesce(p_body, ''))) not between 1 and 8000 then
    raise exception 'Invalid support request' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.reseller_profiles
    where user_id = p_reseller_id and account_status = 'active'
  ) then raise exception 'Active reseller access is required' using errcode = '42501'; end if;
  insert into public.reseller_tickets (reseller_id, subject)
    values (p_reseller_id, btrim(p_subject)) returning id into new_ticket;
  insert into public.reseller_ticket_messages (ticket_id, author_id, body)
    values (new_ticket, p_reseller_id, btrim(p_body));
  return new_ticket;
end;
$$;
revoke all on function public.create_reseller_ticket_for_user(uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_reseller_ticket_for_user(uuid, text, text) to service_role;

create or replace function public.reply_reseller_ticket_for_user(
  p_reseller_id uuid, p_ticket_id uuid, p_body text
)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare target public.reseller_tickets%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Server access is required' using errcode = '42501';
  end if;
  if p_reseller_id is null or length(btrim(coalesce(p_body, ''))) not between 1 and 8000 then
    raise exception 'Invalid support reply' using errcode = '22023';
  end if;
  select * into target from public.reseller_tickets
    where id = p_ticket_id and reseller_id = p_reseller_id for update;
  if not found or not exists (
    select 1 from public.reseller_profiles
    where user_id = p_reseller_id and account_status = 'active'
  ) then raise exception 'Ticket not found' using errcode = '42501'; end if;
  if target.status = 'closed' then raise exception 'Ticket is closed' using errcode = '22023'; end if;
  insert into public.reseller_ticket_messages (ticket_id, author_id, body)
    values (p_ticket_id, p_reseller_id, btrim(p_body));
  update public.reseller_tickets set status = 'open', updated_at = now() where id = p_ticket_id;
  return true;
end;
$$;
revoke all on function public.reply_reseller_ticket_for_user(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reply_reseller_ticket_for_user(uuid, uuid, text) to service_role;

create or replace function public.enter_reseller_giveaway_for_user(
  p_reseller_id uuid, p_giveaway_id uuid
)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare target public.reseller_giveaways%rowtype; target_membership text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Server access is required' using errcode = '42501';
  end if;
  select membership into target_membership from public.reseller_profiles
    where user_id = p_reseller_id and account_status = 'active';
  if not found then raise exception 'Active reseller access is required' using errcode = '42501'; end if;
  select * into target from public.reseller_giveaways where id = p_giveaway_id for update;
  if not found or target.status <> 'active'
    or (target.starts_at is not null and target.starts_at > now())
    or (target.ends_at is not null and target.ends_at <= now())
    or not (target_membership = any(target.allowed_memberships)) then
    raise exception 'Giveaway is unavailable for this account' using errcode = '22023';
  end if;
  insert into public.reseller_giveaway_entries (giveaway_id, reseller_id)
    values (target.id, p_reseller_id) on conflict (giveaway_id, reseller_id) do nothing;
  if not found then raise exception 'Already entered' using errcode = '23505'; end if;
  return true;
end;
$$;
revoke all on function public.enter_reseller_giveaway_for_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.enter_reseller_giveaway_for_user(uuid, uuid) to service_role;

create or replace function public.claim_reseller_reward_for_user(
  p_reseller_id uuid, p_reward_id uuid, p_key_hash text
)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  target_reward public.reseller_rewards%rowtype;
  target_membership text;
  created_claim uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Server access is required' using errcode = '42501';
  end if;
  if p_reseller_id is null or p_reward_id is null or p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid claim request' using errcode = '22023';
  end if;
  select membership into target_membership from public.reseller_profiles
    where user_id = p_reseller_id and account_status = 'active';
  if not found then raise exception 'Active reseller access is required' using errcode = '42501'; end if;
  select * into target_reward from public.reseller_rewards where id = p_reward_id for update;
  if not found or not target_reward.is_active
    or (target_reward.starts_at is not null and target_reward.starts_at > now())
    or (target_reward.ends_at is not null and target_reward.ends_at <= now())
    or (target_membership = 'basic' and target_reward.membership_required = 'premium') then
    raise exception 'Reward is unavailable for this account' using errcode = '22023';
  end if;
  if target_reward.stock is not null and target_reward.stock < 1 then
    raise exception 'Reward is out of stock' using errcode = '22023';
  end if;
  insert into public.reseller_claims (reseller_id, reward_id, claim_key_hash)
    values (p_reseller_id, target_reward.id, p_key_hash) returning id into created_claim;
  if target_reward.stock is not null then
    update public.reseller_rewards set stock = stock - 1, updated_at = now()
      where id = target_reward.id;
  end if;
  return created_claim;
end;
$$;
revoke all on function public.claim_reseller_reward_for_user(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_reseller_reward_for_user(uuid, uuid, text) to service_role;
