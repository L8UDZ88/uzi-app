"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo, Btn, Card } from "./ui";
import PostPreview from "./PostPreview";
import { pillarsFor, activeOutputs, aspectFor } from "@/lib/constants";

type Slot = { id: string; date: string; day: string; pillar: string; channel: string; format: string; glyph: string; status: string; city?: string | null; externalUrl?: string | null };
type Draft = { pillar: string; channel: string; headline: string; caption: string; hashtags: string[]; visualBrief: string; cta: string };

export default function Dashboard({ campaign, campaignId, slots: initial }: { campaign: any; campaignId: string; slots: Slot[] }) {
  const r = useRouter();
  const [tab, setTab] = useState("calendar");
  const [slots, setSlots] = useState<Slot[]>(initial);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Slot | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [usedAI, setUsedAI] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [vo, setVo] = useState<string | null>(null);
  const [voBusy, setVoBusy] = useState(false);
  const [voVoice, setVoVoice] = useState("alloy");
  const [voices, setVoices] = useState<{ id: string; name: string }[]>([]);
  const [stockQ, setStockQ] = useState("");
  const [clips, setClips] = useState<any[]>([]);
  const [stockBusy, setStockBusy] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState("");
  const [editBrief, setEditBrief] = useState("");
  const [social, setSocial] = useState<any>({ platforms: [], autoDeliver: !!campaign.autoDeliver, linkedinConfigured: false });
  const [deliverBusy, setDeliverBusy] = useState(false);

  const PILLARS = pillarsFor(campaign.campaignType);
  const pillars = PILLARS.filter((p) => campaign.pillars?.[p.id]?.on ?? true);
  const outputs = activeOutputs(campaign.channels || {});

  useEffect(() => {
    fetch(`/api/social/status?campaignId=${campaignId}`).then((x) => x.json()).then(setSocial).catch(() => {});
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("social")) setTab("deliver");
  }, [campaignId]);

  useEffect(() => {
    fetch("/api/voiceover/voices").then((x) => x.json()).then((d) => {
      if (Array.isArray(d.voices) && d.voices.length) { setVoices(d.voices); setVoVoice(d.voices[0].id); }
    }).catch(() => {});
  }, []);

  const toggleAuto = async (on: boolean) => {
    setSocial({ ...social, autoDeliver: on });
    await fetch("/api/social/auto-deliver", { method: "POST", body: JSON.stringify({ campaignId, on }) });
  };
  const connectLinkedIn = () => { window.location.href = `/api/social/linkedin/auth?campaignId=${campaignId}`; };
  const deliverNow = async () => {
    setDeliverBusy(true);
    const d = await (await fetch("/api/social/run-now", { method: "POST", body: JSON.stringify({ campaignId }) })).json();
    setDeliverBusy(false);
    if (Array.isArray(d.items)) {
      const byId: Record<string, any> = {};
      d.items.forEach((it: any) => (byId[it.id] = it));
      setSlots(slots.map((s) => (byId[s.id] ? { ...s, status: byId[s.id].status, externalUrl: byId[s.id].externalUrl } : s)));
    }
    alert(`Delivered: ${d.published || 0} published · ${d.ready || 0} ready to post manually · ${d.failed || 0} failed.`);
  };

  const regen = async () => {
    setBusy(true);
    const res = await fetch(`/api/campaigns/${campaignId}/schedule`, { method: "POST" });
    const d = await res.json();
    setSlots((d.slots || []).map((s: any, i: number) => ({ ...s, id: initial[i]?.id || String(i), status: "queued" })));
    setBusy(false);
  };
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); r.push("/"); };

  const openSlot = async (s: Slot) => {
    setOpen(s); setDraft(null); setDraftLoading(true); setImage(null); setVo(null); setClips([]); setPicked(null); setVideoUrl(null); setVideoStatus("");
    const res = await fetch("/api/generate", { method: "POST", body: JSON.stringify({ campaignId, pillar: s.pillar, channel: s.channel, format: s.format, city: s.city }) });
    const d = await res.json();
    setDraft(d.draft); setUsedAI(!!d.usedAI); setDraftLoading(false);
    setEditBrief(d.draft?.visualBrief || "");
    const kw = String(d.draft?.visualBrief || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w: string) => w.length > 3).slice(0, 4).join(" ");
    setStockQ(kw || campaign.region || "");
  };
  const genStock = async () => {
    if (!open) return;
    setStockBusy(true);
    const orientation = aspectFor(open.channel, open.format) === "wide" ? "landscape" : "portrait";
    const res = await fetch("/api/stock/search", { method: "POST", body: JSON.stringify({ campaignId, query: stockQ, orientation }) });
    const d = await res.json();
    setStockBusy(false);
    if (Array.isArray(d.clips)) setClips(d.clips); else alert(d.error || "Couldn't search stock.");
  };
  const genVideo = async () => {
    if (!open || !draft) return;
    setVideoBusy(true); setVideoUrl(null); setVideoStatus("starting…");
    const pickedClip = clips.find((c: any) => c.id === picked)?.download || null;
    const aspect = aspectFor(open.channel, open.format);
    const res = await fetch("/api/video/render", { method: "POST", body: JSON.stringify({ campaignId, text: draft.caption, brief: editBrief || draft.visualBrief, voice: voVoice, clipUrl: pickedClip, aspect, title: draft.headline }) });
    const d = await res.json();
    if (!d.renderId) { setVideoBusy(false); setVideoStatus(""); alert(d.error || "Couldn't start render."); return; }
    let tries = 0;
    const poll = async () => {
      tries++;
      const s = await (await fetch(`/api/video/status?id=${d.renderId}`)).json();
      setVideoStatus(s.status || "rendering…");
      if (s.status === "done" && s.url) { setVideoUrl(s.url); setVideoBusy(false); return; }
      if (s.status === "failed" || s.error) { setVideoBusy(false); setVideoStatus(""); alert(s.error || "Render failed."); return; }
      if (tries > 50) { setVideoBusy(false); setVideoStatus(""); alert("Render is taking long — check back shortly."); return; }
      setTimeout(poll, 3000);
    };
    setTimeout(poll, 3000);
  };
  const delPost = async (id: string, e: any) => {
    e.stopPropagation();
    if (!confirm("Delete this post from the calendar?")) return;
    await fetch(`/api/schedule/${id}`, { method: "DELETE" });
    setSlots(slots.filter((s) => s.id !== id));
    if (open?.id === id) setOpen(null);
  };
  const genImage = async () => {
    if (!open || !draft) return;
    setImgBusy(true);
    const res = await fetch("/api/image", { method: "POST", body: JSON.stringify({ campaignId, brief: editBrief || draft.visualBrief, aspect: aspectFor(open.channel, open.format) }) });
    const d = await res.json();
    setImgBusy(false);
    if (d.image) setImage(d.image); else alert(d.error || "Couldn't generate an image.");
  };
  const genVoice = async () => {
    if (!open || !draft) return;
    setVoBusy(true);
    const res = await fetch("/api/voiceover", { method: "POST", body: JSON.stringify({ campaignId, text: draft.caption, voice: voVoice }) });
    const d = await res.json();
    setVoBusy(false);
    if (d.audio) setVo(d.audio); else alert(d.error || "Couldn't generate voiceover.");
  };
  const approve = async () => {
    if (!open || !draft) return;
    const cap = [draft.caption, (draft.hashtags || []).join(" ")].filter(Boolean).join("\n\n");
    await fetch("/api/approve", { method: "POST", body: JSON.stringify({ id: open.id, status: "approved", caption: cap, mediaUrl: image }) });
    setSlots(slots.map((s) => (s.id === open.id ? { ...s, status: "approved" } : s)));
    setOpen(null);
  };
  const statusStyle = (s: string) =>
    s === "published" ? "bg-emerald-400/20 text-emerald-300" :
    s === "approved" ? "bg-lime-400/20 text-accent" :
    s === "ready" ? "bg-amber-400/20 text-amber-300" :
    s === "failed" ? "bg-red-400/20 text-red-300" :
    "bg-zinc-800 text-zinc-400";

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
          <Card className="p-5"><div className="text-zinc-400 text-xs">Outputs</div><div className="text-3xl font-black">{outputs.length}</div></Card>
          <Card className="p-5"><div className="text-zinc-400 text-xs">Cadence</div><div className="text-xl font-bold capitalize mt-1">{campaign.cadence}</div></Card>
          <Card className="p-5"><div className="text-zinc-400 text-xs">Approved</div><div className="text-3xl font-black">{slots.filter((s) => s.status === "approved").length}<span className="text-zinc-600 text-lg">/{slots.length}</span></div></Card>
        </div>
        <div className="flex gap-2 mb-4">
          {["calendar", "pillars", "outputs", "deliver"].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize ${tab === t ? "bg-accent text-zinc-950" : "bg-zinc-900 text-zinc-300 border border-zinc-800"}`}>{t}</button>
          ))}
        </div>

        {tab === "calendar" && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3 px-2">
              <div className="font-bold">Auto-built calendar · click any post to draft it</div>
              <div className="flex gap-2">
                <Btn kind="ghost" className="text-xs px-3 py-1.5" disabled={busy} onClick={regen}>{busy ? "Rebuilding…" : "Rebuild"}</Btn>
                <Btn className="text-xs px-3 py-1.5" onClick={() => setTab("deliver")}>Auto-deliver ▶</Btn>
              </div>
            </div>
            <div className="max-h-[440px] overflow-auto divide-y divide-zinc-800">
              {slots.map((e) => (
                <div key={e.id} className="w-full flex items-center gap-3 py-2.5 px-2 text-sm hover:bg-zinc-800/50 rounded-lg transition">
                  <button onClick={() => openSlot(e)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                    <div className="w-20 text-zinc-500 shrink-0">{e.day} {e.date.slice(5)}</div>
                    <div className="w-8 text-center text-accent shrink-0">{e.glyph}</div>
                    <div className="w-28 text-zinc-300 truncate shrink-0">{e.channel}{e.format ? <span className="text-zinc-500"> · {e.format}</span> : null}</div>
                    <div className="flex-1 text-zinc-100 truncate">{e.city ? e.pillar.replace(/\[city\]/i, e.city) : e.pillar}</div>
                  </button>
                  <span className={`text-xs rounded-full px-2 py-0.5 shrink-0 ${statusStyle(e.status)}`}>{e.status}</span>
                  <button onClick={(ev) => delPost(e.id, ev)} className="text-zinc-600 hover:text-red-400 px-1.5 shrink-0" title="Delete post">✕</button>
                </div>
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
        {tab === "outputs" && (
          <div className="grid sm:grid-cols-3 gap-3">{outputs.map((o) => (
            <Card key={`${o.channelId}:${o.formatId}`} className="p-4 flex items-center gap-3"><span className="text-xl text-accent">{o.glyph}</span><div><div className="font-semibold text-sm">{o.channelName} · {o.formatName}</div><div className="text-xs text-zinc-500 capitalize">{o.aspect} placement</div></div></Card>
          ))}
          {outputs.length === 0 && <div className="text-zinc-500 text-sm p-2">No outputs connected yet — add some in Edit setup → Outputs.</div>}</div>
        )}
        {tab === "deliver" && (
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold">Auto-deliver</div>
                  <div className="text-zinc-400 text-sm">When on, approved posts publish automatically at their scheduled time (checked hourly).</div>
                </div>
                <button onClick={() => toggleAuto(!social.autoDeliver)} className={`w-12 h-7 rounded-full relative shrink-0 ${social.autoDeliver ? "bg-accent" : "bg-zinc-700"}`}>
                  <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-zinc-950 transition-all ${social.autoDeliver ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Btn className="text-sm" disabled={deliverBusy} onClick={deliverNow}>{deliverBusy ? "Delivering…" : "Deliver due posts now ▶"}</Btn>
                <span className="text-xs text-zinc-500">Publishes approved posts whose time has passed.</span>
              </div>
            </Card>

            <Card className="p-5">
              <div className="font-bold mb-1">Connected accounts</div>
              <div className="text-zinc-400 text-sm mb-4">Uzi publishes to the platforms this campaign posts to. Connect each account once.</div>
              <div className="grid sm:grid-cols-2 gap-3">
                {(social.platforms || []).map((p: any) => (
                  <div key={p.platform} className={`p-4 rounded-xl border ${p.connected ? "border-lime-400/50 bg-lime-400/5" : "border-zinc-800 bg-zinc-800/40"}`}>
                    <div className="flex items-center justify-between">
                      <div className="font-semibold capitalize">{p.platform}</div>
                      {p.connected
                        ? <span className="text-[10px] bg-emerald-400/20 text-emerald-300 rounded-full px-2 py-0.5">Connected</span>
                        : p.ready
                          ? <span className="text-[10px] bg-zinc-800 text-zinc-400 rounded-full px-2 py-0.5">Not connected</span>
                          : <span className="text-[10px] bg-amber-400/20 text-amber-300 rounded-full px-2 py-0.5">Pending API approval</span>}
                    </div>
                    {p.connected && p.displayName && <div className="text-xs text-zinc-500 mt-1">{p.displayName}</div>}
                    {!p.connected && p.platform === "linkedin" && social.linkedinConfigured && (
                      <button onClick={connectLinkedIn} className="mt-3 bg-accent text-zinc-950 font-semibold text-xs rounded-lg px-3 py-1.5">Connect LinkedIn</button>
                    )}
                    {!p.connected && p.platform === "linkedin" && !social.linkedinConfigured && (
                      <div className="text-xs text-zinc-500 mt-2">Add LinkedIn API keys in Vercel to enable.</div>
                    )}
                    {!p.connected && p.platform !== "linkedin" && (
                      <div className="text-xs text-zinc-500 mt-2">Publishing for {p.platform} unlocks once its API app is approved. Posts stay “ready” to publish manually until then.</div>
                    )}
                  </div>
                ))}
                {(social.platforms || []).length === 0 && <div className="text-zinc-500 text-sm">Add outputs in Edit setup → Outputs to see platforms here.</div>}
              </div>
            </Card>

            <div className="text-xs text-zinc-600">LinkedIn publishes today. Instagram, Facebook, YouTube, TikTok and X each need their own API app review before auto-posting — until then those posts are marked <span className="text-amber-300">ready</span> so you can post them manually in one click.</div>
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex justify-end z-50" onClick={() => setOpen(null)}>
          <div className="bg-zinc-950 border-l border-zinc-800 w-full max-w-lg h-full overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-zinc-500">{open.day} {open.date} · {open.channel || "—"}{open.format ? ` · ${open.format}` : ""}</div>
                <div className="font-bold text-lg">{open.city ? open.pillar.replace(/\[city\]/i, open.city) : open.pillar}</div>
              </div>
              <button onClick={() => setOpen(null)} className="text-zinc-500 hover:text-zinc-200 text-xl">✕</button>
            </div>
            {draftLoading && <div className="text-zinc-500 mt-8">Drafting…</div>}
            {draft && (
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-zinc-500">Preview · how it'll post</div>
                  <span className={`text-[10px] rounded-full px-2 py-0.5 ${usedAI ? "bg-lime-400/20 text-accent" : "bg-zinc-800 text-zinc-400"}`}>{usedAI ? "✨ AI copy" : "Template copy"}</span>
                </div>
                <PostPreview channel={open.channel || "Instagram"} format={open.format} aspect={aspectFor(open.channel, open.format)} draft={draft} handle={campaign.handle} imageUrl={image || undefined} />
                <Btn kind="ghost" className="w-full text-sm" disabled={imgBusy} onClick={genImage}>{imgBusy ? "Generating visual…" : image ? "Regenerate visual ✨" : "Generate visual ✨"}</Btn>
                <div className="flex items-center gap-2">
                  <select value={voVoice} onChange={(e) => setVoVoice(e.target.value)} className="bg-zinc-800 rounded-lg text-xs px-2 py-2 max-w-[45%] truncate" title="Voice">
                    {(voices.length ? voices : ["alloy", "echo", "fable", "onyx", "nova", "shimmer"].map((v) => ({ id: v, name: v }))).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  <Btn kind="ghost" className="flex-1 text-sm" disabled={voBusy} onClick={genVoice}>{voBusy ? "Generating voiceover…" : vo ? "Regenerate voiceover 🎙" : "Generate voiceover 🎙"}</Btn>
                </div>
                {vo && <audio controls src={vo} className="w-full" />}
                <details className="text-sm">
                  <summary className="text-xs text-zinc-500 cursor-pointer select-none">Stock footage 🎞</summary>
                  <div className="mt-2 space-y-2">
                    <div className="flex gap-2">
                      <input value={stockQ} onChange={(e) => setStockQ(e.target.value)} placeholder="Search clips…" className="flex-1 bg-zinc-800 rounded-lg px-3 py-2 text-sm" />
                      <Btn kind="ghost" className="text-sm" disabled={stockBusy} onClick={genStock}>{stockBusy ? "Searching…" : "Find"}</Btn>
                    </div>
                    {clips.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 max-h-56 overflow-auto">
                        {clips.map((c) => (
                          <a key={c.id} href={c.download} target="_blank" rel="noreferrer" onClick={() => setPicked(c.id)} className={`relative block rounded-lg overflow-hidden border ${picked === c.id ? "border-lime-400" : "border-zinc-800"}`}>
                            <img src={c.thumb} alt="" className="w-full h-20 object-cover" />
                            <span className="absolute bottom-1 right-1 text-[10px] bg-black/70 text-white rounded px-1">{Math.round(c.duration)}s</span>
                          </a>
                        ))}
                      </div>
                    )}
                    <div className="text-[11px] text-zinc-600">Click a clip to preview. Picked clips feed the video render. Pexels — free, commercial-use.</div>
                  </div>
                </details>
                <Btn className="w-full" disabled={videoBusy} onClick={genVideo}>{videoBusy ? `Rendering… ${videoStatus}` : videoUrl ? "Re-render video 🎬" : "Generate video 🎬"}</Btn>
                {videoUrl && (
                  <div className="space-y-1">
                    <video controls src={videoUrl} className="w-full rounded-xl bg-black" />
                    <a href={videoUrl} target="_blank" rel="noreferrer" className="text-xs text-accent underline">Open / download MP4 ↗</a>
                  </div>
                )}
                <details className="text-sm">
                  <summary className="text-xs text-zinc-500 cursor-pointer select-none">Details (headline · visual brief · CTA)</summary>
                  <div className="mt-3 space-y-3">
                    <Card className="p-3"><div className="text-xs text-zinc-500 mb-1">Headline</div><div className="font-semibold text-zinc-100">{draft.headline}</div></Card>
                    <Card className="p-3">
                      <div className="text-xs text-zinc-500 mb-1">Visual brief — edit this, then “Generate visual / video” uses your version</div>
                      <textarea value={editBrief} onChange={(e) => setEditBrief(e.target.value)} rows={3} className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100" />
                    </Card>
                    <div className="text-xs text-zinc-500">CTA: {draft.cta}</div>
                  </div>
                </details>
                <div className="flex gap-2 pt-2">
                  <Btn kind="ghost" onClick={() => openSlot(open)}>Regenerate</Btn>
                  <Btn onClick={approve} className="flex-1">Approve ✓</Btn>
                </div>
                <div className="text-xs text-zinc-600">{image ? "AI scene draft — composite your real product on top before publishing (the brand never lets AI redraw the product)." : "Caption & layout are real. Click “Generate visual” to render a scene from the brief (needs the image key in Vercel)."}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
