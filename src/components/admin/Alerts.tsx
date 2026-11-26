"use client";
import { useCallback, useEffect, useState } from "react";
import { Siren, Phone, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errText } from "@/lib/format";

interface Sos {
  id: number; raised_as: "customer" | "driver"; created_at: string; lat: number | null; lng: number | null;
  pickup_address: string; customer: string; customer_phone: string | null; driver: string | null; driver_phone: string | null; car: string;
}
export interface AlertCounts { docs_waiting: number; monthly_waiting: number; sos: number }

/** Red banner on every admin tab while any SOS is open. Checks every 15 seconds. */
export function SosAlerts({ onCounts }: { onCounts: (c: AlertCounts) => void }) {
  const [list, setList] = useState<Sos[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("admin_alerts");
    if (!data) return;
    setList(data.sos as Sos[]);
    onCounts({ docs_waiting: data.docs_waiting, monthly_waiting: data.monthly_waiting, sos: (data.sos as Sos[]).length });
  }, [onCounts]);
  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, [load]);

  const resolve = async (id: number) => {
    const { error } = await supabase.rpc("admin_resolve_sos", { p_id: id, p_note: notes[id] ?? "" });
    if (error) setErr(errText(error)); else { setErr(null); load(); }
  };

  if (!list.length) return null;
  return (
    <div className="mb-6 space-y-3">
      {list.map((s) => (
        <div key={s.id} className="animate-[pulse_2s_ease-in-out_infinite] rounded-2xl border-2 border-red-500 bg-red-500/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-lg font-bold text-red-300"><Siren /> SOS from the {s.raised_as} · {Math.round((Date.now() - +new Date(s.created_at)) / 60000)} min ago</p>
            {s.lat != null && s.lng != null && (
              <a className="btn-ghost px-3 py-1 text-sm" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${s.lat},${s.lng}`}><MapPin size={14} /> Open location</a>
            )}
          </div>
          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
            <p>Customer: <b>{s.customer}</b> {s.customer_phone && <a className="text-brand" href={`tel:${s.customer_phone}`}><Phone size={12} className="inline" /> {s.customer_phone}</a>}</p>
            <p>Driver: <b>{s.driver ?? "—"}</b> {s.driver_phone && <a className="text-brand" href={`tel:${s.driver_phone}`}><Phone size={12} className="inline" /> {s.driver_phone}</a>}</p>
            <p>Car: <b>{s.car}</b> · {s.pickup_address}</p>
          </div>
          <div className="mt-3 flex gap-2">
            <input className="input" placeholder="What was done? (needed to close)" value={notes[s.id] ?? ""} onChange={(e) => setNotes({ ...notes, [s.id]: e.target.value })} />
            <button className="btn bg-red-600 text-white" onClick={() => resolve(s.id)}>Mark handled</button>
          </div>
        </div>
      ))}
      {err && <p className="text-sm text-red-300">{err}</p>}
    </div>
  );
}
