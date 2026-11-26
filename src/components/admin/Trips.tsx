"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { rupees } from "@/lib/format";
import { STATUS_LABEL, TRIP_LABEL, type Booking, type BookingStatus } from "@/lib/types";
import { Badge } from "@/components/ui/Stat";

type Row = Booking & { platform_fee_paise: number | null; driver_earning_paise: number | null; payment_method: string };
const tone: Record<BookingStatus, "brand" | "blue" | "green" | "gray" | "red"> = {
  requested: "brand", accepted: "blue", started: "blue", completed: "green", cancelled: "red",
};

export function Trips() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<"all" | BookingStatus>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(300);
      setRows((data ?? []) as Row[]);
    };
    load();
    const ch = supabase.channel("admin-trips").on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const list = useMemo(() => rows.filter((r) => (status === "all" || r.status === status) &&
    `${r.pickup_address} ${r.drop_address ?? ""} ${r.id}`.toLowerCase().includes(q.toLowerCase())), [rows, status, q]);
  const sum = (k: "quoted_paise" | "platform_fee_paise" | "driver_earning_paise") =>
    list.filter((r) => r.status === "completed").reduce((s, r) => s + (r[k] ?? 0), 0);

  const exportCsv = () => {
    const head = ["Date", "Type", "Hours", "Pickup", "Status", "Fare", "Driver share", "Saarthi share", "Payment", "Rating"];
    const lines = list.map((r) => [new Date(r.created_at).toLocaleString("en-IN"), TRIP_LABEL[r.trip_type], r.hours, r.pickup_address, STATUS_LABEL[r.status],
      r.quoted_paise / 100, (r.driver_earning_paise ?? 0) / 100, (r.platform_fee_paise ?? 0) / 100, r.payment_method, r.rating ?? ""]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `saarthi-trips-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="absolute left-3 top-3 text-gray-500" />
          <input className="input pl-9" placeholder="Search address" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_LABEL) as BookingStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <button className="btn-ghost" onClick={exportCsv}><Download size={16} /> Excel (CSV)</button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl border border-line p-3"><p className="label">Fares (completed)</p><p className="text-lg font-bold">{rupees(sum("quoted_paise"))}</p></div>
        <div className="rounded-xl border border-line p-3"><p className="label">Drivers&apos; share</p><p className="text-lg font-bold text-brand">{rupees(sum("driver_earning_paise"))}</p></div>
        <div className="rounded-xl border border-line p-3"><p className="label">Saarthi share</p><p className="text-lg font-bold text-emerald-400">{rupees(sum("platform_fee_paise"))}</p></div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-xs uppercase text-gray-500"><tr><th className="py-2">When</th><th>Type</th><th>Pickup</th><th>Status</th><th className="text-right">Fare</th><th className="text-right">Driver</th><th className="text-right">Saarthi</th><th>Pay</th></tr></thead>
          <tbody className="divide-y divide-line">
            {list.map((t) => (
              <tr key={t.id} className="hover:bg-white/[.03]">
                <td className="py-2.5 whitespace-nowrap">{new Date(t.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</td>
                <td>{TRIP_LABEL[t.trip_type]} · {t.hours} h</td>
                <td className="max-w-[220px] truncate">{t.pickup_address}</td>
                <td><Badge tone={tone[t.status]}>{STATUS_LABEL[t.status]}</Badge></td>
                <td className="text-right font-medium">{rupees(t.quoted_paise)}</td>
                <td className="text-right text-brand">{t.driver_earning_paise != null ? rupees(t.driver_earning_paise) : "—"}</td>
                <td className="text-right text-emerald-400">{t.platform_fee_paise != null ? rupees(t.platform_fee_paise) : "—"}</td>
                <td className="uppercase text-gray-400">{t.status === "completed" ? t.payment_method : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No trips match.</p>}
      </div>
    </div>
  );
}
