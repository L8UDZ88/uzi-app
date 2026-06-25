import Link from "next/link";
import { Logo, Card } from "@/components/ui";
import { CHANNELS } from "@/lib/constants";

const steps = [
  ["01", "Input", "Connect your content drive or drop a weekly cornerstone asset."],
  ["02", "7 Pillars", "Set the parameters for each of the 7 content pillars, your way."],
  ["03", "Outputs", "Connect LinkedIn, YouTube, Instagram, Facebook, TikTok, Podcast."],
  ["04", "Calendar", "Uzi builds the calendar and auto-delivers on cadence."],
];

export default function Landing() {
  return (
    <div>
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <Logo />
        <div className="flex gap-3">
          <Link href="/login" className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-zinc-900 border border-zinc-800">Log in</Link>
          <Link href="/signup" className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-accent text-zinc-950">Get started</Link>
        </div>
      </nav>
      <header className="max-w-4xl mx-auto text-center px-6 pt-16 pb-10">
        <div className="inline-block text-xs font-semibold text-accent border border-lime-400/30 rounded-full px-3 py-1 mb-6">The content machine gun</div>
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.05]">One input.<br />Every channel. <span className="text-accent">On repeat.</span></h1>
        <p className="text-zinc-400 text-lg mt-6 max-w-2xl mx-auto">Connect your assets, set your 7 content pillars once, link your social accounts — Uzi builds the calendar and ships your brand across every channel, automatically.</p>
        <div className="flex gap-3 justify-center mt-8">
          <Link href="/signup" className="px-7 py-3 rounded-xl font-semibold bg-accent text-zinc-950">Start free</Link>
          <Link href="/login" className="px-7 py-3 rounded-xl font-semibold bg-zinc-900 border border-zinc-800">Log in</Link>
        </div>
      </header>
      <section className="max-w-6xl mx-auto px-6 grid sm:grid-cols-4 gap-4 pb-16">
        {steps.map(([n, t, d]) => (
          <Card key={n} className="p-5"><div className="text-accent font-black text-sm">{n}</div><div className="font-bold mt-1">{t}</div><div className="text-zinc-400 text-sm mt-1">{d}</div></Card>
        ))}
      </section>
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <Card className="p-6">
          <div className="text-zinc-400 text-sm font-medium mb-4">Outputs, every week</div>
          <div className="flex flex-wrap gap-3">{CHANNELS.map((c) => (
            <div key={c.id} className="flex items-center gap-2 bg-zinc-800/60 rounded-xl px-4 py-2"><span className="text-accent font-bold">{c.glyph}</span><span className="text-sm">{c.name}</span></div>
          ))}</div>
        </Card>
      </section>
    </div>
  );
}
