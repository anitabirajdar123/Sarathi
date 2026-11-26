"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Logo, Notice } from "@/components/Shell";

/** The "Sign in" link in the email lands here. We swap the one-time code for a session, then send the user on. */
function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const code = params.get("code");
      const as = params.get("as");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) { setErr("This sign-in link has expired or was already used. Please ask for a new one."); return; }
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErr(params.get("error_description") ?? "Sign-in failed. Please try again."); return; }
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      router.replace(data?.role === "admin" ? "/admin" : data?.role === "driver" || as === "driver" ? "/driver" : "/customer");
    })();
  }, [params, router]);

  return err
    ? <div className="card max-w-sm space-y-4"><Notice>{err}</Notice><a className="btn-gold w-full" href="/login">Back to sign in</a></div>
    : <p className="text-gray-400">Signing you in…</p>;
}

export default function CallbackPage() {
  return (
    <main className="mx-auto max-w-6xl px-4">
      <header className="py-5"><Logo /></header>
      <div className="flex justify-center pt-16"><Suspense><Callback /></Suspense></div>
    </main>
  );
}
