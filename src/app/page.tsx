import Link from "next/link";
import {
  ShieldCheck, MapPin, IndianRupee, KeyRound, BadgeCheck, CalendarClock, Siren, Gift, Share2,
  ArrowRight, Star, Car, UserCheck, Wallet,
} from "lucide-react";
import { Logo } from "@/components/Shell";

const steps = [
  { icon: MapPin, title: "Open the map", text: "See verified drivers near you with their price, live." },
  { icon: KeyRound, title: "Book & share the code", text: "Your driver starts only with your 4-digit code." },
  { icon: Car, title: "Sit back", text: "Track the trip, share it with family, pay cash, UPI or wallet." },
];

const features = [
  { icon: BadgeCheck, title: "Verified drivers", text: "Licence, Aadhaar and photo checked by our team. Look for the blue tick.", c: "from-sky-500/20" },
  { icon: Siren, title: "SOS in one tap", text: "Alerts our control room with your live location during any trip.", c: "from-red-500/20" },
  { icon: Share2, title: "Share your trip", text: "Family follows your trip live on a link — no app needed.", c: "from-emerald-500/20" },
  { icon: CalendarClock, title: "Schedule or go monthly", text: "Book for later, or hire a fixed driver every day at a monthly price.", c: "from-amber-500/20" },
  { icon: IndianRupee, title: "Price before you book", text: "Calculated on the server and shown up front. No surprises.", c: "from-violet-500/20" },
  { icon: Gift, title: "Offers & wallet", text: "Promo codes, and ₹50 for you and every friend you invite.", c: "from-pink-500/20" },
];

const plans = [
  { name: "Hourly", price: "₹199", unit: "first 2 hours", extra: "then ₹70 / hour" },
  { name: "One-way drop", price: "₹249", unit: "first 2 hours", extra: "then ₹80 / hour", hot: true },
  { name: "Outstation", price: "₹999", unit: "12 hours", extra: "then ₹60 / hour" },
  { name: "Monthly driver", price: "₹14,600", unit: "8 h × 6 days", extra: "fixed driver every day" },
];

