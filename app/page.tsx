import Image from "next/image";

export default function HomePage() {
  return (
    <div className="min-h-screen text-white font-sans bg-gradient-to-b from-black via-emerald-950/40 to-black">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center gap-4">
          <Image src="/assets/crest_512.png" alt="EPLT crest" width={72} height={72} priority />
          <div>
            <div className="text-3xl font-extrabold tracking-tight">Elite Poker League Tool</div>
            <div className="text-sm opacity-75">League management software for game runners</div>
          </div>
        </div>

        <div className="mt-8 rounded-3xl bg-black/35 backdrop-blur-md border border-white/10 p-7">
          <div className="text-xs tracking-[0.25em] uppercase opacity-75">What it does</div>
          <div className="mt-3 text-lg leading-relaxed opacity-90">
            EPLT is built for the people who actually run the games. One place to manage players, leagues,
            and events — plus the time-sinks: communications, tracking entries, prize pools, payouts, and tournament clocks.
          </div>

          <ul className="mt-5 grid gap-3 text-base opacity-90 list-disc pl-6">
            <li><span className="font-semibold">Player management</span> (profiles, status, attendance, notes)</li>
            <li><span className="font-semibold">League + event organization</span> (group tournaments into seasons/leagues)</li>
            <li><span className="font-semibold">Tournament operations</span> (clock, levels, entries, prize pool + payouts)</li>
            <li><span className="font-semibold">Messaging</span> (planned: mass texts + segmented announcements)</li>
            <li><span className="font-semibold">Prizes</span> (planned: prize selection and redemption workflows)</li>
          </ul>

          <div className="mt-7 grid md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
              <div className="text-xs tracking-[0.25em] uppercase opacity-70">Tier 1</div>
              <div className="mt-2 text-2xl font-black">$9.99<span className="text-sm font-semibold opacity-75">/mo</span></div>
              <div className="mt-2 text-sm opacity-80">1 league • up to 100 players</div>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
              <div className="text-xs tracking-[0.25em] uppercase opacity-70">Tier 2</div>
              <div className="mt-2 text-2xl font-black">$19.99<span className="text-sm font-semibold opacity-75">/mo</span></div>
              <div className="mt-2 text-sm opacity-80">Up to 3 leagues • up to 500 total players</div>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
              <div className="text-xs tracking-[0.25em] uppercase opacity-70">Tier 3</div>
              <div className="mt-2 text-2xl font-black">$59.99<span className="text-sm font-semibold opacity-75">/mo</span></div>
              <div className="mt-2 text-sm opacity-80">Up to 25 leagues • up to 5,000 players</div>
            </div>
          </div>

          <div className="mt-7 text-sm opacity-80">
            <div className="font-semibold">Disclaimer</div>
            <div className="mt-1">
              EPLT is software for organizing league poker events. It does not provide legal advice and does not
              guarantee compliance with any laws or regulations. Game runners are responsible for operating within
              their local rules and requirements.
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="/demo/kiosk/clock/test123"
              className="rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-300/20 px-5 py-3 font-semibold"
            >
              View Demo Kiosk Clock
            </a>
            <a
              href="/admin/players"
              className="rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 px-5 py-3 font-semibold"
            >
              Admin Players
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
