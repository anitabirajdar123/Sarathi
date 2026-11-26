"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Car as CarIcon, Phone, Star, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLocation, useSession } from "@/lib/useSession";
import { DEFAULT_POS, errText, km, rupees } from "@/lib/format";
import { STATUS_LABEL, TRIP_LABEL, type Booking, type Car, type NearbyDriver, type TripType } from "@/lib/types";
import { Shell, Notice } from "@/components/Shell";
import { Map } from "@/components/Map";
import type { Pin } from "@/components/MapView";

const ACTIVE = ["requested", "accepted", "started"];

export default function CustomerPage() {
  const { profile, loading, reload, signOut } = useSession();
  const { pos, error: locErr } = useLocation();
  const here = pos ?? DEFAULT_POS;

  const [cars, setCars] = useState<Car[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const [c, b] = await Promise.all([
      supabase.from("cars").select("id, reg_no, model, transmission").order("created_at"),
      supabase.from("bookings").select("*").eq("customer_id", profile.id).order("created_at", { ascending: false }).limit(20),
    ]);
    setCars((c.data ?? []) as Car[]);
    setBookings((b.data ?? []) as Booking[]);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  // Live: any change to my bookings (driver accepted, trip started, completed) refreshes the screen.
  useEffect(() => {
    if (!profile) return;
    const ch = supabase.channel("my-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `customer_id=eq.${profile.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile, load]);

  const active = bookings.find((b) => ACTIVE.includes(b.status));
  const toRate = bookings.find((b) => b.status === "completed" && !b.rating);

  if (loading) return <Shell title="Customer"><div className="card animate-pulse h-40" /></Shell>;
  if (profile && (!profile.full_name || !profile.phone)) return <Shell title="Customer" onSignOut={signOut}><ProfileForm onDone={reload} /></Shell>;

  return (
    <Shell title="Customer" onSignOut={signOut}>
      <h1 className="mb-6 text-2xl font-bold">Hello, {profile?.full_name.split(" ")[0]} 👋</h1>
      {err && <div className="mb-4"><Notice>{err}</Notice></div>}
      {toRate && <RateCard booking={toRate} onDone={load} />}
      {active
        ? <ActiveTrip booking={active} here={here} onChange={load} setErr={setErr} />
        : <BookForm cars={cars} here={here} locErr={locErr} onBooked={load} setErr={setErr} />}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Cars cars={cars} onChange={load} />
        <History bookings={bookings} />
      </div>
    </Shell>
  );
}

function ProfileForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("profiles").update({ full_name: name.trim(), phone }).eq("id", user!.id);
    if (error) setErr(errText(error)); else onDone();
  };
  return (
    <form onSubmit={save} className="card mx-auto max-w-md space-y-4">
      <h2 className="text-xl font-bold">Tell us about you</h2>
      <div><label className="label">Full name</label><input className="input" required value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div><label className="label">Mobile (10 digits)</label><input className="input" required pattern="[6-9][0-9]{9}" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} /></div>
      {err && <Notice>{err}</Notice>}
      <button className="btn-gold w-full">Continue</button>
    </form>
  );
}

function BookForm({ cars, here, locErr, onBooked, setErr }:
  { cars: Car[]; here: { lat: number; lng: number }; locErr: string | null; onBooked: () => void; setErr: (s: string | null) => void }) {
  const [carId, setCarId] = useState("");
  const [trip, setTrip] = useState<TripType>("hourly");
  const [hours, setHours] = useState(2);
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [drivers, setDrivers] = useState<NearbyDriver[]>([]);
  const [busy, setBusy] = useState(false);
  const radius = 5000;

  useEffect(() => { if (!carId && cars[0]) setCarId(cars[0].id); }, [cars, carId]);

  // Refresh the nearby drivers every 15 seconds.
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const { data } = await supabase.rpc("nearby_drivers", { p_lat: here.lat, p_lng: here.lng, p_radius_m: radius, p_trip: trip, p_hours: hours });
      if (!stop) setDrivers((data ?? []) as NearbyDriver[]);
    };
    tick(); const id = setInterval(tick, 15000);
    return () => { stop = true; clearInterval(id); };
  }, [here.lat, here.lng, trip, hours]);

  const pins: Pin[] = useMemo(() => [
    { id: "me", lat: here.lat, lng: here.lng, label: "You", kind: "me" },
    ...drivers.map((d) => ({ id: d.driver_id, lat: d.lat, lng: d.lng, label: `${d.full_name} · ${km(d.distance_m)} · ${rupees(d.fare_paise)}`, kind: "driver" as const })),
  ], [drivers, here]);

  const book = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    const { error } = await supabase.rpc("create_booking", {
      p_car: carId, p_trip: trip, p_hours: hours, p_lat: here.lat, p_lng: here.lng,
      p_pickup_address: pickup.trim(), p_drop_address: drop.trim() || null,
    });
    setBusy(false);
    if (error) setErr(errText(error)); else onBooked();
  };

  const cheapest = drivers.length ? Math.min(...drivers.map((d) => d.fare_paise)) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-3">
        <Map center={here} pins={pins} radiusM={radius} />
        {locErr && <p className="text-xs text-gray-500">{locErr}</p>}
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{drivers.length} drivers within {km(radius)}</h2>
            <span className="text-xs text-gray-500">updates every 15 s</span>
          </div>
          {drivers.length === 0 && <p className="text-sm text-gray-400">No drivers online near you right now. Your request still goes out — the first driver to come online can take it.</p>}
          <ul className="divide-y divide-line">
            {drivers.slice(0, 6).map((d) => (
              <li key={d.driver_id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium">{d.full_name} <span className="text-gray-500">· {d.experience_years} yrs · {d.can_drive.join(" & ")}</span></p>
                  <p className="text-gray-400">{km(d.distance_m)} away · {d.rating ? `★ ${d.rating}` : "New driver"}</p>
                </div>
                <span className="font-semibold text-gold">{rupees(d.fare_paise)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <form onSubmit={book} className="card h-fit space-y-4">
        <h2 className="text-xl font-bold">Book a driver</h2>
        {cars.length === 0 ? <Notice>Add your car below first.</Notice> : (
          <div><label className="label">Car</label>
            <select className="input" value={carId} onChange={(e) => setCarId(e.target.value)}>
              {cars.map((c) => <option key={c.id} value={c.id}>{c.model} · {c.reg_no} ({c.transmission})</option>)}
            </select></div>
        )}
        <div><label className="label">Trip type</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(TRIP_LABEL) as TripType[]).map((t) => (
              <button type="button" key={t} onClick={() => setTrip(t)}
                className={`rounded-xl border px-3 py-2 text-sm ${trip === t ? "border-gold bg-gold/10 text-gold" : "border-line text-gray-300"}`}>{TRIP_LABEL[t]}</button>
            ))}
          </div></div>
        <div><label className="label">Hours: {hours}</label>
          <input type="range" min={1} max={trip === "outstation" ? 72 : 12} value={hours} onChange={(e) => setHours(+e.target.value)} className="w-full accent-[#f5b544]" /></div>
        <div><label className="label">Pickup address</label><input className="input" required minLength={3} value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="House, street, landmark" /></div>
        {trip !== "hourly" && <div><label className="label">Drop address</label><input className="input" value={drop} onChange={(e) => setDrop(e.target.value)} /></div>}
        {cheapest && <p className="text-sm text-gray-400">Estimated fare from <span className="font-semibold text-gold">{rupees(cheapest)}</span></p>}
        <button className="btn-gold w-full" disabled={busy || cars.length === 0}>{busy ? "Requesting…" : "Request driver"}</button>
      </form>
    </div>
  );
}

function ActiveTrip({ booking, here, onChange, setErr }:
  { booking: Booking; here: { lat: number; lng: number }; onChange: () => void; setErr: (s: string | null) => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [driver, setDriver] = useState<{ lat: number; lng: number; driver_name: string; phone: string | null } | null>(null);

  useEffect(() => {
    supabase.from("booking_codes").select("start_code").eq("booking_id", booking.id).single()
      .then(({ data }) => setCode(data?.start_code ?? null));
  }, [booking.id]);

  // Driver's position every 5 seconds while they are on the way or driving.
  useEffect(() => {
    if (booking.status === "requested") { setDriver(null); return; }
    const tick = async () => {
      const { data } = await supabase.rpc("my_driver_location", { p_booking: booking.id });
      if (data?.[0]) setDriver(data[0]);
    };
    tick(); const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [booking.id, booking.status]);

  const cancel = async () => {
    const { error } = await supabase.rpc("cancel_booking", { p_booking: booking.id, p_reason: "Customer cancelled" });
    if (error) setErr(errText(error)); else onChange();
  };

  const pins: Pin[] = [
    { id: "pickup", lat: here.lat, lng: here.lng, label: "Pickup", kind: "pickup" },
    ...(driver?.lat ? [{ id: "driver", lat: driver.lat, lng: driver.lng, label: driver.driver_name, kind: "driver" as const }] : []),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Map center={driver?.lat ? driver : here} pins={pins} />
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${booking.status === "requested" ? "animate-ping bg-gold" : "bg-emerald-400"}`} />
          <h2 className="text-xl font-bold">{STATUS_LABEL[booking.status]}</h2>
        </div>
        <p className="text-sm text-gray-400">{TRIP_LABEL[booking.trip_type]} · {booking.hours} h · {booking.pickup_address}</p>
        <p className="text-3xl font-bold text-gold">{rupees(booking.quoted_paise)}</p>
        {driver && (
          <div className="flex items-center justify-between rounded-xl border border-line p-3">
            <div><p className="font-semibold">{driver.driver_name}</p><p className="text-xs text-gray-400">Your Saarthi</p></div>
            {driver.phone && <a className="btn-ghost px-3 py-1.5 text-sm" href={`tel:${driver.phone}`}><Phone size={14} /> Call</a>}
          </div>
        )}
        {booking.status !== "started" && code && (
          <div className="rounded-xl bg-gold/10 p-4 text-center">
            <p className="label">Start code — tell the driver only when they arrive</p>
            <p className="font-mono text-4xl font-bold tracking-[0.4em] text-gold">{code}</p>
          </div>
        )}
        {booking.status !== "started" && <button onClick={cancel} className="btn-ghost w-full"><X size={16} /> Cancel booking</button>}
      </div>
    </div>
  );
}

function RateCard({ booking, onDone }: { booking: Booking; onDone: () => void }) {
  const rate = async (r: number) => { await supabase.rpc("rate_trip", { p_booking: booking.id, p_rating: r }); onDone(); };
  return (
    <div className="card mb-6 flex flex-wrap items-center justify-between gap-3">
      <p>How was your trip on {new Date(booking.created_at).toLocaleDateString("en-IN")}? <span className="text-gold">{rupees(booking.quoted_paise)}</span></p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((r) => <button key={r} onClick={() => rate(r)} aria-label={`${r} stars`}><Star className="text-gold hover:fill-gold" /></button>)}
      </div>
    </div>
  );
}

function Cars({ cars, onChange }: { cars: Car[]; onChange: () => void }) {
  const [reg, setReg] = useState(""); const [model, setModel] = useState("");
  const [tx, setTx] = useState<"manual" | "automatic">("manual"); const [err, setErr] = useState<string | null>(null);
  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("cars").insert({ owner_id: user!.id, reg_no: reg.replace(/[\s-]/g, "").toUpperCase(), model: model.trim(), transmission: tx });
    if (error) setErr(error.message.includes("check") ? "Enter a valid number like MH13AB1234" : errText(error));
    else { setReg(""); setModel(""); onChange(); }
  };
  return (
    <div className="card">
      <h2 className="mb-3 flex items-center gap-2 font-semibold"><CarIcon size={18} className="text-gold" /> My cars</h2>
      <ul className="mb-4 space-y-2 text-sm">
        {cars.map((c) => <li key={c.id} className="flex justify-between rounded-lg border border-line px-3 py-2"><span>{c.model}</span><span className="font-mono text-gray-400">{c.reg_no} · {c.transmission}</span></li>)}
      </ul>
      <form onSubmit={add} className="grid grid-cols-2 gap-2">
        <input className="input" placeholder="MH13AB1234" required value={reg} onChange={(e) => setReg(e.target.value)} />
        <input className="input" placeholder="Model (e.g. Creta)" required value={model} onChange={(e) => setModel(e.target.value)} />
        <select className="input" value={tx} onChange={(e) => setTx(e.target.value as "manual" | "automatic")}><option value="manual">Manual</option><option value="automatic">Automatic</option></select>
        <button className="btn-gold">Add car</button>
        {err && <div className="col-span-2"><Notice>{err}</Notice></div>}
      </form>
    </div>
  );
}

function History({ bookings }: { bookings: Booking[] }) {
  const past = bookings.filter((b) => !ACTIVE.includes(b.status));
  return (
    <div className="card">
      <h2 className="mb-3 font-semibold">Past trips</h2>
      {past.length === 0 && <p className="text-sm text-gray-400">No trips yet.</p>}
      <ul className="divide-y divide-line text-sm">
        {past.map((b) => (
          <li key={b.id} className="flex justify-between py-2">
            <span>{new Date(b.created_at).toLocaleDateString("en-IN")} · {TRIP_LABEL[b.trip_type]}</span>
            <span className={b.status === "completed" ? "text-gold" : "text-gray-500"}>{b.status === "completed" ? rupees(b.quoted_paise) : "Cancelled"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
