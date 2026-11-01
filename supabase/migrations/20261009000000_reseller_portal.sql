-- Additive reseller foundation. Existing shop tables and payment flows remain untouched.
create table if not exists public.reseller_profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  email text not null,
  discord_id text not null,
  membership text not null check (membership in ('basic', 'premium')),
  account_status text not null default 'invited'
    check (account_status in ('invited', 'active', 'blocked', 'revoked')),
  internal_notes text not null default '',
  invited_at timestamptz not null default now(),
  invitation_expires_at timestamptz not null default (now() + interval '7 days'),
  activated_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint reseller_profiles_email_key unique (email)
);

create index if not exists reseller_profiles_status_membership_idx
  on public.reseller_profiles (account_status, membership);

alter table public.reseller_profiles enable row level security;
revoke all on public.reseller_profiles from public, anon, authenticated;
grant select (user_id, email, discord_id, membership, account_status, invited_at, activated_at, updated_at)
  on public.reseller_profiles to authenticated;
grant all on public.reseller_profiles to service_role;

drop policy if exists "Resellers can read their own profile" on public.reseller_profiles;
create policy "Resellers can read their own profile"
  on public.reseller_profiles for select to authenticated
  using (user_id = auth.uid() and account_status = 'active');

create table if not exists public.reseller_rewards (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 2 and 120),
  description text not null default '',
  image_url text,
  reward_type text not null default 'manual'
    check (reward_type in ('manual', 'digital', 'product_key')),
  membership_required text not null default 'basic'
    check (membership_required in ('basic', 'premium')),
  claim_limit integer not null default 1 check (claim_limit between 1 and 1000),
  stock integer check (stock is null or stock >= 0),
  instructions text not null default '',
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reseller_claims (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.reseller_profiles(user_id) on delete restrict,
  reward_id uuid not null references public.reseller_rewards(id) on delete restrict,
  claim_key_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'delivered', 'revoked')),
  rejection_reason text,
  ticket_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz,
  constraint reseller_claims_reseller_reward_key unique (reseller_id, reward_id)
);
create index if not exists reseller_claims_status_created_idx
  on public.reseller_claims (status, created_at desc);
alter table public.reseller_rewards enable row level security;
alter table public.reseller_claims enable row level security;
revoke all on public.reseller_rewards, public.reseller_claims from public, anon, authenticated;
grant select on public.reseller_rewards to authenticated;
grant select (id, reseller_id, reward_id, status, rejection_reason, ticket_id, created_at, updated_at, delivered_at)
  on public.reseller_claims to authenticated;
grant all on public.reseller_rewards, public.reseller_claims to service_role;
drop policy if exists "Active resellers can view active rewards" on public.reseller_rewards;
create policy "Active resellers can view active rewards"
  on public.reseller_rewards for select to authenticated
  using (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()) and exists (
    select 1 from public.reseller_profiles p
    where p.user_id = auth.uid() and p.account_status = 'active'
      and (p.membership = 'premium' or reseller_rewards.membership_required = 'basic')
  ));
drop policy if exists "Resellers can view their claims" on public.reseller_claims;
create policy "Resellers can view their claims"
  on public.reseller_claims for select to authenticated
  using (reseller_id = auth.uid() and exists (
    select 1 from public.reseller_profiles p
    where p.user_id = auth.uid() and p.account_status = 'active'
  ));

