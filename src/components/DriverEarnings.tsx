"use client";
import { useEffect, useState } from "react";
import { Wallet, CalendarDays, CalendarRange, Clock, Star, HandCoins, Route, Percent } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { rupees } from "@/lib/format";
import { Stat } from "@/components/ui/Stat";
import { EarningsBars } from "@/components/ui/Charts";

interface Dash {
  today: number; today_trips: number; week: number; month: number; total: number; trips: number; hours: number;
  commission: number; owes: number; acceptance: number | null; stars: Record<string, number>;
  daily: { day: string; earned: number; trips: number }[];
  ledger: { kind: string; amount_paise: number; method: string | null; note: string | null; created_at: string }[];
}

export function DriverEarnings() {
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    supabase.rpc("driver_dashboard").then(({ data, error }) => {
      if (error) setErr("Ask the admin to run the 0002 database update."); else setD(data as Dash);
    });
  }, []);

  if (err) return <p className="card text-sm text-red-300">{err}</p>;
  if (!d) return <div className="grid gap-4 sm:grid-cols-4">{[...Array(4)].map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}</div>;

  const perHour = d.hours > 0 ? Math.round(d.total / d.hours) : 0;
  const ratings = Object.values(d.stars).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Wallet} label="Today" value={rupees(d.today)} tone="brand" hint={`${d.today_trips} trips`} />
        <Stat icon={CalendarDays} label="Last 7 days" value={rupees(d.week)} />
        <Stat icon={CalendarRange} label="This month" value={rupees(d.month)} />
        <Stat icon={Clock} label="Per hour driving" value={rupees(perHour)} hint={`${d.hours} hours on trips`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="card"><h3 className="mb-2 font-semibold">Last 14 days</h3><EarningsBars data={d.daily} /></div>
        <div className="card space-y-3">
          <p className="label">How your money works</p>
          <div className="flex justify-between text-sm"><span className="text-gray-400">Customers paid ({d.trips} trips)</span><b>{rupees(d.total + d.commission)}</b></div>
          <div className="flex justify-between text-sm"><span className="text-gray-400">You keep</span><b className="text-brand">{rupees(d.total)}</b></div>
          <div className="flex justify-between text-sm"><span className="text-gray-400">Saarthi commission</span><b className="text-emerald-400">{rupees(d.commission)}</b></div>
          <div className={`rounded-xl p-3 ${d.owes > 0 ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
            <p className="flex items-center gap-2 text-sm font-semibold"><HandCoins size={16} /> {d.owes > 0 ? "To pay Saarthi" : d.owes < 0 ? "Saarthi owes you" : "All settled"}</p>
            <p className={`text-2xl font-bold ${d.owes > 0 ? "text-red-300" : "text-emerald-300"}`}>{rupees(Math.abs(d.owes))}</p>
            <p className="text-xs text-gray-400">Cash trips add Saarthi&apos;s commission; UPI trips and promo discounts add what Saarthi owes you.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Route} label="All trips" value={d.trips} hint={`${rupees(d.total)} earned in total`} />
        <Stat icon={Percent} label="Completion rate" value={d.acceptance != null ? `${d.acceptance}%` : "—"} hint="accepted trips you finished" />
        <div className="card">
          <Star size={18} className="text-brand" /><p className="label mt-3">Ratings</p>
          {ratings === 0 ? <p className="text-sm text-gray-500">No ratings yet</p> : [5, 4, 3, 2, 1].map((s) => (
            <div key={s} className="flex items-center gap-2 text-xs"><span className="w-3">{s}</span>
              <div className="h-1.5 flex-1 rounded-full bg-white/5"><div className="h-full rounded-full bg-brand" style={{ width: `${((d.stars[s] ?? 0) / ratings) * 100}%` }} /></div>
              <span className="w-5 text-right text-gray-500">{d.stars[s] ?? 0}</span></div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="mb-2 font-semibold">My account with Saarthi</h3>
        {d.ledger.length === 0 && <p className="text-sm text-gray-500">Nothing yet.</p>}
        <ul className="divide-y divide-line text-sm">
          {d.ledger.map((l, i) => (
            <li key={i} className="flex justify-between py-2">
              <span>{l.kind === "commission" ? (l.amount_paise > 0 ? "Commission on a cash trip" : "Saarthi owes you for a trip") : l.kind === "settlement" ? (l.amount_paise < 0 ? `You paid Saarthi (${l.method})` : `Saarthi paid you (${l.method})`) : "Adjustment"}
                <span className="block text-xs text-gray-500">{new Date(l.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}{l.note ? ` · ${l.note}` : ""}</span></span>
              <span className={l.amount_paise > 0 ? "text-red-300" : "text-emerald-300"}>{l.amount_paise > 0 ? "+" : "−"}{rupees(Math.abs(l.amount_paise))}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
