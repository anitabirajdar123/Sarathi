"use client";
import { MapContainer, TileLayer, Marker, Tooltip, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";

export interface Pin { id: string; lat: number; lng: number; label: string; kind: "me" | "driver" | "pickup" }

const icon = (kind: Pin["kind"]) =>
  L.divIcon({
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html:
      kind === "driver"
        ? `<div style="width:34px;height:34px;border-radius:50%;background:#f5b544;display:grid;place-items:center;box-shadow:0 0 0 6px rgba(245,181,68,.25);font-size:17px">🚗</div>`
        : kind === "pickup"
          ? `<div style="width:34px;height:34px;border-radius:50%;background:#22c55e;display:grid;place-items:center;box-shadow:0 0 0 6px rgba(34,197,94,.25);font-size:16px">📍</div>`
          : `<div style="width:18px;height:18px;margin:8px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 8px rgba(59,130,246,.3)"></div>`,
  });

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], map.getZoom()); }, [lat, lng, map]);
  return null;
}

export default function MapView({ center, pins, radiusM, height = 420 }:
  { center: { lat: number; lng: number }; pins: Pin[]; radiusM?: number; height?: number }) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={14} style={{ height, width: "100%" }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="dark-tiles"
      />
      <Recenter lat={center.lat} lng={center.lng} />
      {radiusM ? <Circle center={[center.lat, center.lng]} radius={radiusM}
        pathOptions={{ color: "#f5b544", weight: 1, fillOpacity: 0.04 }} /> : null}
      {pins.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={icon(p.kind)}>
          <Tooltip direction="top" offset={[0, -14]}>{p.label}</Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