create table if not exists public.reseller_tickets (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.reseller_profiles(user_id) on delete restrict,
  subject text not null check (length(btrim(subject)) between 3 and 160),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_admin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.reseller_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.reseller_tickets(id) on delete restrict,
  author_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (length(btrim(body)) between 1 and 8000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create or replace function public.bump_reseller_ticket_updated_at()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  update public.reseller_tickets set updated_at = now() where id = new.ticket_id;
  return new;
end;
$$;
revoke all on function public.bump_reseller_ticket_updated_at() from public, anon, authenticated;
drop trigger if exists reseller_ticket_message_bump on public.reseller_ticket_messages;
create trigger reseller_ticket_message_bump after insert on public.reseller_ticket_messages
  for each row execute function public.bump_reseller_ticket_updated_at();
create index if not exists reseller_tickets_owner_updated_idx
  on public.reseller_tickets (reseller_id, updated_at desc);
create index if not exists reseller_ticket_messages_ticket_created_idx
  on public.reseller_ticket_messages (ticket_id, created_at);
alter table public.reseller_tickets enable row level security;
alter table public.reseller_ticket_messages enable row level security;
revoke all on public.reseller_tickets, public.reseller_ticket_messages from public, anon, authenticated;
grant select on public.reseller_tickets, public.reseller_ticket_messages to authenticated;
grant all on public.reseller_tickets, public.reseller_ticket_messages to service_role;
drop policy if exists "Resellers can read their tickets" on public.reseller_tickets;
create policy "Resellers can read their tickets"
  on public.reseller_tickets for select to authenticated
  using (reseller_id = auth.uid() and exists (
    select 1 from public.reseller_profiles p where p.user_id = auth.uid() and p.account_status = 'active'
  ));
drop policy if exists "Active resellers can open tickets" on public.reseller_tickets;
create policy "Active resellers can open tickets"
  on public.reseller_tickets for insert to authenticated
  with check (reseller_id = auth.uid() and exists (
    select 1 from public.reseller_profiles p where p.user_id = auth.uid() and p.account_status = 'active'
  ));
drop policy if exists "Resellers can read public ticket messages" on public.reseller_ticket_messages;
create policy "Resellers can read public ticket messages"
  on public.reseller_ticket_messages for select to authenticated
  using (not is_internal and exists (
    select 1 from public.reseller_tickets t
    join public.reseller_profiles p on p.user_id = t.reseller_id
    where t.id = ticket_id and t.reseller_id = auth.uid() and p.account_status = 'active'
  ));
drop policy if exists "Resellers can reply to their tickets" on public.reseller_ticket_messages;
create policy "Resellers can reply to their tickets"
  on public.reseller_ticket_messages for insert to authenticated
  with check (author_id = auth.uid() and not is_internal and exists (
    select 1 from public.reseller_tickets t
    join public.reseller_profiles p on p.user_id = t.reseller_id
    where t.id = ticket_id and t.reseller_id = auth.uid() and p.account_status = 'active'
  ));

create table if not exists public.reseller_giveaways (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 2 and 120),
  description text not null default '',
  image_url text,
  reward text not null,
  winner_count integer not null default 1 check (winner_count between 1 and 100),
  allowed_memberships text[] not null default array['basic','premium']::text[],
  entry_conditions text not null default '',
  selection_method text not null default 'manual' check (selection_method in ('manual', 'random')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'closed', 'completed')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.reseller_giveaway_entries (
  id uuid primary key default gen_random_uuid(),
  giveaway_id uuid not null references public.reseller_giveaways(id) on delete restrict,
  reseller_id uuid not null references public.reseller_profiles(user_id) on delete restrict,
  entered_at timestamptz not null default now(),
  selected_winner boolean not null default false,
  constraint reseller_giveaway_entries_once unique (giveaway_id, reseller_id)
);
alter table public.reseller_giveaways enable row level security;
alter table public.reseller_giveaway_entries enable row level security;
revoke all on public.reseller_giveaways, public.reseller_giveaway_entries from public, anon, authenticated;
grant select on public.reseller_giveaways, public.reseller_giveaway_entries to authenticated;
grant all on public.reseller_giveaways, public.reseller_giveaway_entries to service_role;
drop policy if exists "Resellers can view active giveaways" on public.reseller_giveaways;
create policy "Resellers can view active giveaways"
  on public.reseller_giveaways for select to authenticated using (status = 'active'
    and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()) and exists (
    select 1 from public.reseller_profiles p where p.user_id = auth.uid()
      and p.account_status = 'active' and p.membership = any (reseller_giveaways.allowed_memberships)
  ));
drop policy if exists "Resellers can view own giveaway entries" on public.reseller_giveaway_entries;
create policy "Resellers can view own giveaway entries"
  on public.reseller_giveaway_entries for select to authenticated using (reseller_id = auth.uid() and exists (
    select 1 from public.reseller_profiles p where p.user_id = auth.uid() and p.account_status = 'active'
  ));

create table if not exists public.reseller_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  reseller_id uuid references public.reseller_profiles(user_id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.reseller_audit_log enable row level security;
revoke all on public.reseller_audit_log from public, anon, authenticated;
grant all on public.reseller_audit_log to service_role;

insert into public.reseller_rewards (title, description, reward_type, membership_required, claim_limit, instructions)
select seed.title, seed.description, 'manual', 'premium', 1, seed.instructions
from (values
  ('Custom Discord Server', 'A custom Discord server set up for your reseller brand.', 'Open a support ticket and include your claim key and preferred server name.'),
  ('Website Domain', 'A domain reward arranged by the VENTEX team.', 'Open a support ticket and include your claim key and preferred domain.'),
  ('14 Discord Server Boosts', 'Fourteen server boosts for an eligible Discord server.', 'Open a support ticket and include your claim key and server invite.')
) as seed(title, description, instructions)
where not exists (select 1 from public.reseller_rewards reward where reward.title = seed.title);

create or replace function public.create_reseller_ticket(p_subject text, p_body text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare new_ticket uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.reseller_profiles where user_id = auth.uid() and account_status = 'active'
  ) then raise exception 'Active reseller access is required' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_subject, ''))) not between 3 and 160
    or length(btrim(coalesce(p_body, ''))) not between 1 and 8000 then
    raise exception 'Invalid support request' using errcode = '22023';
  end if;
  insert into public.reseller_tickets (reseller_id, subject) values (auth.uid(), btrim(p_subject))
    returning id into new_ticket;
  insert into public.reseller_ticket_messages (ticket_id, author_id, body)
    values (new_ticket, auth.uid(), btrim(p_body));
  return new_ticket;
