"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, Ban, Users, Route, IndianRupee, Activity } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { errText, rupees } from "@/lib/format";
import { STATUS_LABEL, TRIP_LABEL, type Booking } from "@/lib/types";
import { Shell, Notice } from "@/components/Shell";

interface AdminDriver {
  id: string; full_name: string; phone: string | null; licence_no: string; experience_years: number;
  city: string; status: "pending" | "approved" | "blocked"; is_online: boolean; trips: number; created_at: string;
}

export default function AdminPage() {
  const { profile, loading, signOut } = useSession("admin");
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [trips, setTrips] = useState<Booking[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (profile?.role !== "admin") return;
    const [d, t] = await Promise.all([
      supabase.rpc("admin_drivers"),
      supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setDrivers((d.data ?? []) as AdminDriver[]);
    setTrips((t.data ?? []) as Booking[]);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: string, status: AdminDriver["status"]) => {
    const { error } = await supabase.rpc("admin_set_driver_status", { p_driver: id, p_status: status });
    if (error) setErr(errText(error)); else load();
  };

  if (loading || profile?.role !== "admin") return <Shell title="Admin"><div className="card h-40 animate-pulse" /></Shell>;

  const completed = trips.filter((t) => t.status === "completed");
  const revenue = completed.reduce((s, t) => s + t.quoted_paise, 0);
  const stats = [
    { icon: Users, label: "Drivers online", value: `${drivers.filter((d) => d.is_online).length} / ${drivers.filter((d) => d.status === "approved").length}` },
    { icon: Activity, label: "Waiting approval", value: drivers.filter((d) => d.status === "pending").length },
    { icon: Route, label: "Trips (last 50)", value: completed.length },
    { icon: IndianRupee, label: "Platform fee (15%)", value: rupees(revenue * 0.15) },
  ];

  return (
    <Shell title="Admin" onSignOut={signOut}>
      {err && <div className="mb-4"><Notice>{err}</Notice></div>}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="card"><Icon size={18} className="text-gold" /><p className="label mt-2">{label}</p><p className="text-2xl font-bold">{value}</p></div>
        ))}
      </div>

      <div className="card mb-6 overflow-x-auto">
        <h2 className="mb-3 font-semibold">Drivers</h2>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase text-gray-500"><tr><th className="py-2">Name</th><th>Mobile</th><th>Licence</th><th>Exp</th><th>City</th><th>Trips</th><th>Status</th><th /></tr></thead>
          <tbody className="divide-y divide-line">
            {drivers.map((d) => (
              <tr key={d.id}>
                <td className="py-2.5">{d.full_name} {d.is_online && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />}</td>
                <td>{d.phone}</td><td className="font-mono">{d.licence_no}</td><td>{d.experience_years} y</td><td>{d.city}</td><td>{d.trips}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-xs ${d.status === "approved" ? "bg-emerald-500/15 text-emerald-300" : d.status === "pending" ? "bg-gold/15 text-gold" : "bg-red-500/15 text-red-300"}`}>{d.status}</span></td>
                <td className="space-x-2 text-right">
                  {d.status !== "approved" && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setStatus(d.id, "approved")}><Check size={14} /> Approve</button>}
                  {d.status !== "blocked" && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setStatus(d.id, "blocked")}><Ban size={14} /> Block</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {drivers.length === 0 && <p className="py-4 text-sm text-gray-400">No drivers yet.</p>}
      </div>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">Recent trips</h2>
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="text-xs uppercase text-gray-500"><tr><th className="py-2">When</th><th>Type</th><th>Pickup</th><th>Fare</th><th>Status</th></tr></thead>
          <tbody className="divide-y divide-line">
            {trips.map((t) => (
              <tr key={t.id}>
                <td className="py-2.5">{new Date(t.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</td>
                <td>{TRIP_LABEL[t.trip_type]} · {t.hours} h</td><td className="max-w-[220px] truncate">{t.pickup_address}</td>
                <td>{rupees(t.quoted_paise)}</td><td>{STATUS_LABEL[t.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
