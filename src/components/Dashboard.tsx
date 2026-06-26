"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo, Btn, Card } from "./ui";
import PostPreview from "./PostPreview";
import { pillarsFor, CHANNELS } from "@/lib/constants";

type Slot = { id: string; date: string; day: string; pillar: string; channel: string; glyph: string; status: string };
type Draft = { pillar: string; channel: string; headline: string; caption: string; hashtags: string[]; visualBrief: string; cta: string };

export default function Dashboard({ campaign, campaignId, slots: initial }: { campaign: any; campaignId: string; slots: Slot[] }) {
  const r = useRouter();
  const [tab, setTab] = useState("calendar");
  const [slots, setSlots] = useState<Slot[]>(initial);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Slot | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);

  const PILLARS = pillarsFor(campaign.campaignType);
  const pillars = PILLARS.filter((p) => campaign.pillars?.[p.id]?.on ?? true);
  const chans = CHANNELS.filter((c) => campaign.channels?.[c.id]);

  const regen = async () => {
    setBusy(true);
    const res = await fetch(`/api/campaigns/${campaignId}/schedule`, { method: "POST" });
    const d = await res.json();
    setSlots((d.slots || []).map((s: any, i: number) => ({ ...s, id: initial[i]?.id || String(i), status: "queued" })));
    setBusy(false);
  };
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); r.push("/"); };

  const openSlot = async (s: Slot) => {
    setOpen(s); setDraft(null); setDraftLoading(true);
    const res = await fetch("/api/generate", { method: "POST", body: JSON.stringify({ campaignId, pillar: s.pillar, channel: s.channel }) });
    const d = await res.json();
    setDraft(d.draft); setDraftLoading(false);
  };
  const approve = async () => {
    if (!open) return;
    await fetch("/api/approve", { method: "POST", body: JSON.stringify({ id: open.id, status: "approved" }) });
    setSlots(slots.map((s) => (s.id === open.id ? { ...s, status: "approved" } : s)));
    setOpen(null);
  };

  return (
    <div>
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <Logo />
          <button onClick={() => r.push("/dashboard")} className="text-sm text-zinc-400 hover:text-zinc-200">← Campaigns</button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-300 font-semibold">{campaign.name || "Your campaign"}</span>
          <span className="text-xs bg-zinc-800 text-zinc-300 rounded-full px-2.5 py-1 capitalize">{campaign.campaignType}</span>
          <Btn kind="ghost" onClick={() => r.push(`/campaign/${campaignId}/setup`)}>Edit setup</Btn>
          <Btn kind="soft" onClick={logout}>Log out</Btn>
        </div>
      </nav>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid sm:grid-cols-4 gap-4 mb-8">
          <Card className="p-5"><div className="text-zinc-400 text-xs">Active pillars</div><div className="text-3xl font-black text-accent">{pillars.length}/7</div></Card>
          <Card className="p-5"><div className="text-zinc-400 text-xs">Channels</div><div className="text-3xl font-black">{chans.length}</div></Card>
          <Card className="p-5"><div className="text-zinc-400 text-xs">Cadence</div><div className="text-xl font-bold capitalize mt-1">{campaign.cadence}</div></Card>
          <Card className="p-5"><div className="text-zinc-400 text-xs">Approved</div><div className="text-3xl font-black">{slots.filter((s) => s.status === "approved").length}<span className="text-zinc-600 text-lg">/{slots.length}</span></div></Card>
        </div>
        <div className="flex gap-2 mb-4">
          {["calendar", "pillars", "channels"].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize ${tab === t ? "bg-accent text-zinc-950" : "bg-zinc-900 text-zinc-300 border border-zinc-800"}`}>{t}</button>
          ))}
        </div>

        {tab === "calendar" && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3 px-2">
              <div className="font-bold">Auto-built calendar · click any post to draft it</div>
              <div className="flex gap-2">
                <Btn kind="ghost" className="text-xs px-3 py-1.5" disabled={busy} onClick={regen}>{busy ? "Rebuilding…" : "Rebuild"}</Btn>
                <Btn className="text-xs px-3 py-1.5" onClick={() => alert("Phase 3: publishes approved posts to your connected channels on schedule.")}>Auto-deliver ▶</Btn>
              </div>
            </div>
            <div className="max-h-[440px] overflow-auto divide-y divide-zinc-800">
              {slots.map((e) => (
                <button key={e.id} onClick={() => openSlot(e)} className="w-full flex items-center gap-3 py-2.5 px-2 text-sm text-left hover:bg-zinc-800/50 rounded-lg transition">
                  <div className="w-20 text-zinc-500">{e.day} {e.date.slice(5)}</div>
                  <div className="w-8 text-center text-accent">{e.glyph}</div>
                  <div className="w-24 text-zinc-300">{e.channel}</div>
                  <div className="flex-1 text-zinc-100">{e.pillar}</div>
                  <span className={`text-xs rounded-full px-2 py-0.5 ${e.status === "approved" ? "bg-lime-400/20 text-accent" : "bg-zinc-800 text-zinc-400"}`}>{e.status}</span>
                </button>
              ))}
              {slots.length === 0 && <div className="text-zinc-500 text-sm p-6 text-center">No schedule yet — hit Rebuild.</div>}
            </div>
          </Card>
        )}
        {tab === "pillars" && (
          <div className="grid sm:grid-cols-2 gap-3">{pillars.map((p) => (
            <Card key={p.id} className="p-4"><div className="font-semibold">{p.id}. {p.name}</div><div className="text-zinc-400 text-sm">{p.desc}</div><div className="text-xs text-accent mt-2 capitalize">{campaign.pillars?.[p.id]?.freq || "weekly"}</div></Card>
          ))}</div>
        )}
        {tab === "channels" && (
          <div className="grid sm:grid-cols-3 gap-3">{CHANNELS.map((c) => (
            <Card key={c.id} className="p-4 flex items-center gap-3"><span className="text-xl text-accent">{c.glyph}</span><div><div className="font-semibold text-sm">{c.name}</div><div className="text-xs text-zinc-500">{campaign.channels?.[c.id] ? "Connected" : "Not connected"}</div></div></Card>
          ))}</div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex justify-end z-50" onClick={() => setOpen(null)}>
          <div className="bg-zinc-950 border-l border-zinc-800 w-full max-w-lg h-full overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-zinc-500">{open.day} {open.date} · {open.channel || "—"}</div>
                <div className="font-bold text-lg">{open.pillar}</div>
              </div>
              <button onClick={() => setOpen(null)} className="text-zinc-500 hover:text-zinc-200 text-xl">✕</button>
            </div>
            {draftLoading && <div className="text-zinc-500 mt-8">Drafting…</div>}
            {draft && (
              <div className="mt-5 space-y-4">
                <div className="text-xs text-zinc-500">Preview · how it'll post</div>
                <PostPreview channel={open.channel || "Instagram"} draft={draft} handle={campaign.handle} />
                <details className="text-sm">
                  <summary className="text-xs text-zinc-500 cursor-pointer select-none">Details (headline · visual brief · CTA)</summary>
                  <div className="mt-3 space-y-3">
                    <Card className="p-3"><div className="text-xs text-zinc-500 mb-1">Headline</div><div className="font-semibold text-zinc-100">{draft.headline}</div></Card>
                    <Card className="p-3"><div className="text-xs text-zinc-500 mb-1">Visual brief</div><div className="text-sm text-zinc-300">{draft.visualBrief}</div></Card>
                    <div className="text-xs text-zinc-500">CTA: {draft.cta}</div>
                  </div>
                </details>
                <div className="flex gap-2 pt-2">
                  <Btn kind="ghost" onClick={() => openSlot(open)}>Regenerate</Btn>
                  <Btn onClick={approve} className="flex-1">Approve ✓</Btn>
                </div>
                <div className="text-xs text-zinc-600">The image is a placeholder until the image generator is wired — caption &amp; layout are real.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
