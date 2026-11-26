-- Saarthi 0003: safety (SOS, share trip), scheduled + monthly drivers, driver KYC documents,
-- promo codes, wallet and referrals. Run AFTER 0001 and 0002.
-- Supabase: SQL Editor -> New query -> paste this whole file -> Run. Safe to run twice. Removes no data.

-- ===============================================================
-- A. New columns on bookings
-- ===============================================================
alter table public.bookings
  add column if not exists share_token          uuid not null default gen_random_uuid(),
  add column if not exists scheduled_for        timestamptz,
  add column if not exists promo_code           text,
  add column if not exists discount_paise       int not null default 0 check (discount_paise >= 0),
  add column if not exists use_wallet           boolean not null default false,
  add column if not exists wallet_paise         int not null default 0 check (wallet_paise >= 0),
  add column if not exists cash_collected_paise int check (cash_collected_paise >= 0);
create unique index if not exists bookings_share_token_key on public.bookings (share_token);

-- ===============================================================
-- B. Profiles: referral code. People may edit only their name and phone.
-- ===============================================================
alter table public.profiles
  add column if not exists referral_code text unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  add column if not exists referred_by   uuid references public.profiles (id);
update public.profiles set referral_code = upper(substr(md5(id::text || clock_timestamp()::text), 1, 6)) where referral_code is null;

revoke update on public.profiles from authenticated, anon;
grant update (full_name, phone) on public.profiles to authenticated;

-- ===============================================================
-- C. Drivers: photo and verified badge, KYC documents
-- ===============================================================
alter table public.drivers
  add column if not exists photo_path text,
  add column if not exists verified   boolean not null default false;

create table if not exists public.driver_documents (
  driver_id    uuid not null references public.drivers (id),
  kind         text not null check (kind in ('licence', 'aadhaar', 'photo')),
  path         text not null,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note         text check (char_length(note) <= 200),
  uploaded_at  timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid,
  primary key (driver_id, kind)
);
alter table public.driver_documents enable row level security;
drop policy if exists "docs read" on public.driver_documents;
create policy "docs read" on public.driver_documents for select using (driver_id = auth.uid() or public.is_admin());

