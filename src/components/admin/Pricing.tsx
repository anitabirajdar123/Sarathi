"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { errText, rupees } from "@/lib/format";
import { TRIP_LABEL, type TripType } from "@/lib/types";
import { Notice } from "@/components/Shell";

interface Rule {
  trip_type: TripType; base_paise: number; base_hours: number; extra_hour_paise: number;
  night_surcharge_pct: number; pickup_per_km_paise: number; platform_fee_pct: number;
}

export function Pricing() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const load = async () => {
    const { data } = await supabase.from("fare_rules").select("*");
    const order: TripType[] = ["hourly", "one_way", "round_trip", "outstation"];
    setRules(((data ?? []) as Rule[]).sort((a, b) => order.indexOf(a.trip_type) - order.indexOf(b.trip_type)));
  };
  useEffect(() => { load(); }, []);

  const edit = (t: TripType, k: keyof Rule, v: number) => setRules((rs) => rs.map((r) => r.trip_type === t ? { ...r, [k]: v } : r));

  const save = async (r: Rule) => {
    setMsg(null);
    const { error } = await supabase.rpc("admin_update_fare", {
      p_trip: r.trip_type, p_base_paise: r.base_paise, p_base_hours: r.base_hours, p_extra_hour_paise: r.extra_hour_paise,
      p_night_pct: r.night_surcharge_pct, p_pickup_km_paise: r.pickup_per_km_paise, p_platform_pct: r.platform_fee_pct,
    });
    setMsg(error ? { ok: false, t: errText(error) } : { ok: true, t: `${TRIP_LABEL[r.trip_type]} prices saved. New bookings use them now.` });
    load();
  };

  const money = (r: Rule, k: keyof Rule, label: string) => (
    <label className="block"><span className="label">{label}</span>
      <div className="relative"><span className="absolute left-3 top-2.5 text-gray-500">₹</span>
        <input className="input pl-7" type="number" min={0} value={Number(r[k]) / 100} onChange={(e) => edit(r.trip_type, k, Math.round(Number(e.target.value) * 100))} /></div>
    </label>
  );
  const num = (r: Rule, k: keyof Rule, label: string, suffix: string, max: number) => (
    <label className="block"><span className="label">{label}</span>
      <div className="relative"><input className="input pr-10" type="number" min={k === "base_hours" ? 1 : 0} max={max} value={Number(r[k])} onChange={(e) => edit(r.trip_type, k, Number(e.target.value))} />
        <span className="absolute right-3 top-2.5 text-gray-500">{suffix}</span></div>
    </label>
  );

  return (
    <div className="space-y-4">
      {msg && <Notice kind={msg.ok ? "ok" : "error"}>{msg.t}</Notice>}
      <div className="grid gap-4 lg:grid-cols-2">
        {rules.map((r) => {
          const sample = r.base_paise + 2 * r.extra_hour_paise;
          const fee = Math.round(sample * r.platform_fee_pct / 100);
          return (
            <div key={r.trip_type} className="card space-y-4">
              <h3 className="text-lg font-semibold">{TRIP_LABEL[r.trip_type]}</h3>
              <div className="grid grid-cols-2 gap-3">
                {money(r, "base_paise", "Base fare")}
                {num(r, "base_hours", "Hours included", "h", 24)}
                {money(r, "extra_hour_paise", "Each extra hour")}
                {money(r, "pickup_per_km_paise", "Pickup per km (after 2 km)")}
                {num(r, "night_surcharge_pct", "Night extra (10pm–6am)", "%", 100)}
                {num(r, "platform_fee_pct", "Saarthi commission", "%", 50)}
              </div>
              <p className="rounded-xl bg-white/5 p-3 text-sm text-gray-400">
                Example: {r.base_hours + 2} hours = <b className="text-white">{rupees(sample)}</b> → driver keeps <b className="text-gold">{rupees(sample - fee)}</b>, Saarthi gets <b className="text-emerald-400">{rupees(fee)}</b>
              </p>
              <button className="btn-gold w-full" onClick={() => save(r)}>Save {TRIP_LABEL[r.trip_type]}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
