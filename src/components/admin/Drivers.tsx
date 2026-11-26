"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Ban, Search, X, Phone, Star, HandCoins, BadgeCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errText, rupees } from "@/lib/format";
import { STATUS_LABEL, TRIP_LABEL, type BookingStatus, type TripType } from "@/lib/types";
import { Badge } from "@/components/ui/Stat";
import { Notice } from "@/components/Shell";
import { DocsReview, PayoutForm } from "./DriverExtras";

export interface AdminDriver {
  id: string; full_name: string; phone: string | null; licence_no: string; experience_years: number;
  city: string; status: "pending" | "approved" | "blocked"; is_online: boolean; trips: number; created_at: string;
  verified: boolean; docs_pending: boolean; photo_path: string | null;
}

interface Detail {
  profile: { full_name: string; phone: string | null; licence_no: string; experience_years: number; city: string; status: AdminDriver["status"];
    is_online: boolean; can_drive: string[]; joined: string; rating: number | null; rating_count: number };
  trips: number; cancelled: number; gross: number; earned: number; commission: number; owes: number;
  ledger: { id: number; kind: string; amount_paise: number; method: string | null; note: string | null; created_at: string }[];
  recent: { id: string; trip_type: TripType; hours: number; pickup_address: string; quoted_paise: number; platform_fee_paise: number | null;
    driver_earning_paise: number | null; status: BookingStatus; rating: number | null; created_at: string }[];
}

const statusTone = { approved: "green", pending: "brand", blocked: "red" } as const;

