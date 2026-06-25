"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo, Btn, Card } from "./ui";
import { PILLARS, CHANNELS } from "@/lib/constants";

type Slot = { date: string; day: string; pillar: string; channel: string; glyph: string; status: string };

export default function Dashboard({ brand, slots: initial }: { brand: any; slots: Slot[] }) {
  const r = useRouter();
  const [tab, setTab] = useState("calendar");
  const [slots, setSlots] = useState<Slot[]>(initial);
  const [busy, setBusy] = useState(false);

  const pillars = PILLARS.filter((p) => brand.pillars?.[p.id]?.on ?? true);
  const chans = CHANNELS.filter((c) => brand.channels?.[c.id]);

  const regen = async () => {
    setBusy(true);
    const res = await fetch("/api/schedule", { method: "POST" });
    const d = await res.json();
    setSlots((d.slots || []).map((s: any) => ({ ...s, status: "queued" })));
    setBusy(false);
  };
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); r.push("/"); };

  return (
    <div>
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <Logo />
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400">{brand.name || "Your brand"}</span>
          <Btn kind="ghost" onClick={() => r.push("/onboarding")}>Edit setup</Btn>
          <Btn kind="soft" onClick={logout}>Log out</Btn>
        </div>
      </nav>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid sm:grid-cols-4 gap-4 mb-8">
          <Card className="p-5"><div className="text-zinc-400 text-xs">Active pillars</div><div className="text-3xl font-black text-accent">{pillars.length}/7</div></Card>
          <Card className="p-5"><div className="text-zinc-400 text-xs">Channels</div><div className="text-3xl font-black">{chans.length}</div></Card>
          <Card className="p-5"><div className="text-zinc-400 text-xs">Cadence</div><div className="text-xl font-bold capitalize mt-1">{brand.cadence}</div></Card>
          <Card className="p-5"><div className="text-zinc-400 text-xs">Scheduled (28d)</div><div className="text-3xl font-black">{slots.length}</div></Card>
        </div>
        <div className="flex gap-2 mb-4">
          {["calendar", "pillars", "channels"].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize ${tab === t ? "bg-accent text-zinc-950" : "bg-zinc-900 text-zinc-300 border border-zinc-800"}`}>{t}</button>
          ))}
        </div>

        {tab === "calendar" && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3 px-2">
              <div className="font-bold">Auto-built calendar · next 28 days</div>
              <div className="flex gap-2">
                <Btn kind="ghost" className="text-xs px-3 py-1.5" disabled={busy} onClick={regen}>{busy ? "Rebuilding…" : "Rebuild"}</Btn>
                <Btn className="text-xs px-3 py-1.5" onClick={() => alert("Phase 3: triggers generation + publishing to your connected channels.")}>Auto-deliver ▶</Btn>
              </div>
            </div>
            <div className="max-h-[440px] overflow-auto divide-y divide-zinc-800">
              {slots.map((e, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 px-2 text-sm">
                  <div className="w-20 text-zinc-500">{e.day} {e.date.slice(5)}</div>
                  <div className="w-8 text-center text-accent">{e.glyph}</div>
                  <div className="w-24 text-zinc-300">{e.channel}</div>
                  <div className="flex-1 text-zinc-100">{e.pillar}</div>
                  <span className="text-xs bg-zinc-800 rounded-full px-2 py-0.5 text-zinc-400">{e.status}</span>
                </div>
              ))}
              {slots.length === 0 && <div className="text-zinc-500 text-sm p-6 text-center">No schedule yet — hit Rebuild.</div>}
            </div>
          </Card>
        )}
        {tab === "pillars" && (
          <div className="grid sm:grid-cols-2 gap-3">{pillars.map((p) => (
            <Card key={p.id} className="p-4"><div className="font-semibold">{p.id}. {p.name}</div><div className="text-zinc-400 text-sm">{p.desc}</div><div className="text-xs text-accent mt-2 capitalize">{brand.pillars?.[p.id]?.freq || "weekly"}</div></Card>
          ))}</div>
        )}
        {tab === "channels" && (
          <div className="grid sm:grid-cols-3 gap-3">{CHANNELS.map((c) => (
            <Card key={c.id} className="p-4 flex items-center gap-3"><span className="text-xl text-accent">{c.glyph}</span><div><div className="font-semibold text-sm">{c.name}</div><div className="text-xs text-zinc-500">{brand.channels?.[c.id] ? "Connected" : "Not connected"}</div></div></Card>
          ))}</div>
        )}
      </div>
    </div>
  );
}
