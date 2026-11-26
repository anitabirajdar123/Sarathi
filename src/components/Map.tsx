"use client";
import dynamic from "next/dynamic";

/** Leaflet needs the browser, so the map is loaded only on the client. */
export const Map = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse rounded-2xl bg-panel" />,
});
