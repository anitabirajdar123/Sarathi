-- Saarthi 0002: who earns what, driver settlements, admin and driver dashboards.
-- Run once in Supabase: SQL Editor -> New query -> paste this whole file -> Run.
-- Additive only: no table or data is removed.

-- ---------------------------------------------------------------
-- 1. Money split saved on every completed trip
-- ---------------------------------------------------------------
alter table public.bookings
  add column if not exists platform_fee_paise   int check (platform_fee_paise >= 0),
  add column if not exists driver_earning_paise int check (driver_earning_paise >= 0),
  add column if not exists payment_method       text not null default 'cash' check (payment_method in ('cash', 'upi'));

-- ---------------------------------------------------------------
-- 2. Driver ledger: what a driver owes Saarthi
--    Customer pays the driver in cash -> driver owes the commission.
--    + amount = driver owes us, - amount = driver paid us.
-- ---------------------------------------------------------------
create table if not exists public.driver_ledger (
  id            bigint generated always as identity primary key,
  driver_id     uuid not null references public.drivers (id),
  booking_id    uuid references public.bookings (id),
  kind          text not null check (kind in ('commission', 'settlement', 'adjustment')),
  amount_paise  int  not null check (amount_paise <> 0),
  method        text check (method in ('cash', 'upi', 'bank')),
  note          text check (char_length(note) <= 200),
  created_by    uuid,
  created_at    timestamptz not null default now(),
  unique (booking_id, kind)
);
create index if not exists driver_ledger_driver_idx on public.driver_ledger (driver_id, created_at desc);
alter table public.driver_ledger enable row level security;
drop policy if exists "ledger read" on public.driver_ledger;
create policy "ledger read" on public.driver_ledger for select using (driver_id = auth.uid() or public.is_admin());

-- Backfill trips completed before this file.
update public.bookings b
   set platform_fee_paise = round(b.quoted_paise * f.platform_fee_pct / 100.0)::int,
       driver_earning_paise = b.quoted_paise - round(b.quoted_paise * f.platform_fee_pct / 100.0)::int
  from public.fare_rules f
 where f.trip_type = b.trip_type and b.status = 'completed' and b.platform_fee_paise is null;

insert into public.driver_ledger (driver_id, booking_id, kind, amount_paise, note)
select b.driver_id, b.id, 'commission', b.platform_fee_paise, 'Commission on cash trip'
  from public.bookings b
 where b.status = 'completed' and b.payment_method = 'cash' and b.platform_fee_paise > 0
on conflict (booking_id, kind) do nothing;

-- ---------------------------------------------------------------
-- 3. Completing a trip now records the split and the commission owed
-- ---------------------------------------------------------------
-- The old one-argument version is replaced (payment method now defaults to cash).
drop function if exists public.complete_trip(uuid);
create or replace function public.complete_trip(p_booking uuid, p_method text default 'cash')
returns int language plpgsql security definer set search_path = public as $$
declare b public.bookings; v_hours int; v_final int; v_fee int; v_pct int;
begin
  if p_method not in ('cash', 'upi') then raise exception 'payment must be cash or upi'; end if;
  select * into b from public.bookings where id = p_booking and driver_id = auth.uid() and status = 'started'
    for update;
  if b.id is null then raise exception 'trip not running'; end if;
  v_hours := greatest(b.hours, ceil(extract(epoch from now() - b.started_at) / 3600.0)::int);
  v_final := greatest(b.quoted_paise, public.quote_fare(b.trip_type, least(v_hours, 72), 0));
  select platform_fee_pct into v_pct from public.fare_rules where trip_type = b.trip_type;
  v_fee := round(v_final * v_pct / 100.0)::int;
  update public.bookings
     set status = 'completed', completed_at = now(), quoted_paise = v_final,
         platform_fee_paise = v_fee, driver_earning_paise = v_final - v_fee, payment_method = p_method
   where id = p_booking;
  -- Cash goes to the driver, so the driver owes our commission.
  -- (UPI would come to Saarthi first; payout to drivers is a later feature.)
  if p_method = 'cash' and v_fee > 0 then
    insert into public.driver_ledger (driver_id, booking_id, kind, amount_paise, note)
    values (auth.uid(), p_booking, 'commission', v_fee, 'Commission on cash trip');
  end if;
  insert into public.booking_events (booking_id, actor_id, event) values (p_booking, auth.uid(), 'completed');
  return v_final;
end $$;

