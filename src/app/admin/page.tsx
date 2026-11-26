"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { Shell, Notice } from "@/components/Shell";
import { Tabs } from "@/components/ui/Stat";
import { Overview } from "@/components/admin/Overview";
import { Live } from "@/components/admin/Live";
import { Drivers, type AdminDriver } from "@/components/admin/Drivers";
import { Trips } from "@/components/admin/Trips";
import { Pricing } from "@/components/admin/Pricing";

type Tab = "overview" | "live" | "drivers" | "trips" | "pricing";

export default function AdminPage() {
  const { profile, loading, signOut } = useSession("admin");
  const [tab, setTab] = useState<Tab>("overview");
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const loadDrivers = useCallback(async () => {
    if (profile?.role !== "admin") return;
    const { data } = await supabase.rpc("admin_drivers");
    setDrivers((data ?? []) as AdminDriver[]);
  }, [profile]);
  useEffect(() => { loadDrivers(); }, [loadDrivers]);

  if (loading || profile?.role !== "admin") return <Shell title="Admin"><div className="card h-40 animate-pulse" /></Shell>;

  const pending = drivers.filter((d) => d.status === "pending").length;

  return (
    <Shell title="Admin" onSignOut={signOut}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="text-2xl font-bold">Control room</h1><p className="text-sm text-gray-400">Everything happening on Saarthi, live.</p></div>
      </div>
      {err && <div className="mb-4"><Notice>{err}</Notice></div>}
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: "overview", label: "Overview" }, { id: "live", label: "Live map" },
        { id: "drivers", label: "Drivers", badge: pending }, { id: "trips", label: "Trips" }, { id: "pricing", label: "Pricing" },
      ]} />
      {tab === "overview" && <Overview onError={setErr} />}
      {tab === "live" && <Live />}
      {tab === "drivers" && <Drivers drivers={drivers} reload={loadDrivers} />}
      {tab === "trips" && <Trips />}
      {tab === "pricing" && <Pricing />}
    </Shell>
  );
}
