"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, isConfigured } from "@/lib/supabase";
import { errText } from "@/lib/format";
import { Logo, Notice, SetupNotice } from "@/components/Shell";

const SAVED_EMAIL = "saarthi.email";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const as = params.get("as") === "driver" || next === "/driver" ? "driver" : "customer";
  const [mode, setMode] = useState<"password" | "link">("password");
  const [newAccount, setNewAccount] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Remember the last email used on this computer.
  useEffect(() => {
    try { const e = localStorage.getItem(SAVED_EMAIL); if (e) setEmail(e); } catch {}
  }, []);
  const remember = () => { try { localStorage.setItem(SAVED_EMAIL, email.trim()); } catch {} };

  const goIn = async () => {
    remember();
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
    if (next && /^\/(customer|driver|admin)$/.test(next)) { router.replace(next); return; }
    router.replace(data?.role === "admin" ? "/admin" : data?.role === "driver" || as === "driver" ? "/driver" : "/customer");
  };

  const withPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null); setOk(null);
    if (newAccount) {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) { setBusy(false); setErr(errText(error)); return; }
      if (!data.session) {
        setBusy(false); remember();
        setOk("Account created. Supabase wants the email confirmed first — click the link in the email, or turn off \"Confirm email\" in Supabase (see README).");
        return;
      }
      return goIn();
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setBusy(false); setErr(error.message.includes("Invalid") ? "Wrong email or password." : errText(error)); return; }
    goIn();
  };

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback?as=${as}` },
    });
    setBusy(false);
    if (error) setErr(errText(error)); else { remember(); setSent(true); }
  };

  const tab = (m: typeof mode, label: string) => (
    <button type="button" onClick={() => { setMode(m); setErr(null); setOk(null); }}
      className={`flex-1 rounded-lg py-2 text-sm font-medium ${mode === m ? "bg-gradient-to-r from-brand-strong to-pink text-white" : "text-gray-400"}`}>{label}</button>
  );

  return (
    <div className="card w-full max-w-sm">
      <h1 className="text-2xl font-bold">{as === "driver" ? "Drive with Saarthi" : "Sign in to Saarthi"}</h1>
      <div className="mt-5 flex gap-1 rounded-xl border border-line p-1">{tab("password", "Password")}{tab("link", "Email link")}</div>

      {mode === "password" ? (
        <form onSubmit={withPassword} className="mt-5 space-y-4">
          <div><label className="label" htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
          <div><label className="label" htmlFor="pw">Password</label>
            <input id="pw" className="input" type="password" autoComplete={newAccount ? "new-password" : "current-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {err && <Notice>{err}</Notice>}
          {ok && <Notice kind="ok">{ok}</Notice>}
          <button className="btn-brand w-full" disabled={busy || !isConfigured}>{busy ? "Please wait…" : newAccount ? "Create account" : "Sign in"}</button>
          <button type="button" className="w-full text-sm text-gray-400 hover:text-brand" onClick={() => { setNewAccount(!newAccount); setErr(null); setOk(null); }}>
            {newAccount ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>
        </form>
      ) : !sent ? (
        <form onSubmit={sendLink} className="mt-5 space-y-4">
          <div><label className="label" htmlFor="email2">Email</label>
            <input id="email2" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {err && <Notice>{err}</Notice>}
          <button className="btn-brand w-full" disabled={busy || !isConfigured}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
        </form>
      ) : (
        <div className="mt-5 space-y-4">
          <Notice kind="ok">Link sent to {email}. Open the email in this browser and click <b>Sign in</b>.</Notice>
          <button type="button" className="btn-ghost w-full" onClick={() => setSent(false)}>Use another email</button>
        </div>
      )}
      <p className="mt-5 border-t border-line pt-4 text-center text-sm text-gray-400">
        {as === "driver"
          ? <>Need a driver instead? <a className="text-brand" href="/login">Sign in as customer</a></>
          : <>Want to earn as a driver? <a className="text-brand" href="/login?as=driver">Sign in as driver</a></>}
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-4">
      <header className="py-5"><Logo /></header>
      {!isConfigured && <SetupNotice />}
      <div className="flex flex-1 items-start justify-center pt-10">
        <Suspense><LoginForm /></Suspense>
      </div>
    </main>
  );
}