end;
$$;
revoke all on function public.create_reseller_ticket(text, text) from public, anon;
grant execute on function public.create_reseller_ticket(text, text) to authenticated;

create or replace function public.reply_reseller_ticket(p_ticket_id uuid, p_body text)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare target public.reseller_tickets%rowtype;
begin
  if auth.uid() is null or length(btrim(coalesce(p_body, ''))) not between 1 and 8000 then
    raise exception 'Invalid support reply' using errcode = '22023';
  end if;
  select * into target from public.reseller_tickets
    where id = p_ticket_id and reseller_id = auth.uid() for update;
  if not found or not exists (
    select 1 from public.reseller_profiles where user_id = auth.uid() and account_status = 'active'
  ) then raise exception 'Ticket not found' using errcode = '42501'; end if;
  if target.status = 'closed' then raise exception 'Ticket is closed' using errcode = '22023'; end if;
  insert into public.reseller_ticket_messages (ticket_id, author_id, body)
    values (p_ticket_id, auth.uid(), btrim(p_body));
  update public.reseller_tickets set status = 'open', updated_at = now() where id = p_ticket_id;
  return true;
end;
$$;
revoke all on function public.reply_reseller_ticket(uuid, text) from public, anon;
grant execute on function public.reply_reseller_ticket(uuid, text) to authenticated;

create or replace function public.enter_reseller_giveaway(p_giveaway_id uuid)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare target public.reseller_giveaways%rowtype; target_membership text;
begin
  if auth.uid() is null then raise exception 'Sign in to enter' using errcode = '42501'; end if;
  select membership into target_membership from public.reseller_profiles
    where user_id = auth.uid() and account_status = 'active';
  if not found then raise exception 'Active reseller access is required' using errcode = '42501'; end if;
  select * into target from public.reseller_giveaways where id = p_giveaway_id for update;
  if not found or target.status <> 'active'
    or (target.starts_at is not null and target.starts_at > now())
    or (target.ends_at is not null and target.ends_at <= now())
    or not (target_membership = any(target.allowed_memberships)) then
    raise exception 'Giveaway is unavailable for this account' using errcode = '22023';
  end if;
  insert into public.reseller_giveaway_entries (giveaway_id, reseller_id)
    values (target.id, auth.uid()) on conflict (giveaway_id, reseller_id) do nothing;
  if not found then raise exception 'Already entered' using errcode = '23505'; end if;
  return true;
