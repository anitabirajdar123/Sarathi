"use client";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { isConfigured } from "@/lib/supabase";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-r from-brand-strong to-pink text-white">S</span>
      Saarthi
    </Link>
  );
}

export function Shell({ title, onSignOut, children }:
  { title: string; onSignOut?: () => void; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header className="flex items-center justify-between py-5">
        <Logo />
        <div className="flex items-center gap-3">
          {title === "Customer" && <Link href="/driver" className="hidden text-sm text-gray-400 hover:text-brand sm:inline">Drive with Saarthi</Link>}
          {title === "Driver" && <Link href="/customer" className="hidden text-sm text-gray-400 hover:text-brand sm:inline">Book a driver</Link>}
          <span className="rounded-full border border-line px-3 py-1 text-xs text-gray-400">{title}</span>
          {onSignOut && (
            <button onClick={onSignOut} className="btn-ghost px-3 py-1.5 text-sm" aria-label="Sign out">
              <LogOut size={16} /> Sign out
            </button>
          )}
        </div>
      </header>
      {!isConfigured && <SetupNotice />}
      {children}
    </div>
  );
}

export function SetupNotice() {
  return (
    <div className="card mb-6 border-brand/40">
      <p className="font-semibold text-brand">Connect your database first</p>
      <p className="mt-1 text-sm text-gray-300">
        Copy <code>.env.local.example</code> to <code>.env.local</code>, paste your Supabase URL and key,
        run <code>supabase/migrations/0001_init.sql</code> in the SQL Editor, then restart <code>npm run dev</code>.
      </p>
    </div>
  );
}

export function Notice({ kind = "error", children }: { kind?: "error" | "ok"; children: React.ReactNode }) {
  return (
    <p className={`rounded-xl px-3 py-2 text-sm ${kind === "error" ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"}`}>
      {children}
    </p>
  );
}