-- Storage: driver photos are public (customers see them); licence and Aadhaar are private.
insert into storage.buckets (id, name, public) values ('driver-photos', 'driver-photos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('driver-docs', 'driver-docs', false) on conflict (id) do nothing;

drop policy if exists "saarthi photo upload" on storage.objects;
create policy "saarthi photo upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'driver-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "saarthi doc upload" on storage.objects;
create policy "saarthi doc upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'driver-docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "saarthi doc read" on storage.objects;
create policy "saarthi doc read" on storage.objects for select to authenticated
  using (bucket_id = 'driver-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create or replace function public.driver_save_document(p_kind text, p_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.drivers where id = auth.uid()) then raise exception 'register as a driver first'; end if;
  if p_kind not in ('licence', 'aadhaar', 'photo') then raise exception 'unknown document'; end if;
  if split_part(p_path, '/', 1) <> auth.uid()::text then raise exception 'wrong file'; end if;
  insert into public.driver_documents (driver_id, kind, path) values (auth.uid(), p_kind, p_path)
  on conflict (driver_id, kind) do update set path = excluded.path, status = 'pending', note = null,
       uploaded_at = now(), reviewed_at = null, reviewed_by = null;
  if p_kind = 'photo' then update public.drivers set photo_path = p_path where id = auth.uid(); end if;
  update public.drivers set verified = false where id = auth.uid();
end $$;

create or replace function public.admin_review_document(p_driver uuid, p_kind text, p_approve boolean, p_note text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_all boolean;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  update public.driver_documents set status = case when p_approve then 'approved' else 'rejected' end,
         note = left(p_note, 200), reviewed_at = now(), reviewed_by = auth.uid()
   where driver_id = p_driver and kind = p_kind;
  if not found then raise exception 'document not uploaded'; end if;
  select count(*) = 3 into v_all from public.driver_documents where driver_id = p_driver and status = 'approved';
  update public.drivers set verified = v_all where id = p_driver;
  return v_all;
end $$;

-- ===============================================================
-- D. Safety: SOS alerts and a share-trip link
-- ===============================================================
create table if not exists public.sos_alerts (
  id          bigint generated always as identity primary key,
  booking_id  uuid not null references public.bookings (id),
  raised_by   uuid not null references public.profiles (id),
  raised_as   text not null check (raised_as in ('customer', 'driver')),
  lat         double precision,
  lng         double precision,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  note        text check (char_length(note) <= 300)
);
alter table public.sos_alerts enable row level security;
drop policy if exists "sos read" on public.sos_alerts;
create policy "sos read" on public.sos_alerts for select using (raised_by = auth.uid() or public.is_admin());

create or replace function public.raise_sos(p_booking uuid, p_lat double precision default null, p_lng double precision default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare b public.bookings; v_id bigint;
begin
  select * into b from public.bookings where id = p_booking;
  if b.id is null or auth.uid() not in (b.customer_id, coalesce(b.driver_id, '00000000-0000-0000-0000-000000000000'::uuid)) then
    raise exception 'not your trip';
  end if;
  if b.status not in ('accepted', 'started') then raise exception 'SOS works only during an active trip'; end if;
  insert into public.sos_alerts (booking_id, raised_by, raised_as, lat, lng)
  values (p_booking, auth.uid(), case when auth.uid() = b.customer_id then 'customer' else 'driver' end, p_lat, p_lng)
  returning id into v_id;
  insert into public.booking_events (booking_id, actor_id, event) values (p_booking, auth.uid(), 'sos');
  return v_id;
end $$;

create or replace function public.admin_resolve_sos(p_id bigint, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'write what was done'; end if;
  update public.sos_alerts set resolved_at = now(), resolved_by = auth.uid(), note = left(p_note, 300)
   where id = p_id and resolved_at is null;
end $$;

-- Anyone with the link can follow the trip — only while it is active, and only what family needs.
create or replace function public.get_shared_trip(p_token uuid)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select case when b.id is null then null else jsonb_build_object(
    'status', b.status, 'trip_type', b.trip_type, 'pickup_address', b.pickup_address,
    'started_at', b.started_at, 'completed_at', b.completed_at,
    'driver_name', split_part(p.full_name, ' ', 1), 'driver_verified', d.verified,
    'driver_photo', d.photo_path, 'car', c.model || ' · ' || c.reg_no,
    'lat', case when b.status in ('accepted', 'started') then st_y(d.location::geometry) end,
    'lng', case when b.status in ('accepted', 'started') then st_x(d.location::geometry) end,
    'updated_at', d.location_updated_at) end
  from public.bookings b
  join public.cars c on c.id = b.car_id
  left join public.drivers d on d.id = b.driver_id
  left join public.profiles p on p.id = b.driver_id
  where b.share_token = p_token
    and (b.status in ('requested', 'accepted', 'started') or b.completed_at > now() - interval '1 hour');
$$;

-- Customer: driver's position, plus photo and badge.
drop function if exists public.my_driver_location(uuid);
create or replace function public.my_driver_location(p_booking uuid)
returns table (lat double precision, lng double precision, updated_at timestamptz, driver_name text, phone text,
               photo_path text, verified boolean, rating numeric)
language sql stable security definer set search_path = public, extensions as $$
  select st_y(d.location::geometry), st_x(d.location::geometry), d.location_updated_at, p.full_name, p.phone,
         d.photo_path, d.verified,
         case when d.rating_count = 0 then null else round(d.rating_sum::numeric / d.rating_count, 1) end
  from public.bookings b join public.drivers d on d.id = b.driver_id join public.profiles p on p.id = d.id
  where b.id = p_booking and b.customer_id = auth.uid() and b.status in ('accepted', 'started');
$$;

-- ===============================================================
-- E. Promo codes, wallet, referrals
-- ===============================================================
create table if not exists public.promo_codes (
  code            text primary key check (code ~ '^[A-Z0-9]{3,15}$'),
  pct_off         int  not null check (pct_off between 1 and 100),
  max_off_paise   int  not null check (max_off_paise > 0),
  min_fare_paise  int  not null default 0 check (min_fare_paise >= 0),
  uses_per_user   int  not null default 1 check (uses_per_user between 1 and 100),
  valid_until     date,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
alter table public.promo_codes enable row level security;
drop policy if exists "promo admin read" on public.promo_codes;
create policy "promo admin read" on public.promo_codes for select using (public.is_admin());
insert into public.promo_codes (code, pct_off, max_off_paise, min_fare_paise, uses_per_user) values
  ('FIRST50', 50, 10000, 15000, 1),
  ('SAARTHI20', 20, 15000, 20000, 3)
on conflict (code) do nothing;

create table if not exists public.wallet_ledger (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.profiles (id),
  amount_paise  int  not null check (amount_paise <> 0),
  kind          text not null check (kind in ('referral_bonus', 'trip_payment', 'admin_credit', 'refund')),
  booking_id    uuid references public.bookings (id),
  note          text check (char_length(note) <= 200),
  created_at    timestamptz not null default now(),
  unique (user_id, booking_id, kind)
);
create index if not exists wallet_user_idx on public.wallet_ledger (user_id, created_at desc);
alter table public.wallet_ledger enable row level security;
drop policy if exists "wallet read" on public.wallet_ledger;
create policy "wallet read" on public.wallet_ledger for select using (user_id = auth.uid() or public.is_admin());

create or replace function public.wallet_balance(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount_paise), 0)::int from public.wallet_ledger where user_id = p_user;
$$;
revoke all on function public.wallet_balance(uuid) from public, anon, authenticated;

-- Discount a code gives on a fare for this user. Raises a plain message when it can't be used.
create or replace function public.promo_discount(p_code text, p_user uuid, p_fare int)
returns int language plpgsql stable security definer set search_path = public as $$
declare r public.promo_codes; v_used int;
begin
  select * into r from public.promo_codes where code = upper(trim(p_code));
  if r.code is null or not r.active then raise exception 'This code is not valid'; end if;
  if r.valid_until is not null and r.valid_until < (now() at time zone 'Asia/Kolkata')::date then raise exception 'This code has expired'; end if;
  if p_fare < r.min_fare_paise then raise exception 'Needs a fare of at least ₹%', r.min_fare_paise / 100; end if;
  select count(*) into v_used from public.bookings where customer_id = p_user and promo_code = r.code and status <> 'cancelled';
  if v_used >= r.uses_per_user then raise exception 'You have already used this code'; end if;
  return least(r.max_off_paise, round(p_fare * r.pct_off / 100.0)::int);
end $$;
revoke all on function public.promo_discount(text, uuid, int) from public, anon, authenticated;

create or replace function public.preview_promo(p_code text, p_trip public.trip_type, p_hours int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_fare int := public.quote_fare(p_trip, p_hours, 0); v_off int;
begin
  v_off := public.promo_discount(p_code, auth.uid(), v_fare);
  return jsonb_build_object('code', upper(trim(p_code)), 'fare', v_fare, 'discount', v_off, 'payable', v_fare - v_off);
end $$;

create or replace function public.my_wallet()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'balance', public.wallet_balance(auth.uid()),
    'referral_code', (select referral_code from public.profiles where id = auth.uid()),
    'referred', (select referred_by is not null from public.profiles where id = auth.uid()),
    'friends', (select count(*) from public.profiles where referred_by = auth.uid()),
    'entries', coalesce((select jsonb_agg(row_to_json(w) order by w.created_at desc) from (
        select amount_paise, kind, note, created_at from public.wallet_ledger
        where user_id = auth.uid() order by created_at desc limit 20) w), '[]'));
$$;

-- A new customer types a friend's code before their first trip. Both get ₹50 after that first trip.
create or replace function public.apply_referral(p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare v_friend uuid;
begin
  select id into v_friend from public.profiles where referral_code = upper(trim(p_code));
  if v_friend is null then raise exception 'No one has this code'; end if;
  if v_friend = auth.uid() then raise exception 'You cannot use your own code'; end if;
  if (select referred_by from public.profiles where id = auth.uid()) is not null then raise exception 'You have already used a friend''s code'; end if;
  if exists (select 1 from public.bookings where customer_id = auth.uid() and status = 'completed') then
    raise exception 'Friend codes work only before your first trip';
  end if;
  update public.profiles set referred_by = v_friend where id = auth.uid();
end $$;

create or replace function public.admin_wallet_credit(p_user uuid, p_amount_paise int, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_amount_paise <= 0 or p_amount_paise > 500000 then raise exception 'amount must be ₹1 to ₹5,000'; end if;
  insert into public.wallet_ledger (user_id, amount_paise, kind, note) values (p_user, p_amount_paise, 'admin_credit', left(p_note, 200));
end $$;

create or replace function public.admin_upsert_promo(p_code text, p_pct int, p_max_paise int, p_min_paise int,
  p_uses int, p_valid_until date, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  insert into public.promo_codes (code, pct_off, max_off_paise, min_fare_paise, uses_per_user, valid_until, active)
  values (upper(trim(p_code)), p_pct, p_max_paise, p_min_paise, p_uses, p_valid_until, p_active)
  on conflict (code) do update set pct_off = excluded.pct_off, max_off_paise = excluded.max_off_paise,
     min_fare_paise = excluded.min_fare_paise, uses_per_user = excluded.uses_per_user,
     valid_until = excluded.valid_until, active = excluded.active;
end $$;

-- ===============================================================
-- F. Booking: now, or scheduled later; promo code; pay from wallet
-- ===============================================================
drop function if exists public.create_booking(uuid, public.trip_type, int, double precision, double precision, text, text);
create or replace function public.create_booking(p_car uuid, p_trip public.trip_type, p_hours int,
  p_lat double precision, p_lng double precision, p_pickup_address text, p_drop_address text default null,
  p_scheduled_for timestamptz default null, p_promo text default null, p_use_wallet boolean default false)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_fare int; v_off int := 0;
begin
  if not exists (select 1 from public.cars where id = p_car and owner_id = auth.uid()) then raise exception 'car not found'; end if;
  if p_scheduled_for is null then
    if exists (select 1 from public.bookings where customer_id = auth.uid() and scheduled_for is null
               and status in ('requested', 'accepted', 'started')) then
      raise exception 'you already have an active booking';
    end if;
  else
    if p_scheduled_for < now() + interval '30 minutes' then raise exception 'schedule at least 30 minutes ahead'; end if;
    if p_scheduled_for > now() + interval '30 days' then raise exception 'schedule within the next 30 days'; end if;
    if (select count(*) from public.bookings where customer_id = auth.uid() and scheduled_for > now()
        and status in ('requested', 'accepted')) >= 5 then
      raise exception 'you can have up to 5 upcoming bookings';
    end if;
  end if;
  v_fare := public.quote_fare(p_trip, p_hours, 0);
  if nullif(trim(p_promo), '') is not null then v_off := public.promo_discount(p_promo, auth.uid(), v_fare); end if;
  insert into public.bookings (customer_id, car_id, trip_type, hours, pickup, pickup_address, drop_address, quoted_paise,
                               scheduled_for, promo_code, discount_paise, use_wallet)
  values (auth.uid(), p_car, p_trip, p_hours, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
          p_pickup_address, p_drop_address, v_fare, p_scheduled_for,
          case when v_off > 0 then upper(trim(p_promo)) end, v_off, coalesce(p_use_wallet, false))
  returning id into v_id;
  insert into public.booking_codes (booking_id, start_code) values (v_id, lpad((floor(random() * 10000))::int::text, 4, '0'));
  insert into public.booking_events (booking_id, actor_id, event)
  values (v_id, auth.uid(), case when p_scheduled_for is null then 'requested' else 'scheduled' end);
  return v_id;
end $$;

-- A driver may hold scheduled trips for later, but only one trip happening now.
create or replace function public.accept_booking(p_booking uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_sched timestamptz;
begin
  if not exists (select 1 from public.drivers where id = auth.uid() and status = 'approved' and is_online) then
    raise exception 'go online first';
  end if;
  select scheduled_for into v_sched from public.bookings where id = p_booking;
  if v_sched is null and exists (select 1 from public.bookings where driver_id = auth.uid()
       and status in ('accepted', 'started') and (scheduled_for is null or status = 'started')) then
    raise exception 'finish your current trip first';
  end if;
  update public.bookings set driver_id = auth.uid(), status = 'accepted', accepted_at = now()
   where id = p_booking and status = 'requested' and driver_id is null;
  if not found then raise exception 'this trip was already taken'; end if;
  insert into public.booking_events (booking_id, actor_id, event) values (p_booking, auth.uid(), 'accepted');
end $$;

create or replace function public.start_trip(p_booking uuid, p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare v_sched timestamptz;
begin
  if not exists (select 1 from public.booking_codes c join public.bookings b on b.id = c.booking_id
                 where b.id = p_booking and b.driver_id = auth.uid() and b.status = 'accepted' and c.start_code = p_code) then
    raise exception 'wrong code';
  end if;
  select scheduled_for into v_sched from public.bookings where id = p_booking;
  if v_sched is not null and v_sched > now() + interval '1 hour' then raise exception 'this trip is scheduled for later'; end if;
  if exists (select 1 from public.bookings where driver_id = auth.uid() and status = 'started') then
    raise exception 'finish your current trip first';
  end if;
  update public.bookings set status = 'started', started_at = now() where id = p_booking;
  insert into public.booking_events (booking_id, actor_id, event) values (p_booking, auth.uid(), 'started');
end $$;

-- Completing a trip settles everything: discount, wallet, cash, commission, referral reward.
-- Driver always earns (fare - commission). What the driver collected minus that earning is
-- what the driver owes Saarthi (negative = Saarthi owes the driver, e.g. UPI or discount).
create or replace function public.complete_trip(p_booking uuid, p_method text default 'cash')
returns int language plpgsql security definer set search_path = public as $$
declare b public.bookings; v_hours int; v_final int; v_fee int; v_pct int; v_off int; v_wallet int := 0;
        v_payable int; v_collected int; v_earn int; v_net int; v_friend uuid;
begin
  if p_method not in ('cash', 'upi') then raise exception 'payment must be cash or upi'; end if;
  select * into b from public.bookings where id = p_booking and driver_id = auth.uid() and status = 'started' for update;
  if b.id is null then raise exception 'trip not running'; end if;
  v_hours := greatest(b.hours, ceil(extract(epoch from now() - b.started_at) / 3600.0)::int);
  v_final := greatest(b.quoted_paise, public.quote_fare(b.trip_type, least(v_hours, 72), 0));
  select platform_fee_pct into v_pct from public.fare_rules where trip_type = b.trip_type;
  v_fee := round(v_final * v_pct / 100.0)::int;
  v_earn := v_final - v_fee;
  v_off := least(b.discount_paise, v_final);
  v_payable := v_final - v_off;
  if b.use_wallet then v_wallet := least(greatest(public.wallet_balance(b.customer_id), 0), v_payable); end if;
  v_payable := v_payable - v_wallet;
  v_collected := case when p_method = 'cash' then v_payable else 0 end;   -- UPI goes to Saarthi
  v_net := v_collected - v_earn;

  update public.bookings
     set status = 'completed', completed_at = now(), quoted_paise = v_final, platform_fee_paise = v_fee,
         driver_earning_paise = v_earn, payment_method = p_method, discount_paise = v_off,
         wallet_paise = v_wallet, cash_collected_paise = v_payable
   where id = p_booking;

  if v_wallet > 0 then
    insert into public.wallet_ledger (user_id, amount_paise, kind, booking_id, note)
    values (b.customer_id, -v_wallet, 'trip_payment', p_booking, 'Paid from wallet');
  end if;
  if v_net <> 0 then
    insert into public.driver_ledger (driver_id, booking_id, kind, amount_paise, note)
    values (auth.uid(), p_booking, 'commission', v_net,
            case when v_net > 0 then 'Commission on cash trip' else 'Saarthi owes you for this trip' end)
    on conflict (booking_id, kind) do nothing;
  end if;

  -- Referral: first completed trip of a referred customer rewards both people with ₹50.
  select referred_by into v_friend from public.profiles where id = b.customer_id;
  if v_friend is not null and (select count(*) from public.bookings where customer_id = b.customer_id and status = 'completed') = 1 then
    insert into public.wallet_ledger (user_id, amount_paise, kind, booking_id, note) values
      (b.customer_id, 5000, 'referral_bonus', p_booking, 'Welcome bonus — you joined with a friend''s code'),
      (v_friend, 5000, 'referral_bonus', p_booking, 'Your friend finished their first trip')
    on conflict do nothing;
  end if;

  insert into public.booking_events (booking_id, actor_id, event) values (p_booking, auth.uid(), 'completed');
  return v_final;
end $$;

-- Admin pays a driver what Saarthi owes them (when the balance is negative).
create or replace function public.admin_record_payout(p_driver uuid, p_amount_paise int, p_method text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_amount_paise <= 0 then raise exception 'amount must be more than zero'; end if;
  if p_method not in ('cash', 'upi', 'bank') then raise exception 'method must be cash, upi or bank'; end if;
  if p_amount_paise > -(select coalesce(sum(amount_paise), 0) from public.driver_ledger where driver_id = p_driver) then
    raise exception 'that is more than Saarthi owes this driver';
  end if;
  insert into public.driver_ledger (driver_id, kind, amount_paise, method, note, created_by)
  values (p_driver, 'settlement', p_amount_paise, p_method, coalesce(left(p_note, 200), 'Paid to driver'), auth.uid());
end $$;

-- ===============================================================
-- G. Monthly driver plans
-- ===============================================================
create table if not exists public.monthly_plans (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.profiles (id),
  car_id          uuid not null references public.cars (id),
  driver_id       uuid references public.drivers (id),
  start_date      date not null,
  shift_start     time not null,
  daily_hours     int  not null check (daily_hours between 4 and 12),
  days_per_week   int  not null check (days_per_week between 5 and 7),
  pickup_address  text not null check (char_length(pickup_address) between 3 and 200),
  notes           text check (char_length(notes) <= 300),
  monthly_paise   int  not null check (monthly_paise > 0),
  status          text not null default 'requested' check (status in ('requested', 'assigned', 'active', 'cancelled', 'ended')),
  created_at      timestamptz not null default now(),
  assigned_at     timestamptz,
  confirmed_at    timestamptz
);
alter table public.monthly_plans enable row level security;
drop policy if exists "monthly read" on public.monthly_plans;
create policy "monthly read" on public.monthly_plans for select
  using (customer_id = auth.uid() or driver_id = auth.uid() or public.is_admin());

-- ₹70 per driving hour, about 4.33 weeks a month, rounded up to the next ₹100.
create or replace function public.monthly_quote(p_hours int, p_days int)
returns int language sql immutable as $$
  select (ceil(p_hours * p_days * 4.33 * 70 / 100.0) * 100 * 100)::int;
$$;

create or replace function public.create_monthly_request(p_car uuid, p_start date, p_shift time, p_hours int, p_days int,
  p_address text, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.cars where id = p_car and owner_id = auth.uid()) then raise exception 'car not found'; end if;
  if p_start < (now() at time zone 'Asia/Kolkata')::date + 1 then raise exception 'start from tomorrow or later'; end if;
  if exists (select 1 from public.monthly_plans where customer_id = auth.uid() and car_id = p_car and status in ('requested', 'assigned', 'active')) then
    raise exception 'this car already has a monthly plan';
  end if;
  insert into public.monthly_plans (customer_id, car_id, start_date, shift_start, daily_hours, days_per_week, pickup_address, notes, monthly_paise)
  values (auth.uid(), p_car, p_start, p_shift, p_hours, p_days, p_address, p_notes, public.monthly_quote(p_hours, p_days))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.cancel_monthly(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.monthly_plans set status = case when status = 'active' then 'ended' else 'cancelled' end
   where id = p_id and customer_id = auth.uid() and status in ('requested', 'assigned', 'active');
  if not found then raise exception 'cannot cancel this plan'; end if;
end $$;

create or replace function public.admin_assign_monthly(p_id uuid, p_driver uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if not exists (select 1 from public.drivers where id = p_driver and status = 'approved') then raise exception 'driver is not approved'; end if;
  update public.monthly_plans set driver_id = p_driver, status = 'assigned', assigned_at = now(), confirmed_at = null
   where id = p_id and status in ('requested', 'assigned');
  if not found then raise exception 'plan is not open'; end if;
end $$;

create or replace function public.driver_confirm_monthly(p_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_accept then
    update public.monthly_plans set status = 'active', confirmed_at = now() where id = p_id and driver_id = auth.uid() and status = 'assigned';
  else
    update public.monthly_plans set status = 'requested', driver_id = null, assigned_at = null where id = p_id and driver_id = auth.uid() and status = 'assigned';
  end if;
  if not found then raise exception 'plan not waiting for you'; end if;
end $$;

-- Details for screens (names and phones only to the people who need them).
create or replace function public.monthly_plans_view()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'status', m.status, 'start_date', m.start_date, 'shift_start', m.shift_start,
    'daily_hours', m.daily_hours, 'days_per_week', m.days_per_week, 'pickup_address', m.pickup_address,
    'notes', m.notes, 'monthly_paise', m.monthly_paise, 'created_at', m.created_at,
    'car', c.model || ' · ' || c.reg_no,
    'customer_name', cp.full_name, 'customer_phone', case when public.is_admin() or m.driver_id = auth.uid() then cp.phone end,
    'driver_id', m.driver_id, 'driver_name', dp.full_name,
    'driver_phone', case when public.is_admin() or (m.customer_id = auth.uid() and m.status = 'active') then dp.phone end
  ) order by m.created_at desc), '[]')
  from public.monthly_plans m
  join public.cars c on c.id = m.car_id
  join public.profiles cp on cp.id = m.customer_id
  left join public.profiles dp on dp.id = m.driver_id
  where m.customer_id = auth.uid() or m.driver_id = auth.uid() or public.is_admin();
$$;

-- ===============================================================
-- H. Admin: alerts, documents, money with discounts
-- ===============================================================
create or replace function public.admin_alerts()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  return jsonb_build_object(
    'sos', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'raised_as', s.raised_as, 'created_at', s.created_at,
             'lat', s.lat, 'lng', s.lng, 'booking_id', s.booking_id, 'pickup_address', b.pickup_address,
             'customer', cp.full_name, 'customer_phone', cp.phone, 'driver', dp.full_name, 'driver_phone', dp.phone,
             'car', c.model || ' · ' || c.reg_no) order by s.created_at desc)
           from public.sos_alerts s join public.bookings b on b.id = s.booking_id join public.cars c on c.id = b.car_id
           join public.profiles cp on cp.id = b.customer_id left join public.profiles dp on dp.id = b.driver_id
           where s.resolved_at is null), '[]'),
    'docs_waiting', (select count(distinct driver_id) from public.driver_documents where status = 'pending'),
    'monthly_waiting', (select count(*) from public.monthly_plans where status = 'requested')
  );
end $$;

create or replace function public.admin_driver_documents(p_driver uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  return coalesce((select jsonb_agg(row_to_json(d)) from (
    select kind, path, status, note, uploaded_at, reviewed_at from public.driver_documents where driver_id = p_driver) d), '[]');
end $$;

-- admin_drivers now also returns the verified badge and whether documents wait for review.
drop function if exists public.admin_drivers();
create or replace function public.admin_drivers()
returns table (id uuid, full_name text, phone text, licence_no text, experience_years int, city text,
               status public.driver_status, is_online boolean, trips bigint, created_at timestamptz,
               verified boolean, docs_pending boolean, photo_path text)
language sql stable security definer set search_path = public as $$
  select d.id, p.full_name, p.phone, d.licence_no, d.experience_years, d.city, d.status, d.is_online,
         (select count(*) from public.bookings b where b.driver_id = d.id and b.status = 'completed'),
         d.created_at, d.verified,
         exists (select 1 from public.driver_documents x where x.driver_id = d.id and x.status = 'pending'),
         d.photo_path
  from public.drivers d join public.profiles p on p.id = d.id
  where public.is_admin()
  order by d.status, d.created_at desc;
$$;

-- Discounts and wallet money are Saarthi's cost: net revenue = commission - discounts - wallet used.
create or replace function public.admin_money_extras(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_from timestamptz;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  v_from := case when p_days <= 0 then '-infinity'::timestamptz
                 else date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' - make_interval(days => p_days - 1) end;
  return (select jsonb_build_object(
    'discounts', coalesce(sum(discount_paise), 0),
    'wallet_used', coalesce(sum(wallet_paise), 0),
    'net', coalesce(sum(platform_fee_paise - discount_paise - wallet_paise), 0),
    'promo_trips', count(*) filter (where promo_code is not null),
    'scheduled', (select count(*) from public.bookings where scheduled_for > now() and status in ('requested', 'accepted')),
    'monthly_active', (select count(*) from public.monthly_plans where status = 'active'),
    'monthly_value', coalesce((select sum(monthly_paise) from public.monthly_plans where status = 'active'), 0),
    'wallet_outstanding', coalesce((select sum(amount_paise) from public.wallet_ledger), 0))
  from public.bookings where status = 'completed' and created_at >= v_from);
end $$;

-- ===============================================================
-- I. Permissions
-- ===============================================================
revoke all on function
  public.driver_save_document(text, text), public.admin_review_document(uuid, text, boolean, text),
  public.raise_sos(uuid, double precision, double precision), public.admin_resolve_sos(bigint, text),
  public.my_driver_location(uuid), public.preview_promo(text, public.trip_type, int), public.my_wallet(),
  public.apply_referral(text), public.admin_wallet_credit(uuid, int, text),
  public.admin_upsert_promo(text, int, int, int, int, date, boolean),
  public.create_booking(uuid, public.trip_type, int, double precision, double precision, text, text, timestamptz, text, boolean),
  public.accept_booking(uuid), public.start_trip(uuid, text), public.complete_trip(uuid, text),
  public.admin_record_payout(uuid, int, text, text), public.monthly_quote(int, int),
  public.create_monthly_request(uuid, date, time, int, int, text, text), public.cancel_monthly(uuid),
  public.admin_assign_monthly(uuid, uuid), public.driver_confirm_monthly(uuid, boolean), public.monthly_plans_view(),
  public.admin_alerts(), public.admin_driver_documents(uuid), public.admin_drivers(), public.admin_money_extras(int),
  public.get_shared_trip(uuid)
from public, anon;

grant execute on function
  public.driver_save_document(text, text), public.admin_review_document(uuid, text, boolean, text),
  public.raise_sos(uuid, double precision, double precision), public.admin_resolve_sos(bigint, text),
  public.my_driver_location(uuid), public.preview_promo(text, public.trip_type, int), public.my_wallet(),
  public.apply_referral(text), public.admin_wallet_credit(uuid, int, text),
  public.admin_upsert_promo(text, int, int, int, int, date, boolean),
  public.create_booking(uuid, public.trip_type, int, double precision, double precision, text, text, timestamptz, text, boolean),
  public.accept_booking(uuid), public.start_trip(uuid, text), public.complete_trip(uuid, text),
  public.admin_record_payout(uuid, int, text, text), public.monthly_quote(int, int),
  public.create_monthly_request(uuid, date, time, int, int, text, text), public.cancel_monthly(uuid),
  public.admin_assign_monthly(uuid, uuid), public.driver_confirm_monthly(uuid, boolean), public.monthly_plans_view(),
  public.admin_alerts(), public.admin_driver_documents(uuid), public.admin_drivers(), public.admin_money_extras(int)
to authenticated;

-- The share link works for family members who are not signed in.
grant execute on function public.get_shared_trip(uuid) to anon, authenticated;
