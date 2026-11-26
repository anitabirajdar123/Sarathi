"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Printer, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { rupees } from "@/lib/format";
import { TRIP_LABEL, type Booking } from "@/lib/types";

/** Trip receipt. "Print / Save as PDF" uses the browser's print, which can save a PDF. */
export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [b, setB] = useState<Booking | null | undefined>(undefined);
  const [car, setCar] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
      setB((data as Booking) ?? null);
      if (data?.car_id) {
        const { data: c } = await supabase.from("cars").select("model, reg_no").eq("id", data.car_id).maybeSingle();
        if (c) setCar(`${c.model} · ${c.reg_no}`);
      }
    })();
  }, [id]);

  if (b === undefined) return <main className="mx-auto max-w-xl p-6"><div className="card h-80 animate-pulse" /></main>;
  if (!b || b.status !== "completed") return <main className="mx-auto max-w-xl p-6"><div className="card">Receipt not available.</div></main>;

  const discount = b.discount_paise ?? 0;
  const wallet = b.wallet_paise ?? 0;
  const paid = b.quoted_paise - discount - wallet;
  const mins = b.started_at && b.completed_at ? Math.round((+new Date(b.completed_at) - +new Date(b.started_at)) / 60000) : null;
  const rows: [string, string, string?][] = [
    [`${TRIP_LABEL[b.trip_type]} · ${b.hours} h booked`, rupees(b.quoted_paise)],
    ...(discount ? [[`Promo ${b.promo_code ?? ""}`, `−${rupees(discount)}`, "text-emerald-600"] as [string, string, string]] : []),
    ...(wallet ? [["Paid from wallet", `−${rupees(wallet)}`, "text-emerald-600"] as [string, string, string]] : []),
  ];

  return (
    <main className="mx-auto max-w-xl p-4 sm:p-8">
      <div className="no-print mb-4 flex justify-between">
        <Link href="/customer" className="btn-ghost text-sm"><ArrowLeft size={14} /> Back</Link>
        <button onClick={() => window.print()} className="btn-brand text-sm"><Printer size={14} /> Print / Save as PDF</button>
      </div>
      <div className="rounded-2xl bg-white p-8 text-gray-900 shadow-xl">
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <p className="flex items-center gap-2 text-xl font-bold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-600 to-pink-500 text-white">S</span>Saarthi</p>
            <p className="mt-1 text-xs text-gray-500">Trip receipt</p>
          </div>
          <div className="text-right text-xs text-gray-500">
            <p>Receipt no. <b className="font-mono text-gray-800">SAR-{b.id.slice(0, 8).toUpperCase()}</b></p>
            <p>{new Date(b.completed_at!).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 py-4 text-sm">
          <div><p className="text-xs uppercase text-gray-400">Car</p><p>{car || "—"}</p></div>
          <div><p className="text-xs uppercase text-gray-400">Duration</p><p>{mins != null ? `${Math.floor(mins / 60)} h ${mins % 60} min` : "—"}</p></div>
          <div className="col-span-2"><p className="text-xs uppercase text-gray-400">Pickup</p><p>{b.pickup_address}</p></div>
          {b.drop_address && <div className="col-span-2"><p className="text-xs uppercase text-gray-400">Drop</p><p>{b.drop_address}</p></div>}
        </div>
        <table className="w-full border-t text-sm">
          <tbody>
            {rows.map(([k, v, c]) => <tr key={k} className="border-b"><td className="py-2">{k}</td><td className={`py-2 text-right ${c ?? ""}`}>{v}</td></tr>)}
            <tr><td className="py-3 text-base font-bold">Total paid ({(b.payment_method ?? "cash").toUpperCase()})</td><td className="py-3 text-right text-base font-bold">{rupees(paid)}</td></tr>
          </tbody>
        </table>
        <p className="mt-6 text-center text-xs text-gray-400">Thank you for riding with Saarthi. This is a computer-generated receipt.</p>
      </div>
    </main>
  );
}