-- ---------------------------------------------------------------
-- 4. Admin: one call returns the whole dashboard for a date range (IST)
-- ---------------------------------------------------------------
create or replace function public.admin_dashboard(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_from timestamptz; r jsonb;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  v_from := case when p_days <= 0 then '-infinity'::timestamptz
                 else date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'
                      - make_interval(days => p_days - 1) end;
  with t as (select * from public.bookings where created_at >= v_from),
       c as (select * from t where status = 'completed')
  select jsonb_build_object(
    'gross',          coalesce((select sum(quoted_paise) from c), 0),
    'platform',       coalesce((select sum(platform_fee_paise) from c), 0),
    'drivers',        coalesce((select sum(driver_earning_paise) from c), 0),
    'completed',      (select count(*) from c),
    'cancelled',      (select count(*) from t where status = 'cancelled'),
    'requests',       (select count(*) from t),
    'avg_fare',       coalesce((select round(avg(quoted_paise)) from c), 0),
    'avg_rating',     (select round(avg(rating)::numeric, 2) from c where rating is not null),
    'customers',      (select count(distinct customer_id) from t),
    'online_now',     (select count(*) from public.drivers where is_online and location_updated_at > now() - interval '2 minutes'),
    'approved',       (select count(*) from public.drivers where status = 'approved'),
    'pending',        (select count(*) from public.drivers where status = 'pending'),
    'owed_by_drivers',coalesce((select sum(amount_paise) from public.driver_ledger), 0),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d::date, 'gross', coalesce(x.g, 0), 'platform', coalesce(x.p, 0), 'trips', coalesce(x.n, 0)) order by d)
      from generate_series(
             (case when p_days <= 0 then (select coalesce(min(completed_at), now()) from c) else v_from end at time zone 'Asia/Kolkata')::date,
             (now() at time zone 'Asia/Kolkata')::date, interval '1 day') d
      left join (select (completed_at at time zone 'Asia/Kolkata')::date as day, sum(quoted_paise) g,
                        sum(platform_fee_paise) p, count(*) n from c group by 1) x on x.day = d::date), '[]'),
    'by_type', coalesce((
      select jsonb_agg(jsonb_build_object('trip_type', trip_type, 'trips', n, 'gross', g))
      from (select trip_type, count(*) n, sum(quoted_paise) g from c group by 1) s), '[]'),
    'top_drivers', coalesce((
      select jsonb_agg(row_to_json(s)) from (
        select p.full_name, count(*) trips, sum(c.driver_earning_paise) earned, sum(c.platform_fee_paise) commission
        from c join public.profiles p on p.id = c.driver_id
        group by p.full_name order by sum(c.quoted_paise) desc limit 5) s), '[]')
  ) into r;
  return r;
end $$;

-- Admin: everything about one driver.
create or replace function public.admin_driver_detail(p_driver uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  select jsonb_build_object(
    'profile', (select jsonb_build_object('full_name', p.full_name, 'phone', p.phone, 'licence_no', d.licence_no,
                  'experience_years', d.experience_years, 'city', d.city, 'status', d.status, 'is_online', d.is_online,
                  'can_drive', d.can_drive, 'joined', d.created_at,
                  'rating', case when d.rating_count = 0 then null else round(d.rating_sum::numeric / d.rating_count, 1) end,
                  'rating_count', d.rating_count)
                from public.drivers d join public.profiles p on p.id = d.id where d.id = p_driver),
    'trips',      (select count(*) from public.bookings where driver_id = p_driver and status = 'completed'),
    'cancelled',  (select count(*) from public.bookings where driver_id = p_driver and status = 'cancelled'),
    'gross',      coalesce((select sum(quoted_paise) from public.bookings where driver_id = p_driver and status = 'completed'), 0),
    'earned',     coalesce((select sum(driver_earning_paise) from public.bookings where driver_id = p_driver and status = 'completed'), 0),
    'commission', coalesce((select sum(platform_fee_paise) from public.bookings where driver_id = p_driver and status = 'completed'), 0),
    'owes',       coalesce((select sum(amount_paise) from public.driver_ledger where driver_id = p_driver), 0),
    'ledger', coalesce((select jsonb_agg(row_to_json(l) order by l.created_at desc) from (
                select id, kind, amount_paise, method, note, created_at from public.driver_ledger
                where driver_id = p_driver order by created_at desc limit 30) l), '[]'),
    'recent', coalesce((select jsonb_agg(row_to_json(b) order by b.created_at desc) from (
                select id, trip_type, hours, pickup_address, quoted_paise, platform_fee_paise, driver_earning_paise,
                       status, rating, created_at from public.bookings
                where driver_id = p_driver order by created_at desc limit 20) b), '[]')
  ) into r;
  return r;
end $$;

-- Admin: record money a driver handed over (reduces what they owe).
create or replace function public.admin_record_settlement(p_driver uuid, p_amount_paise int, p_method text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_amount_paise <= 0 then raise exception 'amount must be more than zero'; end if;
  if p_method not in ('cash', 'upi', 'bank') then raise exception 'method must be cash, upi or bank'; end if;
  if p_amount_paise > (select coalesce(sum(amount_paise), 0) from public.driver_ledger where driver_id = p_driver) then
    raise exception 'that is more than the driver owes';
  end if;
  insert into public.driver_ledger (driver_id, kind, amount_paise, method, note, created_by)
  values (p_driver, 'settlement', -p_amount_paise, p_method, left(p_note, 200), auth.uid());
end $$;

-- Admin: change prices. Every change applies to new bookings only.
create or replace function public.admin_update_fare(p_trip public.trip_type, p_base_paise int, p_base_hours int,
  p_extra_hour_paise int, p_night_pct int, p_pickup_km_paise int, p_platform_pct int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  update public.fare_rules set base_paise = p_base_paise, base_hours = p_base_hours, extra_hour_paise = p_extra_hour_paise,
         night_surcharge_pct = p_night_pct, pickup_per_km_paise = p_pickup_km_paise, platform_fee_pct = p_platform_pct
   where trip_type = p_trip;
end $$;

-- Admin: live map — online drivers and waiting requests.
create or replace function public.admin_live()
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  return jsonb_build_object(
    'drivers', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', p.full_name,
                 'lat', st_y(d.location::geometry), 'lng', st_x(d.location::geometry),
                 'busy', exists (select 1 from public.bookings b where b.driver_id = d.id and b.status in ('accepted', 'started'))))
               from public.drivers d join public.profiles p on p.id = d.id
               where d.is_online and d.location is not null and d.location_updated_at > now() - interval '2 minutes'), '[]'),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'lat', st_y(b.pickup::geometry),
                 'lng', st_x(b.pickup::geometry), 'address', b.pickup_address, 'fare', b.quoted_paise,
                 'waiting_s', extract(epoch from now() - b.created_at)::int))
               from public.bookings b where b.status = 'requested'), '[]'),
    'running', (select count(*) from public.bookings where status = 'started'),
    'on_way',  (select count(*) from public.bookings where status = 'accepted')
  );
