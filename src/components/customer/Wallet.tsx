"use client";
import { useCallback, useEffect, useState } from "react";
import { Wallet as WalletIcon, Gift, Copy, Share2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errText, rupees } from "@/lib/format";
import { Notice } from "@/components/Shell";

export interface WalletData {
  balance: number; referral_code: string; referred: boolean; friends: number;
  entries: { amount_paise: number; kind: string; note: string | null; created_at: string }[];
}

export function useWallet() {
  const [w, setW] = useState<WalletData | null>(null);
  const reload = useCallback(async () => {
    const { data } = await supabase.rpc("my_wallet");
    if (data) setW(data as WalletData);
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { wallet: w, reload };
}

export function WalletCard({ wallet, reload, hasTrips }: { wallet: WalletData | null; reload: () => void; hasTrips: boolean }) {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!wallet) return <div className="card h-48 animate-pulse" />;
  const invite = `Book a trusted driver for your car on Saarthi. Use my code ${wallet.referral_code} and we both get ₹50! ${typeof window !== "undefined" ? window.location.origin : ""}`;

  const apply = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null);
    const { error } = await supabase.rpc("apply_referral", { p_code: code });
    if (error) setMsg({ ok: false, t: errText(error) });
    else { setMsg({ ok: true, t: "Code added! You both get ₹50 after your first trip." }); setCode(""); reload(); }
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold"><WalletIcon size={18} className="text-brand" /> Wallet</h2>
        <span className="text-2xl font-bold text-gradient">{rupees(Math.max(wallet.balance, 0))}</span>
      </div>

      <div className="rounded-xl border border-brand/30 bg-gradient-to-br from-brand-strong/20 to-pink/10 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold"><Gift size={16} className="text-pink" /> Invite friends, earn ₹50 each</p>
        <p className="mt-1 text-xs text-gray-400">{wallet.friends} friend{wallet.friends === 1 ? "" : "s"} joined with your code</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="flex-1 rounded-lg border border-dashed border-brand/50 px-3 py-2 text-center font-mono text-lg tracking-widest">{wallet.referral_code}</span>
          <button className="btn-ghost px-3" aria-label="Copy code" onClick={async () => { try { await navigator.clipboard.writeText(wallet.referral_code); setCopied(true); } catch {} }}><Copy size={16} /></button>
          <a className="btn-brand px-3" aria-label="Share on WhatsApp" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(invite)}`}><Share2 size={16} /></a>
        </div>
        {copied && <p className="mt-1 text-xs text-emerald-300">Copied</p>}
      </div>

      {!wallet.referred && !hasTrips && (
        <form onSubmit={apply} className="flex gap-2">
          <input className="input" placeholder="Have a friend's code?" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={10} />
          <button className="btn-ghost" disabled={code.length < 4}>Apply</button>
        </form>
      )}
      {msg && <Notice kind={msg.ok ? "ok" : "error"}>{msg.t}</Notice>}

      {wallet.entries.length > 0 && (
        <ul className="divide-y divide-line text-sm">
          {wallet.entries.slice(0, 5).map((e, i) => (
            <li key={i} className="flex justify-between py-2">
              <span>{e.note ?? e.kind}<span className="block text-xs text-gray-500">{new Date(e.created_at).toLocaleDateString("en-IN")}</span></span>
              <span className={e.amount_paise > 0 ? "text-emerald-300" : "text-gray-300"}>{e.amount_paise > 0 ? "+" : "−"}{rupees(Math.abs(e.amount_paise))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
