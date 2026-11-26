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
import { Promos } from "@/components/admin/Promos";
import { MonthlyAdmin } from "@/components/admin/Monthly";
import { SosAlerts, type AlertCounts } from "@/components/admin/Alerts";

type Tab = "overview" | "live" | "drivers" | "trips" | "monthly" | "pricing";

export default function AdminPage() {
  const { profile, loading, signOut } = useSession("admin");
  const [tab, setTab] = useState<Tab>("overview");
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [counts, setCounts] = useState<AlertCounts>({ docs_waiting: 0, monthly_waiting: 0, sos: 0 });
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
        <div><h1 className="text-3xl font-bold">Control <span className="text-gradient">room</span></h1><p className="text-sm text-gray-400">Everything happening on Saarthi, live.</p></div>
        {counts.sos > 0 && <span className="rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white">{counts.sos} SOS open</span>}
      </div>
      <SosAlerts onCounts={setCounts} />
      {err && <div className="mb-4"><Notice>{err}</Notice></div>}
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: "overview", label: "Overview" }, { id: "live", label: "Live map" },
        { id: "drivers", label: "Drivers", badge: pending + counts.docs_waiting }, { id: "trips", label: "Trips" },
        { id: "monthly", label: "Monthly", badge: counts.monthly_waiting }, { id: "pricing", label: "Pricing & promos" },
      ]} />
      {tab === "overview" && <Overview onError={setErr} />}
      {tab === "live" && <Live />}
      {tab === "drivers" && <Drivers drivers={drivers} reload={loadDrivers} />}
      {tab === "trips" && <Trips />}
      {tab === "monthly" && <MonthlyAdmin drivers={drivers} />}
      {tab === "pricing" && <div className="space-y-6"><Promos /><Pricing /></div>}
    </Shell>
  );
}
