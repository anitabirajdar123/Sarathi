"use client";
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errText, rupees } from "@/lib/format";
import { MONTHLY_LABEL, type MonthlyPlan } from "@/lib/types";
import { Badge } from "@/components/ui/Stat";

/** Monthly jobs the admin offered to this driver, and the ones already running. */
export function MonthlyOffers({ myId }: { myId: string }) {
  const [plans, setPlans] = useState<MonthlyPlan[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc("monthly_plans_view");
    setPlans(((data ?? []) as MonthlyPlan[]).filter((p) => p.driver_id === myId && (p.status === "assigned" || p.status === "active")));
  }, [myId]);
  useEffect(() => { load(); }, [load]);

  const answer = async (id: string, accept: boolean) => {
    const { error } = await supabase.rpc("driver_confirm_monthly", { p_id: id, p_accept: accept });
    if (error) setErr(errText(error)); else load();
  };

  if (plans.length === 0) return null;
  return (
    <div className="card mb-6">
      <h2 className="mb-3 flex items-center gap-2 font-semibold"><CalendarClock size={18} className="text-brand" /> Monthly jobs</h2>
      {err && <p className="mb-2 text-sm text-red-300">{err}</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {plans.map((p) => (
          <li key={p.id} className="rounded-xl border border-line p-3 text-sm">
            <div className="flex items-center justify-between"><span className="font-semibold">{p.customer_name}</span><Badge tone={p.status === "active" ? "green" : "blue"}>{MONTHLY_LABEL[p.status]}</Badge></div>
            <p className="mt-1 text-gray-400">{p.car} · from {new Date(p.start_date).toLocaleDateString("en-IN")}</p>
            <p className="text-gray-400">{p.shift_start.slice(0, 5)} · {p.daily_hours} h a day · {p.days_per_week} days a week</p>
            <p className="text-gray-400">{p.pickup_address}{p.notes ? ` · ${p.notes}` : ""}</p>
            <p className="mt-2 text-lg font-bold text-gradient">{rupees(p.monthly_paise)}<span className="text-xs font-normal text-gray-400"> / month</span></p>
            {p.status === "assigned" ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button className="btn-brand py-2 text-sm" onClick={() => answer(p.id, true)}>Accept job</button>
                <button className="btn-ghost py-2 text-sm" onClick={() => answer(p.id, false)}>Decline</button>
              </div>
            ) : p.customer_phone && <a className="btn-ghost mt-2 w-full py-2 text-sm" href={`tel:${p.customer_phone}`}><Phone size={14} /> Call customer</a>}
          </li>
        ))}
      </ul>
    </div>
  );
}
