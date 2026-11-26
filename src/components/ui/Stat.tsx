import type { LucideIcon } from "lucide-react";

export function Stat({ icon: Icon, label, value, hint, tone = "default" }:
  { icon: LucideIcon; label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "default" | "gold" | "green" | "red" }) {
  const color = { default: "text-gray-100", gold: "text-gold", green: "text-emerald-400", red: "text-red-400" }[tone];
  return (
    <div className="card group relative overflow-hidden transition hover:border-gold/40">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gold/5 transition group-hover:bg-gold/10" />
      <Icon size={18} className="text-gold" />
      <p className="label mt-3">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; badge?: number }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-line bg-panel/60 p-1">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${value === t.id ? "bg-gold text-ink" : "text-gray-400 hover:text-gray-200"}`}>
          {t.label}{t.badge ? <span className={`rounded-full px-1.5 text-xs ${value === t.id ? "bg-ink/20" : "bg-gold/20 text-gold"}`}>{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Badge({ tone, children }: { tone: "green" | "gold" | "red" | "gray" | "blue"; children: React.ReactNode }) {
  const c = { green: "bg-emerald-500/15 text-emerald-300", gold: "bg-gold/15 text-gold", red: "bg-red-500/15 text-red-300", gray: "bg-white/5 text-gray-400", blue: "bg-blue-500/15 text-blue-300" }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${c}`}>{children}</span>;
}