end $$;

-- ---------------------------------------------------------------
-- 5. Driver: own earnings dashboard
-- ---------------------------------------------------------------
create or replace function public.driver_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_today date := (now() at time zone 'Asia/Kolkata')::date; r jsonb;
begin
  if not exists (select 1 from public.drivers where id = auth.uid()) then raise exception 'not a driver'; end if;
  with c as (select *, (completed_at at time zone 'Asia/Kolkata')::date as day
             from public.bookings where driver_id = auth.uid() and status = 'completed')
  select jsonb_build_object(
    'today',      coalesce((select sum(driver_earning_paise) from c where day = v_today), 0),
    'today_trips',(select count(*) from c where day = v_today),
    'week',       coalesce((select sum(driver_earning_paise) from c where day > v_today - 7), 0),
    'month',      coalesce((select sum(driver_earning_paise) from c where day >= date_trunc('month', v_today)), 0),
    'total',      coalesce((select sum(driver_earning_paise) from c), 0),
    'trips',      (select count(*) from c),
    'hours',      coalesce((select round(sum(extract(epoch from completed_at - started_at)) / 3600.0, 1) from c), 0),
    'commission', coalesce((select sum(platform_fee_paise) from c), 0),
    'owes',       coalesce((select sum(amount_paise) from public.driver_ledger where driver_id = auth.uid()), 0),
    'acceptance', (select case when count(*) = 0 then null
                    else round(100.0 * count(*) filter (where status = 'completed') / count(*)) end
                   from public.bookings where driver_id = auth.uid()),
    'stars', coalesce((select jsonb_object_agg(rating, n) from (select rating, count(*) n from c where rating is not null group by 1) s), '{}'),
    'daily', (select jsonb_agg(jsonb_build_object('day', d::date, 'earned', coalesce(x.e, 0), 'trips', coalesce(x.n, 0)) order by d)
              from generate_series(v_today - 13, v_today, interval '1 day') d
              left join (select day, sum(driver_earning_paise) e, count(*) n from c group by day) x on x.day = d::date),
    'ledger', coalesce((select jsonb_agg(row_to_json(l) order by l.created_at desc) from (
                select kind, amount_paise, method, note, created_at from public.driver_ledger
                where driver_id = auth.uid() order by created_at desc limit 20) l), '[]')
  ) into r;
  return r;
end $$;

revoke all on function public.complete_trip(uuid, text), public.admin_dashboard(int), public.admin_driver_detail(uuid),
  public.admin_record_settlement(uuid, int, text, text), public.admin_update_fare(public.trip_type, int, int, int, int, int, int),
  public.admin_live(), public.driver_dashboard() from public, anon;
grant execute on function public.complete_trip(uuid, text), public.admin_dashboard(int), public.admin_driver_detail(uuid),
  public.admin_record_settlement(uuid, int, text, text), public.admin_update_fare(public.trip_type, int, int, int, int, int, int),
  public.admin_live(), public.driver_dashboard() to authenticated;
