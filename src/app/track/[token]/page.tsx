"use client";
import { use, useEffect, useState } from "react";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { supabase, photoUrl } from "@/lib/supabase";
import { Logo } from "@/components/Shell";
import { Map } from "@/components/Map";
import { STATUS_LABEL, TRIP_LABEL, type BookingStatus, type TripType } from "@/lib/types";

interface Shared {
  status: BookingStatus; trip_type: TripType; pickup_address: string; started_at: string | null; completed_at: string | null;
  driver_name: string | null; driver_verified: boolean | null; driver_photo: string | null; car: string;
  lat: number | null; lng: number | null; updated_at: string | null;
}

/** Public page for family: follow a trip live with the link the customer shared. No sign-in needed. */
export default function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [d, setD] = useState<Shared | null | undefined>(undefined);

  useEffect(() => {
    const tick = async () => {
      const { data } = await supabase.rpc("get_shared_trip", { p_token: token });
      setD((data as Shared) ?? null);
    };
    tick(); const id = setInterval(tick, 8000);
    return () => clearInterval(id);
  }, [token]);

  const photo = photoUrl(d?.driver_photo);
  return (
    <main className="mx-auto max-w-3xl px-4 pb-12">
      <header className="flex items-center justify-between py-5"><Logo /><span className="text-xs text-gray-400">Live trip</span></header>
      {d === undefined && <div className="card h-60 animate-pulse" />}
      {d === null && <div className="card text-center"><p className="text-lg font-semibold">This trip link has ended</p><p className="text-sm text-gray-400">Links work only while the trip is active and for one hour after.</p></div>}
      {d && (
        <div className="space-y-4">
          {d.lat != null && d.lng != null && <Map center={{ lat: d.lat, lng: d.lng }} pins={[{ id: "d", lat: d.lat, lng: d.lng, label: d.driver_name ?? "Driver", kind: "driver" }]} height={360} />}
          <div className="card space-y-3">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${d.status === "started" ? "animate-pulse bg-emerald-400" : "bg-brand"}`} />
              <h1 className="text-xl font-bold">{STATUS_LABEL[d.status]}</h1>
            </div>
            <p className="text-sm text-gray-400">{TRIP_LABEL[d.trip_type]} · from {d.pickup_address}</p>
            <div className="flex items-center gap-3 rounded-xl border border-line p-3">
              {photo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={photo} alt="" className="h-12 w-12 rounded-full object-cover" />
                : <span className="grid h-12 w-12 place-items-center rounded-full bg-brand/20 font-bold text-brand">{d.driver_name?.charAt(0) ?? "?"}</span>}
              <div>
                <p className="flex items-center gap-1 font-semibold">{d.driver_name ?? "Driver not assigned yet"}{d.driver_verified && <BadgeCheck size={16} className="text-sky-400" />}</p>
                <p className="text-sm text-gray-400">{d.car}</p>
              </div>
            </div>
            {d.updated_at && <p className="text-xs text-gray-500">Location updated {new Date(d.updated_at).toLocaleTimeString("en-IN")}</p>}
            <p className="flex items-center gap-2 text-xs text-gray-500"><ShieldCheck size={14} /> In an emergency call 112. Saarthi trips have an SOS button.</p>
          </div>
        </div>
      )}
    </main>
  );
}
