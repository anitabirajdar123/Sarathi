"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DEFAULT_POS, rupees } from "@/lib/format";
import { Map } from "@/components/Map";
import type { Pin } from "@/components/MapView";

interface LiveData {
  drivers: { id: string; name: string; lat: number; lng: number; busy: boolean }[];
  requests: { id: string; lat: number; lng: number; address: string; fare: number; waiting_s: number }[];
  running: number; on_way: number;
}

export function Live() {
  const [d, setD] = useState<LiveData | null>(null);
  useEffect(() => {
    const tick = async () => { const { data } = await supabase.rpc("admin_live"); if (data) setD(data as LiveData); };
    tick(); const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  const pins: Pin[] = [
    ...(d?.drivers ?? []).map((x): Pin => ({ id: x.id, lat: x.lat, lng: x.lng, label: `${x.name} · ${x.busy ? "on a trip" : "free"}`, kind: x.busy ? "busy" : "driver" })),
    ...(d?.requests ?? []).map((r): Pin => ({ id: r.id, lat: r.lat, lng: r.lng, label: `Waiting ${Math.round(r.waiting_s / 60)} min · ${rupees(r.fare)}`, kind: "pickup" })),
  ];
  const centre = pins[0] ?? DEFAULT_POS;
  const free = d?.drivers.filter((x) => !x.busy).length ?? 0;
  const tiles: [string, number, string][] = [
    ["Free drivers", free, "text-gold"],
    ["On a trip", (d?.drivers.length ?? 0) - free, "text-blue-400"],
    ["Customers waiting", d?.requests.length ?? 0, "text-emerald-400"],
    ["Driver on the way", d?.on_way ?? 0, "text-gray-200"],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <Map center={centre} pins={pins} height={520} />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {tiles.map(([l, v, c]) => <div key={l} className="card p-4"><p className="label">{l}</p><p className={`text-2xl font-bold ${c}`}>{v}</p></div>)}
        </div>
        <div className="card">
          <h3 className="mb-2 font-semibold">Waiting for a driver</h3>
          {!d?.requests.length && <p className="text-sm text-gray-500">No one is waiting.</p>}
          <ul className="space-y-2 text-sm">
            {d?.requests.map((r) => (
              <li key={r.id} className="rounded-lg border border-line p-2.5">
                <div className="flex justify-between gap-2"><span className="truncate">{r.address}</span><span className="text-gold">{rupees(r.fare)}</span></div>
                <p className={`text-xs ${r.waiting_s > 300 ? "text-red-400" : "text-gray-500"}`}>waiting {Math.floor(r.waiting_s / 60)} min {r.waiting_s % 60} s</p>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-gray-500">🚗 free driver · 🚙 on a trip · 📍 customer waiting · refreshes every 10 s</p>
      </div>
    </div>
  );
}
