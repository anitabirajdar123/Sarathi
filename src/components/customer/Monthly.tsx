"use client";
import { useState } from "react";
import { CalendarClock, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errText, rupees } from "@/lib/format";
import { MONTHLY_LABEL, monthlyQuote, type Car, type MonthlyPlan } from "@/lib/types";
import { Badge } from "@/components/ui/Stat";
import { Notice } from "@/components/Shell";

const tone = { requested: "brand", assigned: "blue", active: "green", cancelled: "gray", ended: "gray" } as const;

export function MonthlyCard({ cars, plans, reload }: { cars: Car[]; plans: MonthlyPlan[]; reload: () => void }) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ car: "", start: tomorrow, shift: "09:00", hours: 8, days: 6, address: "", notes: "" });
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    const { error } = await supabase.rpc("create_monthly_request", {
      p_car: f.car || cars[0]?.id, p_start: f.start, p_shift: f.shift, p_hours: f.hours, p_days: f.days,
      p_address: f.address.trim(), p_notes: f.notes.trim() || null,
    });
    if (error) setErr(errText(error)); else { setOpen(false); reload(); }
  };
  const cancel = async (id: string) => { await supabase.rpc("cancel_monthly", { p_id: id }); reload(); };
  const live = plans.filter((p) => p.status !== "cancelled" && p.status !== "ended");

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold"><CalendarClock size={18} className="text-brand" /> Monthly driver</h2>
        {!open && cars.length > 0 && <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setOpen(true)}>+ Hire monthly</button>}
      </div>
      <p className="text-sm text-gray-400">A fixed driver every day — office, school runs, daily errands.</p>

      {open && (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-line p-4">
          <select className="input" value={f.car} onChange={(e) => setF({ ...f, car: e.target.value })}>
            {cars.map((c) => <option key={c.id} value={c.id}>{c.model} · {c.reg_no}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <label><span className="label">Start date</span><input className="input" type="date" min={tomorrow} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} required /></label>
            <label><span className="label">Shift starts</span><input className="input" type="time" value={f.shift} onChange={(e) => setF({ ...f, shift: e.target.value })} required /></label>
            <label><span className="label">Hours a day: {f.hours}</span><input type="range" min={4} max={12} value={f.hours} onChange={(e) => setF({ ...f, hours: +e.target.value })} className="w-full accent-[#a78bfa]" /></label>
            <label><span className="label">Days a week</span>
              <select className="input" value={f.days} onChange={(e) => setF({ ...f, days: +e.target.value })}>{[5, 6, 7].map((d) => <option key={d} value={d}>{d} days</option>)}</select></label>
          </div>
          <input className="input" placeholder="Pickup address" required minLength={3} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          <input className="input" placeholder="Notes (optional) e.g. school drop at 8:30" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          <div className="flex items-center justify-between rounded-xl bg-white/5 p-3">
            <span className="text-sm text-gray-400">Monthly price</span>
            <span className="text-xl font-bold text-gradient">{rupees(monthlyQuote(f.hours, f.days))}</span>
          </div>
          {err && <Notice>{err}</Notice>}
          <div className="grid grid-cols-2 gap-2"><button className="btn-brand">Request</button><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Close</button></div>
        </form>
      )}

      {live.length === 0 && !open && <p className="text-sm text-gray-500">No monthly plan yet.</p>}
      <ul className="space-y-2">
        {live.map((p) => (
          <li key={p.id} className="rounded-xl border border-line p-3 text-sm">
            <div className="flex items-center justify-between"><span className="font-medium">{p.car}</span><Badge tone={tone[p.status]}>{MONTHLY_LABEL[p.status]}</Badge></div>
            <p className="mt-1 text-gray-400">From {new Date(p.start_date).toLocaleDateString("en-IN")} · {p.shift_start.slice(0, 5)} · {p.daily_hours} h × {p.days_per_week} days</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-semibold">{rupees(p.monthly_paise)}/month</span>
              {p.status === "active" && p.driver_phone && <a className="btn-ghost px-2 py-1 text-xs" href={`tel:${p.driver_phone}`}><Phone size={12} /> {p.driver_name}</a>}
            </div>
            <button className="mt-2 text-xs text-gray-500 hover:text-red-300" onClick={() => cancel(p.id)}>{p.status === "active" ? "End plan" : "Cancel request"}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