export function Drivers({ drivers, reload }: { drivers: AdminDriver[]; reload: () => void }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | AdminDriver["status"]>("all");
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(() => drivers.filter((d) =>
    (filter === "all" || d.status === filter) &&
    `${d.full_name} ${d.phone} ${d.licence_no} ${d.city}`.toLowerCase().includes(q.toLowerCase())), [drivers, q, filter]);

  const setStatus = async (id: string, status: AdminDriver["status"]) => {
    await supabase.rpc("admin_set_driver_status", { p_driver: id, p_status: status });
    reload();
  };

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-3 text-gray-500" />
          <input className="input pl-9" placeholder="Search name, mobile, licence, city" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1 rounded-xl border border-line p-1">
          {(["all", "pending", "approved", "blocked"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-sm capitalize ${filter === f ? "bg-white/10 text-white" : "text-gray-400"}`}>
              {f} <span className="text-gray-500">{f === "all" ? drivers.length : drivers.filter((d) => d.status === f).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase text-gray-500"><tr><th className="py-2">Driver</th><th>Mobile</th><th>Licence</th><th>Exp</th><th>City</th><th>Trips</th><th>Status</th><th /></tr></thead>
          <tbody className="divide-y divide-line">
            {list.map((d) => (
              <tr key={d.id} className="cursor-pointer hover:bg-white/[.03]" onClick={() => setOpen(d.id)}>
                <td className="py-3 font-medium">
                  <span className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-brand/15 text-brand">{d.full_name.charAt(0).toUpperCase()}</span>
                    {d.full_name}{d.verified && <BadgeCheck size={15} className="text-sky-400" aria-label="Verified" />}{d.is_online && <span className="h-2 w-2 rounded-full bg-emerald-400" title="Online" />}{d.docs_pending && <Badge tone="blue">docs to check</Badge>}
                  </span>
                </td>
                <td>{d.phone}</td><td className="font-mono text-xs">{d.licence_no}</td><td>{d.experience_years} y</td><td>{d.city}</td><td>{d.trips}</td>
                <td><Badge tone={statusTone[d.status]}>{d.status}</Badge></td>
                <td className="space-x-2 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                  {d.status !== "approved" && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setStatus(d.id, "approved")}><Check size={14} /> Approve</button>}
                  {d.status !== "blocked" && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setStatus(d.id, "blocked")}><Ban size={14} /> Block</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No drivers match.</p>}
      </div>
      {open && <DriverDrawer id={open} onClose={() => setOpen(null)} onChange={reload} />}
    </div>
  );
}

function DriverDrawer({ id, onClose, onChange }: { id: string; onClose: () => void; onChange: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "upi" | "bank">("cash");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("admin_driver_detail", { p_driver: id });
    setD(data as Detail);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const settle = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null);
    const { error } = await supabase.rpc("admin_record_settlement", {
      p_driver: id, p_amount_paise: Math.round(Number(amount) * 100), p_method: method, p_note: note || null,
    });
    if (error) setMsg({ ok: false, t: errText(error) });
    else { setMsg({ ok: true, t: `Recorded ${rupees(Math.round(Number(amount) * 100))} received.` }); setAmount(""); setNote(""); load(); onChange(); }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex justify-end bg-black/60" onClick={onClose}>
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-line bg-ink p-6" onClick={(e) => e.stopPropagation()}>
        <button className="btn-ghost float-right px-2 py-1" onClick={onClose} aria-label="Close"><X size={16} /></button>
        {!d ? <div className="card mt-10 h-60 animate-pulse" /> : (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand text-2xl font-bold text-ink">{d.profile.full_name.charAt(0).toUpperCase()}</span>
              <div>
                <h2 className="text-xl font-bold">{d.profile.full_name}</h2>
                <p className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
                  <Badge tone={statusTone[d.profile.status]}>{d.profile.status}</Badge>
                  {d.profile.is_online ? <Badge tone="green">online</Badge> : <Badge tone="gray">offline</Badge>}
                  {d.profile.rating && <span className="flex items-center gap-1"><Star size={12} className="fill-brand text-brand" />{d.profile.rating} ({d.profile.rating_count})</span>}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              {[["Mobile", d.profile.phone ? <a key="p" className="flex items-center gap-1 text-brand" href={`tel:${d.profile.phone}`}><Phone size={12} />{d.profile.phone}</a> : "—"],
                ["Licence", <span key="l" className="font-mono">{d.profile.licence_no}</span>], ["Experience", `${d.profile.experience_years} years`],
                ["Drives", d.profile.can_drive.join(" & ")], ["City", d.profile.city], ["Joined", new Date(d.profile.joined).toLocaleDateString("en-IN")]].map(([k, v]) => (
                <div key={k as string} className="rounded-xl border border-line p-3"><p className="label">{k}</p><div>{v}</div></div>
              ))}
            </div>

            <div className="card space-y-3">
              <p className="label">Money from this driver&apos;s trips</p>
              <Row k={`Customers paid (${d.trips} trips)`} v={rupees(d.gross)} />
              <Row k="Driver kept" v={rupees(d.earned)} tone="text-brand" />
              <Row k="Saarthi commission" v={rupees(d.commission)} tone="text-emerald-400" />
              <div className="flex items-center justify-between rounded-xl bg-white/5 p-3">
                <span className="flex items-center gap-2 font-semibold"><HandCoins size={16} className="text-brand" /> {d.owes < 0 ? "Saarthi owes driver" : "Driver owes Saarthi"}</span>
                <span className={`text-xl font-bold ${d.owes > 0 ? "text-red-400" : "text-emerald-400"}`}>{rupees(Math.abs(d.owes))}</span>
              </div>
            </div>

            {d.owes > 0 && (
              <form onSubmit={settle} className="card space-y-3">
                <p className="font-semibold">Record money received from driver</p>
                <div className="grid grid-cols-2 gap-2">
                  <input className="input" type="number" min={1} step="1" max={d.owes / 100} required placeholder={`Up to ${rupees(d.owes)}`} value={amount} onChange={(e) => setAmount(e.target.value)} />
                  <select className="input" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank transfer</option></select>
                </div>
                <input className="input" placeholder="Note (optional), e.g. UPI ref" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="flex gap-2">
                  <button className="btn-brand flex-1">Record payment</button>
                  <button type="button" className="btn-ghost" onClick={() => setAmount(String(d.owes / 100))}>Full amount</button>
                </div>
                {msg && <Notice kind={msg.ok ? "ok" : "error"}>{msg.t}</Notice>}
              </form>
            )}
            {d.owes <= 0 && msg?.ok && <Notice kind="ok">{msg.t}</Notice>}
            {d.owes < 0 && <PayoutForm driverId={id} owedToDriver={-d.owes} onDone={() => { load(); onChange(); }} />}
            <DocsReview driverId={id} onChange={onChange} />

            <div className="card">
              <p className="mb-2 font-semibold">Account history</p>
              {d.ledger.length === 0 && <p className="text-sm text-gray-500">Nothing yet.</p>}
              <ul className="divide-y divide-line text-sm">
                {d.ledger.map((l) => (
                  <li key={l.id} className="flex justify-between py-2">
                    <span>{l.kind === "commission" ? (l.amount_paise > 0 ? "Commission owed (cash trip)" : "Owed to driver (UPI / promo)") : l.kind === "settlement" ? (l.amount_paise < 0 ? `Driver paid in (${l.method})` : `Paid to driver (${l.method})`) : "Adjustment"}
                      <span className="block text-xs text-gray-500">{new Date(l.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}{l.note ? ` · ${l.note}` : ""}</span></span>
                    <span className={l.amount_paise > 0 ? "text-red-400" : "text-emerald-400"}>{l.amount_paise > 0 ? "+" : "−"}{rupees(Math.abs(l.amount_paise))}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card">
              <p className="mb-2 font-semibold">Recent trips</p>
              {d.recent.length === 0 && <p className="text-sm text-gray-500">No trips yet.</p>}
              <ul className="divide-y divide-line text-sm">
                {d.recent.map((t) => (
                  <li key={t.id} className="py-2">
                    <div className="flex justify-between"><span>{TRIP_LABEL[t.trip_type]} · {t.hours} h</span><span>{rupees(t.quoted_paise)}</span></div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{new Date(t.created_at).toLocaleDateString("en-IN")} · {STATUS_LABEL[t.status]}{t.rating ? ` · ★${t.rating}` : ""}</span>
                      {t.driver_earning_paise != null && <span>driver {rupees(t.driver_earning_paise)} · Saarthi {rupees(t.platform_fee_paise ?? 0)}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Row({ k, v, tone = "" }: { k: string; v: string; tone?: string }) {
  return <div className="flex justify-between text-sm"><span className="text-gray-400">{k}</span><span className={`font-semibold ${tone}`}>{v}</span></div>;
}
