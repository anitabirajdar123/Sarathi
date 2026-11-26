"use client";
import { useState } from "react";
import { ShieldAlert, Share2, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errText } from "@/lib/format";

/** SOS: tells the Saarthi team at once, with location, and offers the emergency number. */
export function SosButton({ bookingId }: { bookingId: string }) {
  const [state, setState] = useState<"idle" | "confirm" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");

  const send = () => {
    const go = async (lat?: number, lng?: number) => {
      const { error } = await supabase.rpc("raise_sos", { p_booking: bookingId, p_lat: lat ?? null, p_lng: lng ?? null });
      if (error) { setState("error"); setMsg(errText(error)); } else setState("sent");
    };
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((p) => go(p.coords.latitude, p.coords.longitude), () => go(), { timeout: 5000 });
    } else go();
  };

  if (state === "sent") {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
        <p className="font-semibold text-red-300">Help is on the way. The Saarthi team has your trip and location.</p>
        <a href="tel:112" className="btn mt-2 w-full bg-red-600 text-white"><Phone size={16} /> Call 112 (Emergency)</a>
      </div>
    );
  }
  if (state === "confirm") {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3">
        <p className="mb-2 text-sm text-red-200">Send an SOS to the Saarthi team now?</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn bg-red-600 text-white" onClick={send}>Yes, send SOS</button>
          <button className="btn-ghost" onClick={() => setState("idle")}>No</button>
        </div>
      </div>
    );
  }
  return (
    <>
      <button onClick={() => setState("confirm")} className="btn w-full border border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20">
        <ShieldAlert size={16} /> SOS — I need help
      </button>
      {state === "error" && <p className="text-xs text-red-300">{msg}</p>}
    </>
  );
}

/** Share a live tracking link with family on WhatsApp (works without signing in). */
export function ShareTrip({ token }: { token?: string }) {
  const [copied, setCopied] = useState(false);
  if (!token) return null;
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/track/${token}`;
  const text = `I'm on a Saarthi trip. Follow it live here: ${url}`;
  return (
    <div className="grid grid-cols-2 gap-2">
      <a className="btn-ghost text-sm" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(text)}`}>
        <Share2 size={14} /> Share on WhatsApp
      </a>
      <button className="btn-ghost text-sm" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch {} }}>
        {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  );
}
