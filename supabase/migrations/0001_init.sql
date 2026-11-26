-- Saarthi: driver-on-demand for car owners
-- Run this whole file once in your Supabase project: Dashboard -> SQL Editor -> New query -> paste -> Run.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------
-- 1. People
-- ---------------------------------------------------------------
create type public.user_role as enum ('customer', 'driver', 'admin');
create type public.driver_status as enum ('pending', 'approved', 'blocked');
create type public.transmission as enum ('manual', 'automatic');
create type public.trip_type as enum ('hourly', 'one_way', 'round_trip', 'outstation');
create type public.booking_status as enum ('requested', 'accepted', 'started', 'completed', 'cancelled');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null default 'customer',
  full_name   text not null default '' check (char_length(full_name) <= 80),
  phone       text check (phone ~ '^[6-9][0-9]{9}$'),
  created_at  timestamptz not null default now()
);

create table public.drivers (
  id                  uuid primary key references public.profiles (id) on delete cascade,
  licence_no          text not null check (char_length(licence_no) between 5 and 30),
  experience_years    int  not null check (experience_years between 0 and 50),
  can_drive           public.transmission[] not null default '{manual}',
  city                text not null default 'Solapur',
  status              public.driver_status not null default 'pending',
  is_online           boolean not null default false,
  location            extensions.geography(point, 4326),
  location_updated_at timestamptz,
  rating_sum          int not null default 0,
  rating_count        int not null default 0,
  created_at          timestamptz not null default now()
);
create index drivers_location_gix on public.drivers using gist (location);
create index drivers_online_idx on public.drivers (status, is_online);

create table public.cars (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  reg_no        text not null check (reg_no ~ '^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$'),
  model         text not null check (char_length(model) between 2 and 40),
  transmission  public.transmission not null default 'manual',
  created_at    timestamptz not null default now(),
  unique (owner_id, reg_no)
);

-- ---------------------------------------------------------------
-- 2. Prices (money is always stored in paise, never rupees with decimals)
-- ---------------------------------------------------------------
create table public.fare_rules (
  trip_type              public.trip_type primary key,
  base_paise             int not null check (base_paise >= 0),
  base_hours             int not null check (base_hours >= 1),
  extra_hour_paise       int not null check (extra_hour_paise >= 0),
  night_surcharge_pct    int not null default 20 check (night_surcharge_pct between 0 and 100),
  pickup_per_km_paise    int not null default 1000 check (pickup_per_km_paise >= 0),
  platform_fee_pct       int not null default 15 check (platform_fee_pct between 0 and 50)
);

insert into public.fare_rules (trip_type, base_paise, base_hours, extra_hour_paise) values
  ('hourly',     19900, 2, 7000),
  ('one_way',    24900, 2, 8000),
  ('round_trip', 34900, 4, 7000),
  ('outstation', 99900, 12, 6000);

-- ---------------------------------------------------------------
-- 3. Bookings
-- ---------------------------------------------------------------
create table public.bookings (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.profiles (id),
  car_id          uuid not null references public.cars (id),
  driver_id       uuid references public.drivers (id),
  trip_type       public.trip_type not null,
  hours           int not null check (hours between 1 and 72),
  pickup          extensions.geography(point, 4326) not null,
  pickup_address  text not null check (char_length(pickup_address) between 3 and 200),
  drop_address    text check (char_length(drop_address) <= 200),
  quoted_paise    int not null check (quoted_paise > 0),
  status          public.booking_status not null default 'requested',
  cancel_reason   text,
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  rating          int check (rating between 1 and 5)
);
create index bookings_status_idx on public.bookings (status, created_at desc);
create index bookings_customer_idx on public.bookings (customer_id, created_at desc);
create index bookings_driver_idx on public.bookings (driver_id, created_at desc);

-- The start code is kept in its own table so the driver can never read it.
create table public.booking_codes (
  booking_id  uuid primary key references public.bookings (id) on delete cascade,
  start_code  text not null
);

