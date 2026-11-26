"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { rupees } from "@/lib/format";

const axis = { stroke: "#4b5563", fontSize: 11, tickLine: false, axisLine: false } as const;
const tip = { contentStyle: { background: "#121826", border: "1px solid #1f2937", borderRadius: 12, color: "#e5e7eb" }, labelStyle: { color: "#9ca3af" } };
const short = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Gross fare with the Saarthi share inside it, per day. */
export function RevenueChart({ data }: { data: { day: string; gross: number; platform: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f5b544" stopOpacity={0.45} /><stop offset="100%" stopColor="#f5b544" stopOpacity={0} /></linearGradient>
          <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.5} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0} /></linearGradient>
        </defs>
        <CartesianGrid stroke="#1f2937" vertical={false} />
        <XAxis dataKey="day" tickFormatter={short} {...axis} minTickGap={20} />
        <YAxis tickFormatter={(v) => rupees(v)} {...axis} width={70} />
        <Tooltip {...tip} labelFormatter={(d) => short(String(d))} formatter={(v, n) => [rupees(Number(v)), n === "gross" ? "Total fares" : "Saarthi share"]} />
        <Area type="monotone" dataKey="gross" stroke="#f5b544" strokeWidth={2} fill="url(#g1)" />
        <Area type="monotone" dataKey="platform" stroke="#22c55e" strokeWidth={2} fill="url(#g2)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function EarningsBars({ data }: { data: { day: string; earned: number; trips: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <CartesianGrid stroke="#1f2937" vertical={false} />
        <XAxis dataKey="day" tickFormatter={short} {...axis} minTickGap={10} />
        <YAxis tickFormatter={(v) => rupees(v)} {...axis} width={64} />
        <Tooltip {...tip} cursor={{ fill: "rgba(255,255,255,.04)" }} labelFormatter={(d) => short(String(d))}
          formatter={(v, n, p) => [`${rupees(Number(v))} · ${(p.payload as { trips: number }).trips} trips`, "You earned"]} />
        <Bar dataKey="earned" fill="#f5b544" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const COLORS = ["#f5b544", "#22c55e", "#3b82f6", "#a855f7"];
export function Donut({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <p className="py-16 text-center text-sm text-gray-500">No completed trips yet</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip {...tip} />
      </PieChart>
    </ResponsiveContainer>
  );
}
export const DONUT_COLORS = COLORS;
