import Link from "next/link";
import { ShieldCheck, MapPin, Clock, IndianRupee, KeyRound, Star } from "lucide-react";
import { Logo } from "@/components/Shell";

const features = [
  { icon: MapPin, title: "Nearest driver first", text: "Live map shows verified drivers around you, sorted by distance." },
  { icon: IndianRupee, title: "Price before you book", text: "Fare is calculated on the server and shown up front. No surprises." },
  { icon: KeyRound, title: "Start with your code", text: "The trip starts only when you give your 4-digit code to the driver." },
  { icon: ShieldCheck, title: "Verified drivers", text: "Licence and experience checked by our team before a driver goes live." },
  { icon: Clock, title: "Hourly to outstation", text: "City hours, one-way drop, round trip or a long highway drive." },
  { icon: Star, title: "Rated every trip", text: "Customers rate each trip, so the best drivers rise to the top." },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4">
      <header className="flex items-center justify-between py-5">
        <Logo />
        <Link href="/login" className="btn-ghost text-sm">Sign in</Link>
      </header>

      <section className="grid items-center gap-10 py-16 md:grid-cols-2">
        <div>
          <p className="mb-4 inline-block rounded-full border border-gold/40 px-3 py-1 text-xs text-gold">
            Now in Solapur · Pune · Mumbai
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            Your car.<br /><span className="text-gold">A trusted driver</span><br />in minutes.
          </h1>
          <p className="mt-5 max-w-md text-lg text-gray-400">
            Saarthi connects car owners with verified, nearby drivers — for an hour, a day or an outstation trip.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login?as=customer" className="btn-gold">Book a driver</Link>
            <Link href="/login?as=driver" className="btn-ghost">Drive with Saarthi</Link>
          </div>
        </div>
        <div className="card relative overflow-hidden">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold/20 blur-3xl" />
          <p className="label">Example fare · Hourly</p>
          <div className="mt-3 space-y-3 text-sm">
            {[["First 2 hours", "₹199"], ["Each extra hour", "₹70"], ["Night (10 pm – 6 am)", "+20%"], ["Driver pickup beyond 2 km", "₹10/km"]].map(([a, b]) => (
              <div key={a} className="flex justify-between border-b border-line pb-2"><span className="text-gray-400">{a}</span><span className="font-semibold">{b}</span></div>
            ))}
          </div>
          <p className="mt-4 text-xs text-gray-500">Prices are set by the admin and calculated by the server.</p>
        </div>
      </section>

      <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, text }) => (
          <div key={title} className="card">
            <Icon className="text-gold" size={22} />
            <h3 className="mt-3 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-gray-400">{text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