-- Every change of state is written here and never edited.
create table public.booking_events (
  id          bigint generated always as identity primary key,
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  actor_id    uuid,
  event       text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- 4. Row level security: nobody reads or writes anything by default
-- ---------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.drivers        enable row level security;
alter table public.cars           enable row level security;
alter table public.fare_rules     enable row level security;
alter table public.bookings       enable row level security;
alter table public.booking_codes  enable row level security;
alter table public.booking_events enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- profiles
create policy "own profile read"   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "own profile update" on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

-- drivers: a driver sees their own row; admin sees all. Customers find drivers only through nearby_drivers().
create policy "driver own row" on public.drivers for select using (id = auth.uid() or public.is_admin());

-- cars
create policy "own cars" on public.cars for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "admin cars" on public.cars for select using (public.is_admin());

-- fares are public price information
create policy "fares readable" on public.fare_rules for select using (true);

-- bookings: customer sees own, driver sees assigned ones and open requests, admin sees all.
create policy "booking read" on public.bookings for select using (
  customer_id = auth.uid()
  or driver_id = auth.uid()
  or (status = 'requested' and exists (
        select 1 from public.drivers d where d.id = auth.uid() and d.status = 'approved' and d.is_online))
  or public.is_admin()
);

create policy "code customer only" on public.booking_codes for select using (
  exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = auth.uid())
);

create policy "events read" on public.booking_events for select using (
  exists (select 1 from public.bookings b where b.id = booking_id
          and (b.customer_id = auth.uid() or b.driver_id = auth.uid()))
  or public.is_admin()
);

-- All writes to drivers, bookings and events go through the functions below.

-- ---------------------------------------------------------------
-- 5. New user -> profile
-- ---------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- 6. Business functions (the server decides, never the app)
-- ---------------------------------------------------------------

-- Fare: base for the first N hours, then per extra hour, +night surcharge (22:00-06:00 IST),
-- +pickup distance charge beyond 2 km.
create or replace function public.quote_fare(p_trip public.trip_type, p_hours int, p_pickup_km numeric default 0)
returns int language plpgsql stable set search_path = public as $$
declare r public.fare_rules; v numeric; ist_hour int;
begin
  select * into r from public.fare_rules where trip_type = p_trip;
  if r is null then raise exception 'unknown trip type'; end if;
  if p_hours < 1 or p_hours > 72 then raise exception 'hours must be 1 to 72'; end if;
  v := r.base_paise + greatest(p_hours - r.base_hours, 0) * r.extra_hour_paise;
  v := v + greatest(coalesce(p_pickup_km, 0) - 2, 0) * r.pickup_per_km_paise;
  ist_hour := extract(hour from (now() at time zone 'Asia/Kolkata'));
  if ist_hour >= 22 or ist_hour < 6 then v := v * (100 + r.night_surcharge_pct) / 100.0; end if;
  return (ceil(v / 100.0) * 100)::int; -- round up to whole rupees
end $$;

-- Nearest approved, online drivers who sent a location in the last 2 minutes.
create or replace function public.nearby_drivers(p_lat double precision, p_lng double precision,
                                                 p_radius_m int default 5000, p_trip public.trip_type default 'hourly',
                                                 p_hours int default 2)
returns table (driver_id uuid, full_name text, distance_m int, rating numeric,
               experience_years int, can_drive public.transmission[], lat double precision,
               lng double precision, fare_paise int)
language sql stable security definer set search_path = public, extensions as $$
  with me as (select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography g)
  select d.id, split_part(p.full_name, ' ', 1),                -- first name only
         st_distance(d.location, me.g)::int,
         case when d.rating_count = 0 then null else round(d.rating_sum::numeric / d.rating_count, 1) end,
         d.experience_years, d.can_drive,
         round(st_y(d.location::geometry)::numeric, 3)::float8,  -- ~100 m precision, not exact home
         round(st_x(d.location::geometry)::numeric, 3)::float8,
         public.quote_fare(p_trip, p_hours, (st_distance(d.location, me.g) / 1000.0)::numeric)
  from public.drivers d join public.profiles p on p.id = d.id, me
  where auth.uid() is not null
    and d.status = 'approved' and d.is_online
    and d.location_updated_at > now() - interval '2 minutes'
    and st_dwithin(d.location, me.g, least(p_radius_m, 20000))
  order by d.location <-> me.g
  limit 20;