end;
$$;
revoke all on function public.enter_reseller_giveaway(uuid) from public, anon;
grant execute on function public.enter_reseller_giveaway(uuid) to authenticated;

create or replace function public.activate_reseller_account()
returns boolean language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null
  ) then
    raise exception 'A confirmed reseller invitation is required' using errcode = '42501';
  end if;
  update public.reseller_profiles
    set account_status = 'active', activated_at = now(), updated_at = now()
    where user_id = auth.uid() and account_status = 'invited' and invitation_expires_at > now();
  if not found then
    raise exception 'Invitation is expired or already used' using errcode = '22023';
  end if;
  return true;
end;
$$;
revoke all on function public.activate_reseller_account() from public, anon;
grant execute on function public.activate_reseller_account() to authenticated;

create or replace function public.claim_reseller_reward(p_reward_id uuid, p_key_hash text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  target_reward public.reseller_rewards%rowtype;
  target_membership text;
  created_claim uuid;
begin
  if auth.uid() is null or p_reward_id is null or p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid claim request' using errcode = '22023';
  end if;
  select membership into target_membership
    from public.reseller_profiles
    where user_id = auth.uid() and account_status = 'active';
  if not found then raise exception 'Active reseller access is required' using errcode = '42501'; end if;

  select * into target_reward from public.reseller_rewards
    where id = p_reward_id for update;
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
    values (auth.uid(), target_reward.id, p_key_hash)
    returning id into created_claim;
  if target_reward.stock is not null then
    update public.reseller_rewards set stock = stock - 1, updated_at = now()
      where id = target_reward.id;
  end if;
  return created_claim;
end;
$$;
revoke all on function public.claim_reseller_reward(uuid, text) from public, anon;
grant execute on function public.claim_reseller_reward(uuid, text) to authenticated;

create or replace function public.update_reseller_claim_status(
  p_claim_id uuid, p_status text, p_reason text default null
)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  target public.reseller_claims%rowtype;
begin
  if not public.is_ventex_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;
  if p_status not in ('approved', 'rejected', 'delivered', 'revoked') then
    raise exception 'Invalid claim status' using errcode = '22023';
  end if;
  if p_status = 'rejected' and length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'A rejection reason is required' using errcode = '22023';
  end if;
  select * into target from public.reseller_claims where id = p_claim_id for update;
  if not found then raise exception 'Claim not found' using errcode = 'P0002'; end if;
  if not (
    (target.status = 'pending' and p_status in ('approved', 'rejected', 'revoked')) or
    (target.status = 'approved' and p_status in ('delivered', 'revoked')) or
    (target.status = 'rejected' and p_status = 'revoked') or
    (target.status = 'delivered' and p_status = 'revoked')
  ) then raise exception 'Claim status cannot be changed this way' using errcode = '22023'; end if;
  update public.reseller_claims set status = p_status,
    rejection_reason = case when p_status = 'rejected' then btrim(p_reason) else rejection_reason end,
    delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
    updated_at = now() where id = p_claim_id;
  insert into public.reseller_audit_log (actor_id, reseller_id, action, details)
    values (auth.uid(), target.reseller_id, 'claim_' || p_status,
      jsonb_build_object('claim_id', p_claim_id, 'from', target.status, 'to', p_status, 'reason', case when p_status = 'rejected' then p_reason else null end));
  return true;
end;
$$;
revoke all on function public.update_reseller_claim_status(uuid, text, text) from public, anon;
grant execute on function public.update_reseller_claim_status(uuid, text, text) to authenticated;