export default function Home() {
  return (
    <main className="overflow-hidden">
      <div className="mx-auto max-w-6xl px-4">
        <header className="flex items-center justify-between py-5">
          <Logo />
          <nav className="flex items-center gap-2">
            <a href="#how" className="hidden px-3 text-sm text-gray-400 hover:text-white sm:inline">How it works</a>
            <a href="#pricing" className="hidden px-3 text-sm text-gray-400 hover:text-white sm:inline">Pricing</a>
            <Link href="/login" className="btn-ghost text-sm">Sign in</Link>
          </nav>
        </header>

        {/* Hero */}
        <section className="grid items-center gap-12 py-14 md:grid-cols-2 md:py-20">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs text-brand">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live in Solapur · Pune · Mumbai
            </p>
            <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl">
              Your car.<br /><span className="text-gradient">Our Saarthi.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-gray-400">
              Book a verified driver for your own car in minutes — for an hour, a day, an outstation trip or every day of the month.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login?as=customer" className="btn-brand px-6 py-3 text-base">Book a driver <ArrowRight size={18} /></Link>
              <Link href="/login?as=driver" className="btn-ghost px-6 py-3 text-base">Drive & earn</Link>
            </div>
            <div className="mt-10 flex gap-8 text-sm">
              {[["₹199", "starting fare"], ["4-digit", "start code"], ["1-tap", "SOS on every trip"]].map(([a, b]) => (
                <div key={b}><p className="text-2xl font-bold">{a}</p><p className="text-gray-500">{b}</p></div>
              ))}
            </div>
          </div>

          {/* Phone-style preview card */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-10 -z-10 rounded-full bg-gradient-to-tr from-brand-strong/40 via-fuchsia-500/20 to-pink/30 blur-3xl" />
            <div className="card space-y-4 rounded-3xl p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Driver on the way</span>
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> 4 min</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-brand-strong to-pink text-xl font-bold text-white">R</span>
                <div className="flex-1">
                  <p className="flex items-center gap-1 font-semibold">Rahul <BadgeCheck size={16} className="text-sky-400" /></p>
                  <p className="flex items-center gap-1 text-xs text-gray-400"><Star size={12} className="fill-amber-400 text-amber-400" /> 4.9 · 7 years · Manual & Automatic</p>
                </div>
              </div>
              <div className="rounded-2xl border border-brand/30 bg-brand/10 p-4 text-center">
                <p className="text-xs uppercase tracking-wide text-gray-400">Your start code</p>
                <p className="font-mono text-4xl font-bold tracking-[0.4em] text-gradient">4821</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="flex items-center justify-center gap-1 rounded-xl border border-line py-2 text-gray-300"><Share2 size={14} /> Share trip</span>
                <span className="flex items-center justify-center gap-1 rounded-xl border border-red-500/40 py-2 text-red-300"><Siren size={14} /> SOS</span>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-3">
                <span className="text-sm text-gray-400">Hourly · 2 h</span>
                <span className="text-2xl font-bold text-gradient">₹199</span>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-16">
          <h2 className="text-center text-3xl font-bold md:text-4xl">Three steps to a <span className="text-gradient">relaxed drive</span></h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <div key={title} className="card relative">
                <span className="absolute right-5 top-4 text-5xl font-black text-white/5">0{i + 1}</span>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-strong to-pink text-white"><Icon size={20} /></span>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-gray-400">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="py-16">
          <h2 className="text-center text-3xl font-bold md:text-4xl">Built for <span className="text-gradient">safety and trust</span></h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text, c }) => (
              <div key={title} className={`card bg-gradient-to-br ${c} to-transparent transition hover:-translate-y-1 hover:border-brand/40`}>
                <Icon className="text-brand" size={24} />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-gray-400">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-16">
          <h2 className="text-center text-3xl font-bold md:text-4xl">Simple, <span className="text-gradient">honest pricing</span></h2>
          <p className="mt-2 text-center text-sm text-gray-400">Night trips (10 pm – 6 am) +20%. Pickup beyond 2 km ₹10/km.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => (
              <div key={p.name} className={`card relative ${p.hot ? "border-brand/60 ring-1 ring-brand/40" : ""}`}>
                {p.hot && <span className="absolute -top-3 left-5 rounded-full bg-gradient-to-r from-brand-strong to-pink px-3 py-0.5 text-xs font-semibold text-white">Popular</span>}
                <p className="text-sm text-gray-400">{p.name}</p>
                <p className="mt-2 text-4xl font-bold">{p.price}</p>
                <p className="text-sm text-gray-400">{p.unit}</p>
                <p className="mt-4 border-t border-line pt-3 text-sm text-gray-300">{p.extra}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Two audiences */}
        <section className="grid gap-4 py-16 md:grid-cols-2">
          <div className="card bg-gradient-to-br from-brand-strong/30 to-transparent p-8">
            <UserCheck className="text-brand" size={28} />
            <h3 className="mt-4 text-2xl font-bold">For car owners</h3>
            <p className="mt-2 text-gray-400">Tired after a party, a long highway trip, or need a daily driver? Book a Saarthi.</p>
            <Link href="/login?as=customer" className="btn-brand mt-6">Book now <ArrowRight size={16} /></Link>
          </div>
          <div className="card bg-gradient-to-br from-pink/25 to-transparent p-8">
            <Wallet className="text-pink" size={28} />
            <h3 className="mt-4 text-2xl font-bold">For drivers</h3>
            <p className="mt-2 text-gray-400">Choose your hours, get trips near you, see every rupee you earn. Get verified and start.</p>
            <Link href="/login?as=driver" className="btn-ghost mt-6">Become a Saarthi <ArrowRight size={16} /></Link>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line py-8 text-sm text-gray-500">
          <Logo />
          <p className="flex items-center gap-2"><ShieldCheck size={14} /> Verified drivers · SOS on every trip · Emergency: 112</p>
          <p>© {new Date().getFullYear()} Saarthi</p>
        </footer>
      </div>
    </main>
  );
}
