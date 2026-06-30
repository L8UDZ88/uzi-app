"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo, Btn, Card } from "./ui";
import PostPreview from "./PostPreview";
import { pillarsFor, activeOutputs, aspectFor } from "@/lib/constants";

// Load an image (data URL) into an <img> we can draw to a canvas.
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

// Crisp-label composite: drop the REAL product PNG onto an AI background (no AI redraw),
// so the label stays pixel-perfect. Anchored bottom-center with a soft grounding shadow.
async function compositeProduct(bgUrl: string, productUrl: string, aspect?: string): Promise<string> {
  const [bg, pr] = await Promise.all([loadImg(bgUrl), loadImg(productUrl)]);
  const cw = bg.naturalWidth || 1024, ch = bg.naturalHeight || 1024;
  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return bgUrl;
  ctx.drawImage(bg, 0, 0, cw, ch);
  const targetH = ch * (aspect === "wide" ? 0.66 : 0.76);
  const scale = targetH / (pr.naturalHeight || targetH);
  const pw = (pr.naturalWidth || 1) * scale, ph = (pr.naturalHeight || 1) * scale;
  const x = (cw - pw) / 2;
  const y = ch - ph - ch * 0.05;
  // soft contact shadow on the "ground"
  ctx.save();
  ctx.filter = "blur(20px)";
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.beginPath();
  ctx.ellipse(cw / 2, y + ph - ph * 0.03, pw * 0.42, ph * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // gentle drop shadow so the can sits in the scene
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = ch * 0.02;
  ctx.shadowOffsetX = cw * 0.008;
  ctx.shadowOffsetY = ch * 0.012;
  ctx.drawImage(pr, x, y, pw, ph);
  ctx.restore();
  return canvas.toDataURL("image/png");
}

// POST + parse JSON with a hard timeout so a slow/hung server (e.g. a 504) can never freeze a button.
async function postJSON(url: string, body: any, timeoutMs = 60000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "POST", body: JSON.stringify(body), signal: ctrl.signal });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { error: res.ok ? "Unexpected response from server." : `Server error (${res.status}).` }; }
  } finally {
    clearTimeout(t);
  }
}

type Slot = { id: string; date: string; day: string; pillar: string; channel: string; format: string; glyph: string; status: string; city?: string | null; externalUrl?: string | null };
type Draft = { pillar: string; channel: string; headline: string; caption: string; hashtags: string[]; visualBrief: string; cta: string };

