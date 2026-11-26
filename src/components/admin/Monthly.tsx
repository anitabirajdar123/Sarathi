"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { errText, rupees } from "@/lib/format";
import { MONTHLY_LABEL, type MonthlyPlan } from "@/lib/types";
import { Badge } from "@/components/ui/Stat";
import { Notice } from "@/components/Shell";
import type { AdminDriver } from "./Drivers";

const tone = { requested: "brand", assigned: "blue", active: "green", cancelled: "gray", ended: "gray" } as const;

export function MonthlyAdmin({ drivers }: { drivers: AdminDriver[] }) {
  const [plans, setPlans] = useState<MonthlyPlan[]>([]);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("monthly_plans_view");
    setPlans((data ?? []) as MonthlyPlan[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const approved = drivers.filter((d) => d.status === "approved");
  const assign = async (id: string) => {
    const { error } = await supabase.rpc("admin_assign_monthly", { p_id: id, p_driver: pick[id] });
    setMsg(error ? { ok: false, t: errText(error) } : { ok: true, t: "Offered to the driver. They accept it in their app." });
    load();
  };
  const list = plans.filter((p) => filter === "all" || ["requested", "assigned", "active"].includes(p.status));
  const monthly = plans.filter((p) => p.status === "active").reduce((s, p) => s + p.monthly_paise, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><p className="label">Waiting for a driver</p><p className="text-2xl font-bold text-brand">{plans.filter((p) => p.status === "requested").length}</p></div>
        <div className="card p-4"><p className="label">Active plans</p><p className="text-2xl font-bold text-emerald-400">{plans.filter((p) => p.status === "active").length}</p></div>
        <div className="card p-4"><p className="label">Monthly value</p><p className="text-2xl font-bold text-gradient">{rupees(monthly)}</p></div>
      </div>
      {msg && <Notice kind={msg.ok ? "ok" : "error"}>{msg.t}</Notice>}
      <div className="flex gap-1">
        {(["open", "all"] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-sm ${filter === f ? "bg-white/10" : "text-gray-400"}`}>{f === "open" ? "Open & active" : "All"}</button>)}
      </div>
      {list.length === 0 && <p className="card text-sm text-gray-500">No monthly plans yet.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((p) => (
          <div key={p.id} className="card space-y-2 text-sm">
            <div className="flex items-center justify-between"><p className="font-semibold">{p.customer_name} <span className="font-normal text-gray-400">· {p.customer_phone}</span></p><Badge tone={tone[p.status]}>{MONTHLY_LABEL[p.status]}</Badge></div>
            <p className="text-gray-400">{p.car} · from {new Date(p.start_date).toLocaleDateString("en-IN")} · {p.shift_start.slice(0, 5)}</p>
            <p className="text-gray-400">{p.daily_hours} h × {p.days_per_week} days · {p.pickup_address}</p>
            {p.notes && <p className="text-gray-500">“{p.notes}”</p>}
            <p className="text-lg font-bold text-gradient">{rupees(p.monthly_paise)} / month</p>
            {p.driver_name && <p>Driver: <b>{p.driver_name}</b> {p.driver_phone && <span className="text-gray-400">· {p.driver_phone}</span>}</p>}
            {(p.status === "requested" || p.status === "assigned") && (
              <div className="flex gap-2">
                <select className="input" value={pick[p.id] ?? ""} onChange={(e) => setPick({ ...pick, [p.id]: e.target.value })}>
                  <option value="">Choose a driver…</option>
                  {approved.map((d) => <option key={d.id} value={d.id}>{d.full_name} · {d.city} · {d.experience_years} y{d.verified ? " · verified" : ""}</option>)}
                </select>
                <button className="btn-brand" disabled={!pick[p.id]} onClick={() => assign(p.id)}>{p.status === "assigned" ? "Re-offer" : "Offer"}</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
