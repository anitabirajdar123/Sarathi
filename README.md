# Saarthi — a trusted driver for your car, in minutes

Car owners book a verified driver near them to drive **their own car** — hourly, one-way, round trip or outstation.
The app shows the nearest online drivers on a live map with their price, and the trip starts only with the customer's 4-digit code.

## Tech
- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS v4**
- **Supabase**: Auth (email OTP), Postgres + **PostGIS** (nearest-driver search), Row Level Security, Realtime
- **Leaflet** + OpenStreetMap / CARTO dark tiles (free maps)

## What it does
| Role | Features |
|---|---|
| Customer | Email OTP sign-in · add cars · live map of nearby drivers with fare · book · live driver tracking · start code · cancel · rate |
| Driver | Register (licence, experience, manual/automatic) · wait for approval · Online/Offline · live new-request feed · accept · start with code · end trip · earnings |
| Admin | Approve / block drivers · live stats · recent trips |

## Engineering highlights (talk about these in an interview)
1. **Nearest driver** — `nearby_drivers()` uses a PostGIS GiST index and `<->` distance ordering, only drivers seen in the last 2 minutes, and returns a rounded (~100 m) position so a driver's exact location is not exposed.
2. **No double booking** — `accept_booking()` is one atomic `UPDATE … WHERE status = 'requested' AND driver_id IS NULL`. If ten drivers press Accept together, exactly one wins.
3. **Server decides the price** — `quote_fare()` (base hours + extra hours + night surcharge + pickup distance). The app never sends a price.
4. **Start code the driver can't read** — kept in `booking_codes`, readable only by the customer through RLS.
5. **Security by default** — RLS on every table; all writes go through `security definer` functions with their own checks.
6. **Audit trail** — every state change is written to `booking_events`.
7. **Money in paise** (integers), never floating-point rupees.

## Setup (10 minutes)
1. Create a free project at https://supabase.com (your personal account).
2. **SQL Editor → New query** → paste all of `supabase/migrations/0001_init.sql` → **Run**.
3. **Authentication → Sign In / Providers → Email**: turn **Confirm email** OFF (so password accounts work without an email), and in **URL Configuration** set Site URL `http://localhost:3000` and add Redirect URL `http://localhost:3000/**` (for the email-link sign-in).
4. **Project Settings → API**: copy the Project URL and the anon / publishable key.
5. Copy `.env.local.example` to `.env.local` and paste them in.
6. Run:
   ```
   npm install
   npm run dev
   ```
   Open http://localhost:3000
7. Make yourself admin (SQL Editor):
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'YOUR-EMAIL');
   ```

## Try the full flow
Use two browsers (or one normal + one private window):
1. Window A → *Drive with Saarthi* → sign in → register as driver.
2. Admin (`/admin`) → Approve the driver.
3. Window A → go **Online** (allow location).
4. Window B → *Book a driver* → sign in with another email → add a car → you see the driver on the map with a price → Request.
5. Window A → the request appears instantly → Accept.
6. Window B → shows *Driver on the way* + the 4-digit code.
7. Window A → type the code → Start trip → End trip.
8. Window B → rate the trip.

## Next steps (roadmap)
- Phone OTP (needs an SMS provider such as MSG91 / Twilio)
- Razorpay UPI payment and driver payouts
- Driver document upload (Supabase Storage) and police verification status
- SOS button and share-trip link
- Expo mobile app reusing the same database
- Deploy on Vercel
