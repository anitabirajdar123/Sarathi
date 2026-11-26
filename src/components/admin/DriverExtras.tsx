"use client";
import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, ExternalLink, Check, X } from "lucide-react";
import { supabase, photoUrl } from "@/lib/supabase";
import { errText, rupees } from "@/lib/format";
import { Badge } from "@/components/ui/Stat";
import { Notice } from "@/components/Shell";

interface Doc { kind: "photo" | "licence" | "aadhaar"; path: string; status: "pending" | "approved" | "rejected"; note: string | null; uploaded_at: string }
const TITLE = { photo: "Photo", licence: "Driving licence", aadhaar: "Aadhaar" };

/** Admin looks at each document (private ones through a 5-minute link) and approves or rejects it. */
export function DocsReview({ driverId, onChange }: { driverId: string; onChange: () => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [verified, setVerified] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("admin_driver_documents", { p_driver: driverId });
    const list = (data ?? []) as Doc[];
    setDocs(list);
    const l: Record<string, string> = {};
    for (const d of list) {
      if (d.kind === "photo") l[d.kind] = photoUrl(d.path) ?? "";
      else {
        const { data: s } = await supabase.storage.from("driver-docs").createSignedUrl(d.path, 300);
        if (s?.signedUrl) l[d.kind] = s.signedUrl;
      }
    }
    setLinks(l);
  }, [driverId]);
  useEffect(() => { load(); }, [load]);

  const review = async (kind: Doc["kind"], approve: boolean) => {
    setErr(null);
    if (!approve && !reason[kind]?.trim()) { setErr("Write why it is rejected — the driver sees it."); return; }
    const { data, error } = await supabase.rpc("admin_review_document", { p_driver: driverId, p_kind: kind, p_approve: approve, p_note: approve ? null : reason[kind] });
    if (error) setErr(errText(error)); else { setVerified(Boolean(data)); load(); onChange(); }
  };

  return (
    <div className="card space-y-3">
      <p className="flex items-center gap-2 font-semibold">Documents {verified && <span className="flex items-center gap-1 text-sm text-sky-300"><BadgeCheck size={16} /> now verified</span>}</p>
      {docs.length === 0 && <p className="text-sm text-gray-500">The driver has not uploaded any documents yet.</p>}
      {(["photo", "licence", "aadhaar"] as const).map((k) => {
        const d = docs.find((x) => x.kind === k);
        if (!d) return <p key={k} className="text-sm text-gray-500">{TITLE[k]}: not uploaded</p>;
        const isPdf = d.path.toLowerCase().endsWith(".pdf");
        return (
          <div key={k} className="rounded-xl border border-line p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{TITLE[k]}</span>
              <Badge tone={d.status === "approved" ? "green" : d.status === "rejected" ? "red" : "brand"}>{d.status}</Badge>
            </div>
            {links[k] && (isPdf
              ? <a href={links[k]} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-brand"><ExternalLink size={14} /> Open PDF</a>
              // eslint-disable-next-line @next/next/no-img-element
              : <a href={links[k]} target="_blank" rel="noreferrer"><img src={links[k]} alt={TITLE[k]} className="mt-2 max-h-48 rounded-lg object-contain" /></a>)}
            {d.status === "rejected" && d.note && <p className="mt-1 text-xs text-red-300">Rejected: {d.note}</p>}
            {d.status !== "approved" && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn-brand px-3 py-1.5 text-sm" onClick={() => review(k, true)}><Check size={14} /> Approve</button>
                <input className="input flex-1 py-1.5 text-sm" placeholder="Reason if rejecting" value={reason[k] ?? ""} onChange={(e) => setReason({ ...reason, [k]: e.target.value })} />
                <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => review(k, false)}><X size={14} /> Reject</button>
              </div>
            )}
          </div>
        );
      })}
      {err && <Notice>{err}</Notice>}
      <p className="text-xs text-gray-500">Licence and Aadhaar links expire after 5 minutes. The blue Verified badge appears when all three are approved.</p>
    </div>
  );
}

/** When Saarthi owes the driver (UPI trips, promo discounts), the admin records the payout here. */
export function PayoutForm({ driverId, owedToDriver, onDone }: { driverId: string; owedToDriver: number; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"upi" | "bank" | "cash">("upi");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.rpc("admin_record_payout", { p_driver: driverId, p_amount_paise: Math.round(Number(amount) * 100), p_method: method, p_note: note || null });
    setMsg(error ? { ok: false, t: errText(error) } : { ok: true, t: "Payout recorded." });
    if (!error) { setAmount(""); setNote(""); onDone(); }
  };
  return (
    <form onSubmit={pay} className="card space-y-3">
      <p className="font-semibold">Pay the driver <span className="text-emerald-300">{rupees(owedToDriver)}</span> owed</p>
      <div className="grid grid-cols-2 gap-2">
        <input className="input" type="number" min={1} max={owedToDriver / 100} required placeholder={`Up to ${rupees(owedToDriver)}`} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <select className="input" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}><option value="upi">UPI</option><option value="bank">Bank transfer</option><option value="cash">Cash</option></select>
      </div>
      <input className="input" placeholder="UPI / bank reference (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2"><button className="btn-brand flex-1">Record payout</button><button type="button" className="btn-ghost" onClick={() => setAmount(String(owedToDriver / 100))}>Full amount</button></div>
      {msg && <Notice kind={msg.ok ? "ok" : "error"}>{msg.t}</Notice>}
    </form>
  );
}
