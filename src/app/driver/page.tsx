"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Power, Wallet, Navigation } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLocation, useSession } from "@/lib/useSession";
import { DEFAULT_POS, errText, rupees } from "@/lib/format";
import { STATUS_LABEL, TRIP_LABEL, type Booking } from "@/lib/types";
import { Shell, Notice } from "@/components/Shell";
import { Tabs } from "@/components/ui/Stat";
import { DriverEarnings } from "@/components/DriverEarnings";
import { Map } from "@/components/Map";

interface DriverRow { status: "pending" | "approved" | "blocked"; is_online: boolean; rating_sum: number; rating_count: number }

export default function DriverPage() {
  const { profile, loading, signOut } = useSession();
  const [me, setMe] = useState<DriverRow | null | undefined>(undefined);
  const [open, setOpen] = useState<Booking[]>([]);
  const [mine, setMine] = useState<Booking[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"drive" | "earnings">("drive");
  const online = me?.is_online ?? false;
  const { pos } = useLocation(online);
  const here = pos ?? DEFAULT_POS;

  const load = useCallback(async () => {
    if (!profile) return;
    const { data: d } = await supabase.from("drivers").select("status, is_online, rating_sum, rating_count").eq("id", profile.id).maybeSingle();
    setMe(d as DriverRow | null);
    const [o, m] = await Promise.all([
      supabase.from("bookings").select("*").eq("status", "requested").order("created_at").limit(20),
      supabase.from("bookings").select("*").eq("driver_id", profile.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setOpen((o.data ?? []) as Booking[]);
    setMine((m.data ?? []) as Booking[]);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  // Live: new requests and changes appear instantly.
  useEffect(() => {
    if (!profile) return;
    const ch = supabase.channel("driver-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile, load]);

  // While online, send location every 15 seconds.
  const posRef = useRef(here); posRef.current = here;
  useEffect(() => {
    if (!online) return;
    const send = () => supabase.rpc("driver_ping", { p_online: true, p_lat: posRef.current.lat, p_lng: posRef.current.lng });
    send(); const id = setInterval(send, 15000);
    return () => clearInterval(id);
  }, [online]);

  const toggle = async () => {
    setErr(null);
    const { error } = await supabase.rpc("driver_ping", { p_online: !online, p_lat: here.lat, p_lng: here.lng });
    if (error) setErr(errText(error)); else load();
  };

  const act = async (fn: string, args: Record<string, unknown>) => {
    setErr(null);
    const { error } = await supabase.rpc(fn, args);
    if (error) setErr(errText(error)); else load();
  };

  if (loading || me === undefined) return <Shell title="Driver"><div className="card h-40 animate-pulse" /></Shell>;
  if (me === null) return <Shell title="Driver" onSignOut={signOut}><Register onDone={load} /></Shell>;

  const current = mine.find((b) => b.status === "accepted" || b.status === "started");
  const done = mine.filter((b) => b.status === "completed");
  const today = done.filter((b) => new Date(b.completed_at!).toDateString() === new Date().toDateString());
  // The server saves the driver's share on each completed trip.
  const earn = (list: Booking[]) => list.reduce((s, b) => s + ((b as Booking & { driver_earning_paise?: number | null }).driver_earning_paise ?? Math.round(b.quoted_paise * 0.85)), 0);

  return (
    <Shell title="Driver" onSignOut={signOut}>
      <Tabs<"drive" | "earnings"> value={tab} onChange={setTab} tabs={[{ id: "drive", label: "Drive" }, { id: "earnings", label: "Earnings & account" }]} />
      {tab === "earnings" && <DriverEarnings />}
      {tab === "drive" && (<>
      {me.status !== "approved" && (
        <div className="card mb-6 border-gold/40">
          <p className="font-semibold text-gold">{me.status === "pending" ? "Your documents are being checked" : "Your account is blocked"}</p>
          <p className="text-sm text-gray-400">{me.status === "pending" ? "You can go online once the Saarthi team approves you." : "Contact support."}</p>
        </div>
      )}
      {err && <div className="mb-4"><Notice>{err}</Notice></div>}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <button onClick={toggle} disabled={me.status !== "approved"}
          className={`card flex items-center justify-between text-left transition ${online ? "border-emerald-500/50" : ""}`}>
          <div><p className="label">Status</p><p className={`text-2xl font-bold ${online ? "text-emerald-400" : "text-gray-400"}`}>{online ? "Online" : "Offline"}</p></div>
          <Power className={online ? "text-emerald-400" : "text-gray-500"} />
        </button>
        <div className="card"><p className="label">Today</p><p className="text-2xl font-bold">{rupees(earn(today))}</p><p className="text-xs text-gray-500">{today.length} trips</p></div>
        <div className="card"><p className="label flex items-center gap-1"><Wallet size={12} /> Total earned</p><p className="text-2xl font-bold">{rupees(earn(done))}</p>
          <p className="text-xs text-gray-500">{me.rating_count ? `★ ${(me.rating_sum / me.rating_count).toFixed(1)} from ${me.rating_count}` : "No ratings yet"}</p></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Map center={here} pins={[{ id: "me", lat: here.lat, lng: here.lng, label: "You", kind: "me" }]} radiusM={online ? 5000 : undefined} />
        <div className="space-y-4">
          {current ? <CurrentTrip b={current} act={act} /> : (
            <div className="card">
              <h2 className="mb-3 font-semibold">New requests {online && <span className="ml-1 inline-block h-2 w-2 animate-ping rounded-full bg-emerald-400" />}</h2>
              {!online && <p className="text-sm text-gray-400">Go online to see requests.</p>}
              {online && open.length === 0 && <p className="text-sm text-gray-400">Waiting for requests near you…</p>}
              <ul className="space-y-3">
                {online && open.map((b) => (
                  <li key={b.id} className="rounded-xl border border-line p-3">
                    <div className="flex justify-between"><span className="font-semibold">{TRIP_LABEL[b.trip_type]} · {b.hours} h</span><span className="font-bold text-gold">{rupees(b.quoted_paise)}</span></div>
                    <p className="mt-1 text-sm text-gray-400">{b.pickup_address}</p>
                    <button className="btn-gold mt-3 w-full" onClick={() => act("accept_booking", { p_booking: b.id })}>Accept</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      </>)}
    </Shell>
  );
}

function CurrentTrip({ b, act }: { b: Booking; act: (fn: string, a: Record<string, unknown>) => void }) {
  const [code, setCode] = useState("");
  return (
    <div className="card space-y-3">
      <p className="label">Current trip</p>
      <h2 className="text-xl font-bold">{STATUS_LABEL[b.status]}</h2>
      <p className="text-sm text-gray-400">{TRIP_LABEL[b.trip_type]} · {b.hours} h</p>
      <p className="flex items-start gap-2 text-sm"><Navigation size={16} className="mt-0.5 text-gold" /> {b.pickup_address}</p>
      <p className="text-3xl font-bold text-gold">{rupees(b.quoted_paise)}</p>
      {b.status === "accepted" ? (
        <>
          <label className="label" htmlFor="code">Customer&apos;s 4-digit start code</label>
          <input id="code" className="input text-center font-mono text-2xl tracking-[0.5em]" maxLength={4} inputMode="numeric"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <button className="btn-gold w-full" disabled={code.length !== 4} onClick={() => act("start_trip", { p_booking: b.id, p_code: code })}>Start trip</button>
          <button className="btn-ghost w-full" onClick={() => act("cancel_booking", { p_booking: b.id, p_reason: "Driver cancelled" })}>Cancel</button>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-400">End the trip — how did the customer pay?</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-gold" onClick={() => act("complete_trip", { p_booking: b.id, p_method: "cash" })}>Cash</button>
            <button className="btn-ghost" onClick={() => act("complete_trip", { p_booking: b.id, p_method: "upi" })}>UPI</button>
          </div>
          <p className="text-xs text-gray-500">Cash: you keep the money and owe Saarthi its commission.</p>
        </>
      )}
    </div>
  );
}

function Register({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ name: "", phone: "", licence: "", exp: 2, city: "Solapur", manual: true, auto: false });
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    const can = [f.manual && "manual", f.auto && "automatic"].filter(Boolean);
    if (!can.length) { setErr("Choose at least one car type"); return; }
    const { error } = await supabase.rpc("driver_register", {
      p_name: f.name.trim(), p_phone: f.phone, p_licence: f.licence.trim(), p_experience: f.exp, p_can_drive: can, p_city: f.city,
    });
    if (error) setErr(errText(error)); else onDone();
  };
  return (
    <form onSubmit={submit} className="card mx-auto max-w-md space-y-4">
      <h2 className="text-xl font-bold">Become a Saarthi driver</h2>
      <div><label className="label">Full name</label><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div><label className="label">Mobile</label><input className="input" required pattern="[6-9][0-9]{9}" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} /></div>
      <div><label className="label">Driving licence number</label><input className="input" required minLength={5} value={f.licence} onChange={(e) => setF({ ...f, licence: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Experience (years)</label><input className="input" type="number" min={0} max={50} value={f.exp} onChange={(e) => setF({ ...f, exp: +e.target.value })} /></div>
        <div><label className="label">City</label><select className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })}>{["Solapur", "Pune", "Mumbai"].map((c) => <option key={c}>{c}</option>)}</select></div>
      </div>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.manual} onChange={(e) => setF({ ...f, manual: e.target.checked })} /> Manual</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.auto} onChange={(e) => setF({ ...f, auto: e.target.checked })} /> Automatic</label>
      </div>
      {err && <Notice>{err}</Notice>}
      <button className="btn-gold w-full">Submit for approval</button>
    </form>
  );
}
