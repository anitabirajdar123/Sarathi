"use client";
import { useEffect, useState } from "react";
import { Tag } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errText, rupees } from "@/lib/format";
import { Badge } from "@/components/ui/Stat";
import { Notice } from "@/components/Shell";

interface Promo { code: string; pct_off: number; max_off_paise: number; min_fare_paise: number; uses_per_user: number; valid_until: string | null; active: boolean }
const blank = { code: "", pct: 20, max: 100, min: 150, uses: 1, until: "", active: true };

export function Promos() {
  const [list, setList] = useState<Promo[]>([]);
  const [f, setF] = useState(blank);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const load = async () => { const { data } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false }); setList((data ?? []) as Promo[]); };
  useEffect(() => { load(); }, []);

  const save = async (p: typeof blank) => {
    setMsg(null);
    const { error } = await supabase.rpc("admin_upsert_promo", {
      p_code: p.code, p_pct: p.pct, p_max_paise: Math.round(p.max * 100), p_min_paise: Math.round(p.min * 100),
      p_uses: p.uses, p_valid_until: p.until || null, p_active: p.active,
    });
    setMsg(error ? { ok: false, t: errText(error).includes("check") ? "Code must be 3–15 capital letters or numbers." : errText(error) } : { ok: true, t: `${p.code.toUpperCase()} saved.` });
    if (!error) setF(blank);
    load();
  };
  const toggle = (p: Promo) => save({ code: p.code, pct: p.pct_off, max: p.max_off_paise / 100, min: p.min_fare_paise / 100, uses: p.uses_per_user, until: p.valid_until ?? "", active: !p.active });

  return (
    <div className="card space-y-4">
      <h3 className="flex items-center gap-2 text-lg font-semibold"><Tag size={18} className="text-brand" /> Promo codes</h3>
      <form onSubmit={(e) => { e.preventDefault(); save(f); }} className="grid gap-2 sm:grid-cols-7">
        <input className="input font-mono uppercase sm:col-span-2" placeholder="CODE" required value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
        <label className="relative"><input className="input pr-7" type="number" min={1} max={100} value={f.pct} onChange={(e) => setF({ ...f, pct: +e.target.value })} title="% off" /><span className="absolute right-3 top-2.5 text-gray-500">%</span></label>
        <label className="relative"><span className="absolute left-3 top-2.5 text-gray-500">₹</span><input className="input pl-7" type="number" min={1} value={f.max} onChange={(e) => setF({ ...f, max: +e.target.value })} title="Max off" /></label>
        <label className="relative"><span className="absolute left-3 top-2.5 text-gray-500">≥₹</span><input className="input pl-9" type="number" min={0} value={f.min} onChange={(e) => setF({ ...f, min: +e.target.value })} title="Minimum fare" /></label>
        <input className="input" type="date" value={f.until} onChange={(e) => setF({ ...f, until: e.target.value })} title="Valid until (optional)" />
        <button className="btn-brand">Save</button>
      </form>
      <p className="text-xs text-gray-500">% off · max discount · minimum fare · last date (optional). Each customer can use a code {f.uses} time(s).</p>
      {msg && <Notice kind={msg.ok ? "ok" : "error"}>{msg.t}</Notice>}
      <ul className="divide-y divide-line text-sm">
        {list.map((p) => (
          <li key={p.code} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <span><b className="font-mono">{p.code}</b> <span className="text-gray-400">· {p.pct_off}% off up to {rupees(p.max_off_paise)} · min {rupees(p.min_fare_paise)} · {p.uses_per_user}× per customer{p.valid_until ? ` · till ${new Date(p.valid_until).toLocaleDateString("en-IN")}` : ""}</span></span>
            <span className="flex items-center gap-2"><Badge tone={p.active ? "green" : "gray"}>{p.active ? "active" : "off"}</Badge><button className="btn-ghost px-2 py-1 text-xs" onClick={() => toggle(p)}>{p.active ? "Turn off" : "Turn on"}</button></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