export default function Dashboard({ campaign, campaignId, slots: initial }: { campaign: any; campaignId: string; slots: Slot[] }) {
  const r = useRouter();
  const [tab, setTab] = useState("calendar");
  const [slots, setSlots] = useState<Slot[]>(initial);
  const [busy, setBusy] = useState(false);
  const [calFrom, setCalFrom] = useState(new Date().toISOString().slice(0, 10));
  const [calTo, setCalTo] = useState(new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10));
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
  const [music, setMusic] = useState<string | null>(null);
  const [musicBusy, setMusicBusy] = useState(false);
  const [editBrief, setEditBrief] = useState("");
  const [products, setProducts] = useState<{ id: string; name: string; kind?: string }[]>([]);
  const [productSel, setProductSel] = useState<string | null>(null);
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
    fetch(`/api/products?campaignId=${campaignId}`).then((x) => x.json()).then((d) => {
      const ps = d.products || []; setProducts(ps);
      const firstProduct = ps.find((p: any) => p.kind !== "logo");
      if (firstProduct) setProductSel(firstProduct.id);
    }).catch(() => {});
  }, [campaignId]);
  const productUrl = productSel ? `/api/product/${productSel}` : undefined;
  const productList = products.filter((p) => p.kind !== "logo");

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
    const res = await fetch(`/api/campaigns/${campaignId}/schedule`, { method: "POST", body: JSON.stringify({ from: calFrom, to: calTo }) });
    const d = await res.json();
    setSlots(d.slots || []);
    setSelected(new Set());
    setBusy(false);
  };
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = slots.length > 0 && selected.size === slots.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(slots.map((s) => s.id)));
  const delSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected post(s)? This can't be undone.`)) return;
    const ids = Array.from(selected);
    await fetch("/api/schedule/delete-many", { method: "POST", body: JSON.stringify({ campaignId, ids }) });
    setSlots(slots.filter((s) => !selected.has(s.id)));
    setSelected(new Set());
  };
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); r.push("/"); };

  const openSlot = async (s: Slot) => {
    setOpen(s); setDraft(null); setDraftLoading(true); setImage(null); setVo(null); setClips([]); setPicked(null); setVideoUrl(null); setVideoStatus(""); setMusic(null);
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
    setVideoBusy(true); setVideoUrl(null); setVideoStatus("preparing…");
    const aspect = aspectFor(open.channel, open.format);
    const pickedClip = clips.find((c: any) => c.id === picked)?.download || null;

    let renderBody: any;
    if (pickedClip) {
      // Optional stock-clip path (product overlaid).
      renderBody = { campaignId, text: draft.caption, brief: editBrief || draft.visualBrief, voice: voVoice, aspect, title: draft.headline, clipUrl: pickedClip, productId: productSel, musicUrl: music || undefined };
    } else {
      // Primary path: the on-brand still (product baked in) → animate it → render.
      let still = image;
      if (!still) {
        setVideoStatus("generating image…");
        const ir = await renderStill();
        if (ir.image) { still = ir.image; setImage(ir.image); }
        else { setVideoBusy(false); setVideoStatus(""); alert(ir.error || "Couldn't generate the image for the video."); return; }
      }
      // Try real motion (fal/Kling). If not enabled or it fails, fall back to the still + zoom.
      let animatedClip: string | undefined;
      try {
        setVideoStatus("animating…");
        const an = await (await fetch("/api/video/animate", { method: "POST", body: JSON.stringify({ campaignId, stillDataUrl: still, brief: editBrief || draft.visualBrief }) })).json();
        if (an.requestId) {
          for (let i = 0; i < 60 && !animatedClip; i++) {
            await new Promise((r) => setTimeout(r, 5000));
            const st = await (await fetch(`/api/video/animate?requestId=${encodeURIComponent(an.requestId)}`)).json();
            setVideoStatus(`animating… ${(st.status || "").toLowerCase()}`);
            if (st.videoUrl) animatedClip = st.videoUrl;
            else if (st.error) break;
          }
        }
      } catch { /* fall back to zoom */ }
      renderBody = animatedClip
        ? { campaignId, text: draft.caption, voice: voVoice, aspect, title: draft.headline, clipUrl: animatedClip, loopSeg: 10, musicUrl: music || undefined }
        : { campaignId, text: draft.caption, brief: editBrief || draft.visualBrief, voice: voVoice, aspect, title: draft.headline, stillDataUrl: still, musicUrl: music || undefined };
    }

    setVideoStatus("rendering…");
    const res = await fetch("/api/video/render", { method: "POST", body: JSON.stringify(renderBody) });
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
  const genMusic = async () => {
    if (!open) return;
    setMusicBusy(true); setMusic(null);
    try {
      const an = await (await fetch("/api/music", { method: "POST", body: JSON.stringify({ campaignId, mood: campaign.voice }) })).json();
      if (!an.requestId) { alert(an.error || "Couldn't start the music."); return; }
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const st = await (await fetch(`/api/music?requestId=${encodeURIComponent(an.requestId)}`)).json();
        if (st.audioUrl) { setMusic(st.audioUrl); return; }
        if (st.error) { alert(st.error); return; }
      }
      alert("Music is taking a while — try again.");
    } catch (e: any) {
      alert("Couldn't reach the music service — try again.");
    } finally {
      setMusicBusy(false);
    }
  };
  const exportStill = async () => {
    if (!open || !image) { alert("Generate a visual first."); return; }
    try {
      let href = image;
      if (!image.startsWith("data:")) href = URL.createObjectURL(await (await fetch(image)).blob());
      const a = document.createElement("a");
      a.href = href;
      a.download = `${(open.pillar || "post").replace(/\W+/g, "_")}_${open.channel}.png`;
      a.click();
    } catch {
      alert("Couldn't export — try regenerating the visual.");
    }
  };
  const delPost = async (id: string, e: any) => {
    e.stopPropagation();
    if (!confirm("Delete this post from the calendar?")) return;
    await fetch(`/api/schedule/${id}`, { method: "DELETE" });
    setSlots(slots.filter((s) => s.id !== id));
    if (open?.id === id) setOpen(null);
  };
  // Render the still: AI generates a clean SCENE (no can), then we composite the REAL product
  // PNG on top so the label stays pixel-perfect. No product selected → just the scene.
  const renderStill = async (): Promise<{ image?: string; error?: string }> => {
    if (!open || !draft) return { error: "Open a post first." };
    const aspect = aspectFor(open.channel, open.format);
    const d = await postJSON("/api/image", { campaignId, brief: editBrief || draft.visualBrief, aspect }, 90000);
    if (!d.image) return { error: d.error || "Couldn't generate the scene — try again." };
    if (!productSel) return { image: d.image };
    try {
      const pd = await (await fetch(`/api/products/${productSel}`)).json();
      if (!pd?.data) return { image: d.image };
      const composed = await compositeProduct(d.image, pd.data, aspect);
      return { image: composed };
    } catch {
      return { image: d.image }; // scene still usable if compositing fails
    }
  };
  const genImage = async () => {
    if (!open || !draft) return;
    setImgBusy(true);
    try {
      const r = await renderStill();
      if (r.image) setImage(r.image); else alert(r.error || "Couldn't generate an image — try again.");
    } catch (e: any) {
      alert(e?.name === "AbortError" ? "The image took too long and timed out — try again." : "Couldn't reach the image service — try again.");
    } finally {
      setImgBusy(false);
    }
  };
  const genVoice = async () => {
    if (!open || !draft) return;
    setVoBusy(true);
    try {
      const d = await postJSON("/api/voiceover", { campaignId, text: draft.caption, voice: voVoice }, 60000);
      if (d.audio) setVo(d.audio); else alert(d.error || "Couldn't generate voiceover.");
    } catch (e: any) {
      alert(e?.name === "AbortError" ? "The voiceover timed out — try again." : "Couldn't reach the voice service — try again.");
    } finally {
      setVoBusy(false);
    }
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
            <div className="mb-3 px-2 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-bold">Calendar · click a post to draft it</div>
                <Btn className="text-xs px-3 py-1.5" onClick={() => setTab("deliver")}>Auto-deliver ▶</Btn>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-zinc-500">From</span>
                <input type="date" value={calFrom} onChange={(e) => setCalFrom(e.target.value)} className="bg-zinc-800 rounded-lg px-2 py-1 text-zinc-200" />
                <span className="text-zinc-500">To</span>
                <input type="date" value={calTo} onChange={(e) => setCalTo(e.target.value)} className="bg-zinc-800 rounded-lg px-2 py-1 text-zinc-200" />
                <Btn kind="ghost" className="text-xs px-3 py-1.5" disabled={busy} onClick={regen}>{busy ? "Building…" : "Build calendar"}</Btn>
                <span className="text-zinc-600">up to 3 years</span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer text-zinc-400"><input type="checkbox" checked={allSelected} onChange={toggleAll} /> Select all ({slots.length})</label>
                {selected.size > 0 && <button onClick={delSelected} className="text-red-400 hover:text-red-300 font-semibold">Delete selected ({selected.size})</button>}
              </div>
            </div>
            <div className="max-h-[440px] overflow-auto divide-y divide-zinc-800">
              {slots.map((e) => (
                <div key={e.id} className="w-full flex items-center gap-3 py-2.5 px-2 text-sm hover:bg-zinc-800/50 rounded-lg transition">
                  <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleSel(e.id)} className="shrink-0" />
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
                <PostPreview channel={open.channel || "Instagram"} format={open.format} aspect={aspectFor(open.channel, open.format)} draft={draft} handle={campaign.handle} imageUrl={image || undefined} productUrl={productUrl} />
                {productList.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-zinc-500">Product:</span>
                    <button onClick={() => setProductSel(null)} className={`text-xs rounded-lg px-2 py-1 border ${!productSel ? "border-lime-400 text-accent" : "border-zinc-700 text-zinc-400"}`}>None</button>
                    {productList.map((p) => (
                      <button key={p.id} onClick={() => setProductSel(p.id)} className={`w-9 h-9 rounded-lg border overflow-hidden ${productSel === p.id ? "border-lime-400" : "border-zinc-700"}`} title={p.name}>
                        <img src={`/api/product/${p.id}`} alt="" className="w-full h-full object-contain" />
                      </button>
                    ))}
                  </div>
                )}
                {productList.length === 0 && <div className="text-[11px] text-zinc-600">Tip: upload your product (transparent PNG) in Edit setup → Inputs to render it into shots. Logos auto-infuse.</div>}
                <Btn kind="ghost" className="w-full text-sm" disabled={imgBusy} onClick={genImage}>{imgBusy ? "Generating visual…" : image ? "Regenerate visual ✨" : "Generate visual ✨"}</Btn>
                <div className="flex items-center gap-2">
                  <select value={voVoice} onChange={(e) => setVoVoice(e.target.value)} className="bg-zinc-800 rounded-lg text-xs px-2 py-2 max-w-[45%] truncate" title="Voice">
                    {(voices.length ? voices : ["alloy", "echo", "fable", "onyx", "nova", "shimmer"].map((v) => ({ id: v, name: v }))).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  <Btn kind="ghost" className="flex-1 text-sm" disabled={voBusy} onClick={genVoice}>{voBusy ? "Generating voiceover…" : vo ? "Regenerate voiceover 🎙" : "Generate voiceover 🎙"}</Btn>
                </div>
                {vo && <audio controls src={vo} className="w-full" />}
                {["reel", "story", "short", "video", "long"].includes((open.format || "").toLowerCase()) && (<>
                <div className="flex items-center gap-2">
                  <Btn kind="ghost" className="flex-1 text-sm" disabled={musicBusy} onClick={genMusic}>{musicBusy ? "Scoring…" : music ? "Re-score 🎵" : "Generate music 🎵"}</Btn>
                </div>
                {music && <audio controls src={music} className="w-full" />}
                <Btn className="w-full" disabled={videoBusy} onClick={genVideo}>{videoBusy ? `Working… ${videoStatus}` : videoUrl ? "Re-make video 🎬" : "Make video (image → motion) 🎬"}</Btn>
                <div className="text-[11px] text-zinc-600">Make video lays your voiceover + music over the visual (music ducked under the voice).</div>
                {videoUrl && (
                  <div className="space-y-1">
                    <video controls src={videoUrl} className="w-full rounded-xl bg-black" />
                    <a href={videoUrl} target="_blank" rel="noreferrer" className="text-xs text-accent underline">Open / download MP4 ↗</a>
                  </div>
                )}
                <details className="text-sm">
                  <summary className="text-xs text-zinc-500 cursor-pointer select-none">Optional: use a stock clip instead of the still 🎞</summary>
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
                    <div className="text-[11px] text-zinc-600">Click a clip to preview. Picked clips replace the still as the video base. Pexels — free, commercial-use.</div>
                  </div>
                </details>
                </>)}
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
                {image && <Btn kind="ghost" className="w-full text-sm" onClick={exportStill}>Export image (PNG) ⬇</Btn>}
                <div className="flex gap-2 pt-2">
                  <Btn kind="ghost" onClick={() => openSlot(open)}>Regenerate</Btn>
                  <Btn onClick={approve} className="flex-1">Approve ✓</Btn>
                </div>
                <div className="text-xs text-zinc-600">{image ? "Your real product is rendered into the scene. Edit the brief above and regenerate to change it, or pick a different product." : "Pick a product, then “Generate visual” renders a scene built around your real product (needs the OpenAI image key)."}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
