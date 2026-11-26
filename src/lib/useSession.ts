"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, isConfigured } from "./supabase";
import type { Profile } from "./types";

/** Loads the signed-in user's profile. Sends them to /login if signed out. */
export function useSession(requireRole?: Profile["role"]) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
    const { data } = await supabase.from("profiles").select("id, role, full_name, phone").eq("id", user.id).single();
    setProfile(data as Profile | null);
    setLoading(false);
    if (requireRole === "admin" && data?.role !== "admin") router.replace("/");
  }, [router, requireRole]);

  useEffect(() => { reload(); }, [reload]);

  const signOut = async () => { await supabase.auth.signOut(); router.replace("/"); };
  return { profile, loading, reload, signOut };
}

/** Browser location, falling back to null if refused. */
export function useLocation(watch = false) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!("geolocation" in navigator)) { setError("Location not supported"); return; }
    const ok = (p: GeolocationPosition) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
    const bad = () => setError("Location permission denied — using Solapur centre");
    const opts = { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 };
    if (watch) {
      const id = navigator.geolocation.watchPosition(ok, bad, opts);
      return () => navigator.geolocation.clearWatch(id);
    }
    navigator.geolocation.getCurrentPosition(ok, bad, opts);
  }, [watch]);
  return { pos, error };
}
