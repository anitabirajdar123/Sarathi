"use client";
import { useCallback, useEffect, useState } from "react";
import { IndianRupee, Landmark, Wallet, Route, XCircle, Users, Star, Radio, HandCoins } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { rupees } from "@/lib/format";
import { TRIP_LABEL, type TripType } from "@/lib/types";
import { Stat } from "@/components/ui/Stat";
import { RevenueChart, Donut, DONUT_COLORS } from "@/components/ui/Charts";

export interface Dashboard {
  gross: number; platform: number; drivers: number; completed: number; cancelled: number; requests: number;
  avg_fare: number; avg_rating: number | null; customers: number; online_now: number; approved: number; pending: number;
  owed_by_drivers: number; daily: { day: string; gross: number; platform: number; trips: number }[];
  by_type: { trip_type: TripType; trips: number; gross: number }[];
  top_drivers: { full_name: string; trips: number; earned: number; commission: number }[];
}

const RANGES = [{ d: 1, l: "Today" }, { d: 7, l: "7 days" }, { d: 30, l: "30 days" }, { d: 0, l: "All time" }];

interface Extras { discounts: number; wallet_used: number; net: number; promo_trips: number; scheduled: number; monthly_active: number; monthly_value: number; wallet_outstanding: number }

export function Overview({ onError }: { onError: (s: string) => void }) {
  const [days, setDays] = useState(30);
  const [d, setD] = useState<Dashboard | null>(null);
  const [x, setX] = useState<Extras | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_dashboard", { p_days: days });
    if (error) onError(error.message.includes("admin_dashboard") ? "Run supabase/migrations/0002_money_and_dashboards.sql in Supabase first." : error.message);
    else setD(data as Dashboard);
    const ex = await supabase.rpc("admin_money_extras", { p_days: days });
    if (ex.data) setX(ex.data as Extras);
  }, [days, onError]);

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);

  if (!d) return <div className="grid gap-4 sm:grid-cols-4">{[...Array(8)].map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}</div>;

  const cancelRate = d.requests ? Math.round((d.cancelled / d.requests) * 100) : 0;
  const share = d.gross ? Math.round((d.platform / d.gross) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-400">Money from completed trips · refreshes every 30 s</p>
        <div className="flex gap-1 rounded-xl border border-line p-1">
          {RANGES.map((r) => (
            <button key={r.d} onClick={() => setDays(r.d)} className={`rounded-lg px-3 py-1.5 text-sm ${days === r.d ? "bg-white/10 text-white" : "text-gray-400"}`}>{r.l}</button>
          ))}
        </div>
      </div>

      <div className="card">
        <p className="label">Where the money goes</p>
        <div className="mt-3 flex flex-wrap items-end gap-6">
          <div><p className="text-xs text-gray-500">Customers paid</p><p className="text-3xl font-bold">{rupees(d.gross)}</p></div>
          <span className="pb-2 text-gray-600">=</span>
          <div><p className="text-xs text-gray-500">Drivers keep</p><p className="text-3xl font-bold text-brand">{rupees(d.drivers)}</p></div>
          <span className="pb-2 text-gray-600">+</span>
          <div><p className="text-xs text-gray-500">Saarthi earns ({share}%)</p><p className="text-3xl font-bold text-emerald-400">{rupees(d.platform)}</p></div>
        </div>
        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-white/5">
          <div className="bg-brand" style={{ width: `${d.gross ? 100 - share : 0}%` }} />
          <div className="bg-emerald-500" style={{ width: `${share}%` }} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Landmark} label="Saarthi revenue" value={rupees(d.platform)} tone="green" hint="commission on completed trips" />
        <Stat icon={HandCoins} label="Drivers owe Saarthi" value={rupees(d.owed_by_drivers)} tone={d.owed_by_drivers > 0 ? "red" : "default"} hint="commission on cash trips, not paid in yet" />
        <Stat icon={Wallet} label="Drivers' earnings" value={rupees(d.drivers)} tone="brand" hint="drivers' share of fares" />
        <Stat icon={IndianRupee} label="Average fare" value={rupees(d.avg_fare)} />
        <Stat icon={Route} label="Completed trips" value={d.completed} hint={`${d.requests} requests`} />
        <Stat icon={XCircle} label="Cancelled" value={d.cancelled} tone={cancelRate > 20 ? "red" : "default"} hint={`${cancelRate}% of requests`} />
        <Stat icon={Radio} label="Drivers online now" value={`${d.online_now} / ${d.approved}`} hint={`${d.pending} waiting approval`} />
        <Stat icon={Users} label="Customers" value={d.customers} hint={d.avg_rating ? <span className="flex items-center gap-1"><Star size={11} /> {d.avg_rating} average rating</span> : "no ratings yet"} />
      </div>

      {x && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Landmark} label="Net revenue" value={rupees(x.net)} tone={x.net >= 0 ? "green" : "red"} hint="commission − promos − wallet used" />
          <Stat icon={IndianRupee} label="Promo discounts" value={rupees(x.discounts)} hint={`${x.promo_trips} trips used a code`} />
          <Stat icon={Route} label="Scheduled ahead" value={x.scheduled} hint="upcoming booked trips" />
          <Stat icon={Wallet} label="Monthly plans" value={x.monthly_active} hint={`${rupees(x.monthly_value)} a month · wallets hold ${rupees(Math.max(x.wallet_outstanding, 0))}`} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="card">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Revenue by day</h3>
            <div className="flex gap-3 text-xs text-gray-400"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-brand" /> Total fares</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-500" /> Saarthi share</span></div>
          </div>
          <RevenueChart data={d.daily} />
        </div>
        <div className="card">
          <h3 className="font-semibold">Trips by type</h3>
          <Donut data={d.by_type.map((t) => ({ name: TRIP_LABEL[t.trip_type], value: t.trips }))} />
          <ul className="space-y-1 text-sm">
            {d.by_type.map((t, i) => (
              <li key={t.trip_type} className="flex justify-between"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ background: DONUT_COLORS[i] }} />{TRIP_LABEL[t.trip_type]}</span><span className="text-gray-400">{t.trips} · {rupees(t.gross)}</span></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <h3 className="mb-3 font-semibold">Top drivers</h3>
        {d.top_drivers.length === 0 ? <p className="text-sm text-gray-500">No completed trips in this period.</p> : (
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-xs uppercase text-gray-500"><tr><th className="py-2">#</th><th>Driver</th><th>Trips</th><th>Driver earned</th><th>Saarthi got</th></tr></thead>
            <tbody className="divide-y divide-line">
              {d.top_drivers.map((t, i) => (
                <tr key={t.full_name + i}><td className="py-2.5 text-gray-500">{i + 1}</td><td className="font-medium">{t.full_name}</td><td>{t.trips}</td><td className="text-brand">{rupees(t.earned)}</td><td className="text-emerald-400">{rupees(t.commission)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