$$;

-- Driver: register or update details. Status always starts as pending (admin approves).
create or replace function public.driver_register(p_name text, p_phone text, p_licence text,
                                                  p_experience int, p_can_drive public.transmission[],
                                                  p_city text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  update public.profiles set full_name = p_name, phone = p_phone,
         role = case when role = 'admin' then role else 'driver' end
   where id = auth.uid();
  insert into public.drivers (id, licence_no, experience_years, can_drive, city)
  values (auth.uid(), upper(p_licence), p_experience, p_can_drive, p_city)
  on conflict (id) do update set licence_no = excluded.licence_no,
       experience_years = excluded.experience_years, can_drive = excluded.can_drive, city = excluded.city;
end $$;

-- Driver: go online/offline and send location.
create or replace function public.driver_ping(p_online boolean, p_lat double precision default null,
                                              p_lng double precision default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.drivers
     set is_online = p_online and status = 'approved',
         location = case when p_lat is null then location
                         else st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography end,
         location_updated_at = case when p_lat is null then location_updated_at else now() end
   where id = auth.uid();
  if not found then raise exception 'not a driver'; end if;
end $$;

-- Customer: create a booking. The price is calculated here, not taken from the app.
create or replace function public.create_booking(p_car uuid, p_trip public.trip_type, p_hours int,
                                                 p_lat double precision, p_lng double precision,
                                                 p_pickup_address text, p_drop_address text default null)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.cars where id = p_car and owner_id = auth.uid()) then
    raise exception 'car not found';
  end if;
  if exists (select 1 from public.bookings where customer_id = auth.uid()
             and status in ('requested', 'accepted', 'started')) then
    raise exception 'you already have an active booking';
  end if;
  insert into public.bookings (customer_id, car_id, trip_type, hours, pickup, pickup_address,
                               drop_address, quoted_paise)
  values (auth.uid(), p_car, p_trip, p_hours, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
          p_pickup_address, p_drop_address, public.quote_fare(p_trip, p_hours, 0))
  returning id into v_id;
  insert into public.booking_codes (booking_id, start_code)
  values (v_id, lpad((floor(random() * 10000))::int::text, 4, '0'));
  insert into public.booking_events (booking_id, actor_id, event) values (v_id, auth.uid(), 'requested');
  return v_id;
end $$;

-- Driver: accept. Only one driver can win, even if ten press Accept at the same moment.
create or replace function public.accept_booking(p_booking uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.drivers where id = auth.uid() and status = 'approved' and is_online) then
    raise exception 'go online first';
  end if;
  if exists (select 1 from public.bookings where driver_id = auth.uid() and status in ('accepted', 'started')) then
    raise exception 'finish your current trip first';
  end if;
  update public.bookings set driver_id = auth.uid(), status = 'accepted', accepted_at = now()
   where id = p_booking and status = 'requested' and driver_id is null;
  if not found then raise exception 'this trip was already taken'; end if;
  insert into public.booking_events (booking_id, actor_id, event) values (p_booking, auth.uid(), 'accepted');
end $$;

-- Driver: start the trip with the 4-digit code the customer reads out.
create or replace function public.start_trip(p_booking uuid, p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.booking_codes c join public.bookings b on b.id = c.booking_id
                 where b.id = p_booking and b.driver_id = auth.uid() and b.status = 'accepted'
                   and c.start_code = p_code) then
    raise exception 'wrong code';
  end if;
  update public.bookings set status = 'started', started_at = now() where id = p_booking;
  insert into public.booking_events (booking_id, actor_id, event) values (p_booking, auth.uid(), 'started');
end $$;

-- Driver: end the trip. Final fare = actual hours, never less than what was quoted.
create or replace function public.complete_trip(p_booking uuid)
returns int language plpgsql security definer set search_path = public as $$
declare b public.bookings; v_hours int; v_final int;
begin
  select * into b from public.bookings where id = p_booking and driver_id = auth.uid() and status = 'started'
    for update;
  if b.id is null then raise exception 'trip not running'; end if;
  v_hours := greatest(b.hours, ceil(extract(epoch from now() - b.started_at) / 3600.0)::int);
  v_final := greatest(b.quoted_paise, public.quote_fare(b.trip_type, least(v_hours, 72), 0));
  update public.bookings set status = 'completed', completed_at = now(), quoted_paise = v_final
   where id = p_booking;
  insert into public.booking_events (booking_id, actor_id, event) values (p_booking, auth.uid(), 'completed');
  return v_final;
end $$;

-- Customer (before start) or driver (before start) cancels.
create or replace function public.cancel_booking(p_booking uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.bookings set status = 'cancelled', cancel_reason = left(p_reason, 200)
   where id = p_booking and status in ('requested', 'accepted')
     and (customer_id = auth.uid() or driver_id = auth.uid());
  if not found then raise exception 'cannot cancel now'; end if;
  insert into public.booking_events (booking_id, actor_id, event) values (p_booking, auth.uid(), 'cancelled');
end $$;

-- Customer rates a completed trip once.
create or replace function public.rate_trip(p_booking uuid, p_rating int)
returns void language plpgsql security definer set search_path = public as $$
declare v_driver uuid;
begin
  if p_rating not between 1 and 5 then raise exception 'rating 1 to 5'; end if;
  update public.bookings set rating = p_rating
   where id = p_booking and customer_id = auth.uid() and status = 'completed' and rating is null
  returning driver_id into v_driver;
  if v_driver is null then raise exception 'cannot rate this trip'; end if;
  update public.drivers set rating_sum = rating_sum + p_rating, rating_count = rating_count + 1
   where id = v_driver;
end $$;

-- Customer: where is my driver now? Only while the trip is accepted or running.
create or replace function public.my_driver_location(p_booking uuid)
returns table (lat double precision, lng double precision, updated_at timestamptz, driver_name text, phone text)
language sql stable security definer set search_path = public, extensions as $$
  select st_y(d.location::geometry), st_x(d.location::geometry), d.location_updated_at,
         p.full_name, p.phone
  from public.bookings b join public.drivers d on d.id = b.driver_id join public.profiles p on p.id = d.id
  where b.id = p_booking and b.customer_id = auth.uid() and b.status in ('accepted', 'started');
$$;

-- Admin: approve or block a driver.
create or replace function public.admin_set_driver_status(p_driver uuid, p_status public.driver_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  update public.drivers set status = p_status,
         is_online = case when p_status = 'approved' then is_online else false end
   where id = p_driver;
end $$;

-- Admin: driver list with names.
create or replace function public.admin_drivers()
returns table (id uuid, full_name text, phone text, licence_no text, experience_years int,
               city text, status public.driver_status, is_online boolean, trips bigint, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select d.id, p.full_name, p.phone, d.licence_no, d.experience_years, d.city, d.status, d.is_online,
         (select count(*) from public.bookings b where b.driver_id = d.id and b.status = 'completed'),
         d.created_at
  from public.drivers d join public.profiles p on p.id = d.id
  where public.is_admin()
  order by d.status, d.created_at desc;
$$;

-- Function permissions: signed-in users only.
revoke all on all functions in schema public from public, anon;
grant execute on function public.quote_fare, public.nearby_drivers, public.driver_register, public.driver_ping,
  public.create_booking, public.accept_booking, public.start_trip, public.complete_trip, public.cancel_booking,
  public.rate_trip, public.my_driver_location, public.admin_set_driver_status, public.admin_drivers,
  public.is_admin to authenticated;

-- Live updates for bookings (drivers see new requests instantly, customers see "accepted").
alter publication supabase_realtime add table public.bookings;
