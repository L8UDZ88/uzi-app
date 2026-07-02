"use client";
import { useState, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Logo, Btn, Card } from "./ui";
import PostPreview from "./PostPreview";
import Wizard from "./Wizard";
import { pillarsFor, aspectFor } from "@/lib/constants";
import { arcFor } from "@/lib/beats";
import { isGrowFastBrand } from "@/lib/presets";
import { routePost, routeReady } from "@/lib/route";

// Hard-cap the spoken voiceover script to ~20 seconds (≈230 chars), trimmed at a clean sentence
// boundary. Ambient Film is exempt (it's meant to run long). This bounds the video length no
// matter how long the AI copy comes back.
function shortScript(text: string, isFilm: boolean): string {
  const t = (text || "").replace(/#[^\s#]+/g, "").replace(/\s+/g, " ").trim();
  if (isFilm || t.length <= 230) return t;
  const slice = t.slice(0, 230);
  const end = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  if (end > 110) return slice.slice(0, end + 1).trim();
  const sp = slice.lastIndexOf(" ");
  return (sp > 110 ? slice.slice(0, sp) : slice).trim() + ".";
}

// Measure an audio asset's real duration (seconds) so the video can be sized to fit it.
function measureAudio(src: string): Promise<number> {
  return new Promise((res) => {
    try {
      const a = new Audio();
      a.preload = "metadata";
      a.onloadedmetadata = () => res(isFinite(a.duration) ? a.duration : 0);
      a.onerror = () => res(0);
      a.src = src;
    } catch { res(0); }
  });
}

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
  // Size the can to sit IN the scene, not dominate it. Anchored low so it rests on a surface.
  const targetH = ch * (aspect === "wide" ? 0.52 : 0.6);
  const scale = targetH / (pr.naturalHeight || targetH);
  const pw = (pr.naturalWidth || 1) * scale, ph = (pr.naturalHeight || 1) * scale;
  const x = (cw - pw) / 2;
  const y = ch - ph - ch * 0.1;
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

// Composite the brand logo cleanly into the BOTTOM-RIGHT corner — fitted, legible, with a soft
// scrim behind it so it reads on any background. Deterministic (not AI), so it's never smeared.
async function compositeLogo(bgUrl: string, logoUrl: string): Promise<string> {
  try {
    const [bg, lg] = await Promise.all([loadImg(bgUrl), loadImg(logoUrl)]);
    const cw = bg.naturalWidth || 1024, ch = bg.naturalHeight || 1024;
    const canvas = document.createElement("canvas");
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return bgUrl;
    ctx.drawImage(bg, 0, 0, cw, ch);
    // Logo sized to ~16% of width, capped height; padded from the corner.
    const targetW = cw * 0.16;
    const scale = targetW / (lg.naturalWidth || targetW);
    const lw = (lg.naturalWidth || 1) * scale;
    const lh = (lg.naturalHeight || 1) * scale;
    const pad = cw * 0.035;
    const x = cw - lw - pad;
    const y = ch - lh - pad;
    // subtle dark scrim rounded behind the logo for legibility on busy scenes
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    const m = lw * 0.18;
    const rx = x - m, ry = y - m, rw = lw + m * 2, rh = lh + m * 2, r = Math.min(rw, rh) * 0.22;
    ctx.beginPath();
    ctx.moveTo(rx + r, ry);
    ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, r);
    ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, r);
    ctx.arcTo(rx, ry + rh, rx, ry, r);
    ctx.arcTo(rx, ry, rx + rw, ry, r);
    ctx.fill();
    ctx.restore();
    ctx.drawImage(lg, x, y, lw, lh);
    return canvas.toDataURL("image/png");
  } catch {
    return bgUrl;
  }
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

type Slot = { id: string; date: string; day: string; pillar: string; channel: string; format: string; glyph: string; status: string; city?: string | null; externalUrl?: string | null; beat?: string | null; beatName?: string | null; phase?: string | null; loop?: number | null; caption?: string | null; mediaUrl?: string | null; time?: string | null; groupIds?: string[] };
type Draft = { pillar: string; channel: string; headline: string; caption: string; hashtags: string[]; visualBrief: string; cta: string; script?: string };

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
  const [itVoices, setItVoices] = useState<any[]>([]);     // Italian shared-library voices to audition
  const [itLoading, setItLoading] = useState(false);
  const [addingVoice, setAddingVoice] = useState("");
  const [driveMedia, setDriveMedia] = useState<any[]>([]);   // real photos/footage from the Drive folder
  const [mediaLoading, setMediaLoading] = useState(false);
  const [realClip, setRealClip] = useState<string | null>(null); // picked real footage (video) URL
  // Splice-from-library state (Phase 2): pick a video from the Video library, transcribe, auto-pick a moment, trim.
  const [spliceMedia, setSpliceMedia] = useState<any[]>([]);
  const [spliceLoading, setSpliceLoading] = useState(false);
  const [spliceOpen, setSpliceOpen] = useState(false);
  const [spliceFile, setSpliceFile] = useState<any | null>(null);
  const [splicePlan, setSplicePlan] = useState<any | null>(null); // {start,end,total,caption,why,source,transcript}
  const [spliceBusy, setSpliceBusy] = useState("");
  const [spliceCaps, setSpliceCaps] = useState(false);
  const [spliceKind, setSpliceKind] = useState<"video" | "audio">("video");
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
  const [editScript, setEditScript] = useState("");   // editable voiceover script
  const [editMusic, setEditMusic] = useState("");      // music direction: genre · mood · energy
  const [noVo, setNoVo] = useState(false);             // explicit "no voiceover" decision
  const [noMusic, setNoMusic] = useState(false);       // explicit "no music" decision
  const [voSeconds, setVoSeconds] = useState(0);       // real voiceover duration (for video length)
  const [musicSeconds, setMusicSeconds] = useState(0); // real music duration
  const [products, setProducts] = useState<{ id: string; name: string; kind?: string }[]>([]);
  const [productSel, setProductSel] = useState<string | null>(null);
  const [sceneStyle, setSceneStyle] = useState<"hero" | "lifestyle">("hero");
  const [trailer, setTrailer] = useState<any>(null);
  const [trailerBusy, setTrailerBusy] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoMsg, setAutoMsg] = useState("");
  const [approveBusy, setApproveBusy] = useState(false);
  const [stillsBusy, setStillsBusy] = useState(false);
  const [stillsMsg, setStillsMsg] = useState("");
  const [preview, setPreview] = useState<Slot | null>(null); // Deliver: enlarged final-review preview
  const isVideoUrl = (u?: string | null) => !!u && !u.startsWith("data:image") && /(mp4|\.mov|shotstack|\/render)/i.test(u);
  const [social, setSocial] = useState<any>({ platforms: [], autoDeliver: !!campaign.autoDeliver, linkedinConfigured: false });
  const [deliverBusy, setDeliverBusy] = useState(false);

  const PILLARS = pillarsFor(campaign.campaignType);
  const pillars = PILLARS.filter((p) => campaign.pillars?.[p.id]?.on ?? true);

  useEffect(() => {
    fetch(`/api/social/status?campaignId=${campaignId}`).then((x) => x.json()).then(setSocial).catch(() => {});
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("social")) setTab("deliver");
  }, [campaignId]);

  useEffect(() => { if (tab === "trailer" && !trailer) loadTrailer(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // Group actions: a pillar fires once/day to N channels — treat those N as one reviewable group.
  const toggleGroup = (ids: string[]) => setSelected((s) => { const n = new Set(s); const all = ids.every((id) => n.has(id)); ids.forEach((id) => (all ? n.delete(id) : n.add(id))); return n; });
  const delGroup = async (ids: string[]) => {
    await fetch("/api/schedule/delete-many", { method: "POST", body: JSON.stringify({ campaignId, ids }) });
    setSlots(slots.filter((s) => !ids.includes(s.id)));
    setSelected((s) => { const n = new Set(s); ids.forEach((id) => n.delete(id)); return n; });
  };
  const openGroup = (g: any) => openSlot({ ...g.items[0], groupIds: g.items.map((x: any) => x.id) });
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); r.push("/"); };

  const openSlot = async (s: Slot) => {
    setOpen(s); setDraft(null); setDraftLoading(true); setImage(null); setVo(null); setClips([]); setPicked(null); setVideoUrl(null); setVideoStatus(""); setMusic(null);
    setNoVo(false); setNoMusic(false); setVoSeconds(0); setMusicSeconds(0); setRealClip(null);
    setSpliceOpen(false); setSpliceFile(null); setSplicePlan(null); setSpliceBusy(""); setSpliceCaps(false); setSpliceKind("video"); setSpliceMedia([]); setEditMusic("");
    if (pillarSource(s.pillar) === "real") loadMedia();
    if (isLongform(s)) { setSpliceOpen(true); setSpliceKind("video"); loadSplice("video"); } // long-form uses your uploaded video
    if (aspectFor(s.channel, s.format) === "audio") { setSpliceOpen(true); setSpliceKind("audio"); loadSplice("audio"); } // Spotify/Podcast → audio library
    loadItalian(); // populate Italian voices into the VO dropdown
    const res = await fetch("/api/generate", { method: "POST", body: JSON.stringify({ campaignId, pillar: s.pillar, channel: s.channel, format: s.format, city: s.city, beat: s.beat, loop: s.loop }) });
    const d = await res.json();
    setDraft(d.draft); setUsedAI(!!d.usedAI); setDraftLoading(false);
    setEditBrief(d.draft?.visualBrief || "");
    // Voiceover reads the SAME copy as the description (caption). Hashtags stripped; capped for length.
    const isFilm = /ambient|brand film|\bfilm\b|vision/i.test(s.pillar || "");
    setEditScript(shortScript(d.draft?.caption || "", isFilm));
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
    // Audio is already decided before we get here (gated). Pass the REAL pieces + their measured
    // durations so the render sizes the video to the audio instead of guessing.
    const audio = {
      voDataUrl: noVo ? undefined : (vo || undefined),
      voSeconds: noVo ? 0 : voSeconds,
      noVo,
      musicUrl: noMusic ? undefined : (music || undefined),
      musicSeconds: noMusic ? 0 : musicSeconds,
    };

    const isReal = pillarSource(open.pillar) === "real";
    let renderBody: any;
    if (realClip) {
      // Real footage from the connected folder — use it directly. No AI, no product overlay.
      const clipSeconds = await measureAudio(realClip);
      renderBody = { campaignId, aspect, clipUrl: realClip, clipSeconds, ...audio };
    } else if (pickedClip) {
      // Optional stock-clip path (product overlaid). Pass the clip's real duration so the render
      // slows it to fill the length instead of looping/freezing.
      const pickedDur = clips.find((c: any) => c.id === picked)?.duration || 0;
      renderBody = { campaignId, brief: editBrief || draft.visualBrief, aspect, clipUrl: pickedClip, clipSeconds: pickedDur, productId: productSel, ...audio };
    } else {
      // Primary path: the on-brand still (product baked in) → animate it → render.
      let still = image;
      if (!still) {
        setVideoStatus("generating image…");
        const ir = await renderStill();
        if (ir.image) { still = ir.image; setImage(ir.image); }
        else { setVideoBusy(false); setVideoStatus(""); alert(ir.error || "Couldn't generate the image for the video."); return; }
      }
      // Generative motion (fal/Kling) so the WORLD moves — people, water, light, atmosphere —
      // while the product stays locked. The animate prompt pins the can so its label survives.
      // If Kling isn't available it falls back to the still + slow push-in.
      let animatedClip: string | undefined;
      if (!isReal) try {
        setVideoStatus("animating…");
        const an = await (await fetch("/api/video/animate", { method: "POST", body: JSON.stringify({ campaignId, stillDataUrl: still, brief: editBrief || draft.visualBrief, sceneStyle }) })).json();
        if (an.requestId) {
          for (let i = 0; i < 60 && !animatedClip; i++) {
            await new Promise((r) => setTimeout(r, 5000));
            const st = await (await fetch(`/api/video/animate?requestId=${encodeURIComponent(an.requestId)}`)).json();
            setVideoStatus(`animating… ${(st.status || "").toLowerCase()}`);
            if (st.videoUrl) animatedClip = st.videoUrl;
            else if (st.error) break;
          }
        }
      } catch { /* fall back to still push-in */ }
      if (animatedClip) {
        // Measure the generated clip so the render slows it to fill the full length (no loop).
        const clipSeconds = await measureAudio(animatedClip);
        renderBody = { campaignId, aspect, clipUrl: animatedClip, clipSeconds, ...audio };
      } else {
        renderBody = { campaignId, brief: editBrief || draft.visualBrief, aspect, stillDataUrl: still, ...audio };
      }
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
    setMusicBusy(true); setMusic(null); setNoMusic(false);
    try {
      // Size the score to the voiceover (+buffer) so it's a single track LONGER than the VO.
      const target = voSeconds ? Math.ceil(voSeconds) + 3 : 30;
      const an = await postJSON("/api/music", { campaignId, mood: editMusic.trim() || campaign.voice, seconds: target }, 90000);
      if (an.audioUrl) { setMusic(an.audioUrl); setMusicSeconds(await measureAudio(an.audioUrl)); } else alert(an.error || "Couldn't generate music — try again.");
    } catch (e: any) {
      alert(e?.name === "AbortError" ? "The music timed out — try again." : "Couldn't reach the music service — try again.");
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
    const briefText = editBrief || draft.visualBrief;
    // No product → plain scene (Flux). Composite the brand logo cleanly bottom-right.
    if (!productSel) {
      const d = await postJSON("/api/image", { campaignId, brief: briefText, aspect }, 90000);
      if (!d.image) return { error: d.error || "Couldn't generate the scene — try again." };
      const logo = products.find((p) => p.kind === "logo");
      if (logo) { const composed = await compositeLogo(d.image, `/api/product/${logo.id}`); return { image: composed }; }
      return { image: d.image };
    }
    // Lifestyle → product integrated into a people/usage scene (Nano Banana, or gpt fallback).
    if (sceneStyle === "lifestyle") {
      const d = await postJSON("/api/image", { campaignId, brief: briefText, aspect, productId: productSel, style: "lifestyle" }, 90000);
      return d.image ? { image: d.image } : { error: d.error || "Couldn't generate the image — try again." };
    }
    // Hero → Nano Banana integrates the real can (label kept). If FAL isn't set, the server
    // returns a product-free backdrop and we composite the real can in the browser.
    const d = await postJSON("/api/image", { campaignId, brief: briefText, aspect, productId: productSel, style: "hero" }, 90000);
    if (!d.image) return { error: d.error || "Couldn't generate the scene — try again." };
    if (!d.backdrop) return { image: d.image }; // already integrated server-side
    try {
      const pd = await (await fetch(`/api/products/${productSel}`)).json();
      if (!pd?.data) return { image: d.image };
      const composed = await compositeProduct(d.image, pd.data, aspect);
      return { image: composed };
    } catch {
      return { image: d.image }; // backdrop still usable if compositing fails
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
  // Is this post's pillar set to use REAL footage (vs AI)? Honors the per-pillar override.
  const pillarSource = (pillarName: string): string => {
    const p = pillarsFor(campaign.campaignType).find((x) => x.name === pillarName);
    if (!p) return "ai";
    const pc = (campaign.pillars || {})[p.id] || {};
    return pc.source ?? (p as any).source ?? "ai";
  };
  // Long-form video is never AI — it comes from an uploaded webcam/screen-share clip in the library.
  const isLongform = (s: any) => !!s && (/long/i.test(s.format || "") || aspectFor(s.channel || "", s.format || "") === "wide");
  const loadMedia = async () => {
    if (driveMedia.length || mediaLoading) return;
    setMediaLoading(true);
    try {
      const d = await (await fetch(`/api/google/media?campaignId=${campaignId}`)).json();
      if (Array.isArray(d.media)) setDriveMedia(d.media);
      if (d.error && !(d.media || []).length) alert(d.error);
    } catch { /* ignore */ } finally { setMediaLoading(false); }
  };
  const pickMedia = async (m: any) => {
    const url = `/api/google/file/${m.id}?campaignId=${campaignId}`;
    if (m.kind === "video") {
      setRealClip(url); setImage(null);
    } else {
      try {
        const blob = await (await fetch(url)).blob();
        const dataUrl: string = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(blob); });
        setImage(dataUrl); setRealClip(null);
      } catch { alert("Couldn't load that photo — try another."); }
    }
  };
  // The channel-native format id for the current post (drives clip length + aspect).
  const channelFormatId = () => {
    const a = aspectFor(open?.channel || "", open?.format || "");
    return a === "wide" ? "long" : a === "feed" || a === "carousel" ? "feed" : "reel";
  };
  const openSplice = (kind: "video" | "audio") => {
    if (spliceOpen && spliceKind === kind) { setSpliceOpen(false); return; }
    setSpliceKind(kind); setSpliceOpen(true); setSpliceFile(null); setSplicePlan(null); setSpliceMedia([]);
    loadSplice(kind);
  };
  const loadSplice = async (kind: "video" | "audio") => {
    setSpliceLoading(true);
    try {
      const d = await (await fetch(`/api/google/media?campaignId=${campaignId}&slot=${kind}`)).json();
      if (Array.isArray(d.media)) setSpliceMedia(d.media.filter((m: any) => m.kind === kind));
      if (d.error && !(d.media || []).length) alert(d.error);
    } catch { /* ignore */ } finally { setSpliceLoading(false); }
  };
  // Pick a library video → transcribe (cached) → auto-pick the best moment + aligned caption.
  const pickSplice = async (m: any) => {
    setSpliceFile(m); setSplicePlan(null); setSpliceBusy("Transcribing…");
    try {
      const t = await postJSON("/api/transcribe", { campaignId, fileId: m.id, fileName: m.name, mimeType: m.mimeType }, 120000);
      if (t.error) { setSpliceBusy(""); alert(t.error); return; }
      setSpliceBusy("Finding the best moment…");
      const p = await postJSON("/api/splice/plan", { campaignId, fileId: m.id, format: spliceKind === "audio" ? "audio" : channelFormatId(), pillar: open?.pillar, beat: open?.beat }, 60000);
      if (p.error) { setSpliceBusy(""); alert(p.error); return; }
      setSplicePlan({ ...p.plan, total: p.total, transcript: p.transcript });
      if (p.plan?.caption) setDraft((d) => (d ? { ...d, caption: p.plan.caption } : d));
      setSpliceBusy("");
    } catch { setSpliceBusy(""); alert("Splice failed — try again."); }
  };
  // Render the trimmed clip (optional burned captions), then poll for the MP4.
  const makeSplice = async () => {
    if (!spliceFile || !splicePlan) return;
    setVideoBusy(true); setVideoStatus(spliceKind === "audio" ? "Building your audiogram…" : "Cutting your clip…"); setVideoUrl(null);
    try {
      const len = Math.max(1, splicePlan.end - splicePlan.start);
      const isPodcast = /podcast/i.test(open?.channel || "");
      const d = spliceKind === "audio"
        ? await postJSON("/api/splice/audiogram", { campaignId, fileId: spliceFile.id, start: splicePlan.start, length: len, format: channelFormatId(), captions: spliceCaps, podcast: isPodcast }, 60000)
        : await postJSON("/api/splice/render", { campaignId, fileId: spliceFile.id, start: splicePlan.start, length: len, format: channelFormatId(), captions: spliceCaps, musicUrl: music || undefined }, 60000);
      if (!d.renderId) { setVideoBusy(false); setVideoStatus(""); alert(d.error || "Couldn't start the clip."); return; }
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const s = await (await fetch(`/api/video/status?id=${d.renderId}`)).json();
        if (s.url) { setVideoUrl(s.url); setVideoStatus(""); break; }
        if (s.status === "failed") { setVideoStatus(""); alert("Render failed — try a shorter clip."); break; }
        setVideoStatus(`Rendering… ${s.status || ""}`);
      }
    } catch { alert("Clip render failed."); } finally { setVideoBusy(false); }
  };
  // Talking-avatar from an audio clip: render trimmed audio → lip-sync a presenter photo to it.
  const makeAvatar = async () => {
    const av = products.find((p) => p.kind === "avatar");
    if (!av) { alert("Upload a presenter photo in Edit setup → Connect Your Brain to enable avatar videos."); return; }
    if (!spliceFile || !splicePlan) return;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    setVideoBusy(true); setVideoStatus("Rendering trimmed audio…"); setVideoUrl(null);
    try {
      const len = Math.max(1, splicePlan.end - splicePlan.start);
      const a = await postJSON("/api/splice/audiogram", { campaignId, fileId: spliceFile.id, start: splicePlan.start, length: len, format: channelFormatId(), podcast: true }, 60000);
      if (!a.renderId) throw new Error(a.error || "Couldn't prepare the audio.");
      let mp3 = "";
      for (let i = 0; i < 40; i++) { await wait(3000); const s = await (await fetch(`/api/video/status?id=${a.renderId}`)).json(); if (s.url) { mp3 = s.url; break; } if (s.status === "failed") throw new Error("Audio render failed."); setVideoStatus(`Audio… ${s.status || ""}`); }
      if (!mp3) throw new Error("Audio timed out — try a shorter clip.");
      setVideoStatus("Generating avatar…");
      const d = await postJSON("/api/splice/avatar", { campaignId, audioUrl: mp3, avatarImageId: av.id }, 120000);
      if (d.videoUrl) { setVideoUrl(d.videoUrl); setVideoStatus(""); } else alert(d.error || "Avatar generation failed.");
    } catch (e: any) { alert(String(e?.message || "Avatar failed.")); } finally { setVideoBusy(false); }
  };
  // Autopilot: one click drafts copy for every queued post (resumable), then refreshes the calendar.
  const runAutopilot = async () => {
    setAutoBusy(true); setAutoMsg("Starting…");
    try {
      for (let i = 0; i < 400; i++) {
        const d = await postJSON("/api/autopilot/advance", { campaignId }, 90000);
        if (d.error) { alert(d.error); break; }
        setAutoMsg(`Drafted ${d.drafted}/${d.total}…`);
        if (d.done) {
          setAutoMsg(`✓ Drafted ${d.drafted} posts — review below.`);
          try { const r2 = await (await fetch(`/api/campaigns/${campaignId}/schedule`)).json(); if (Array.isArray(r2.slots)) setSlots(r2.slots); } catch { /* ignore */ }
          break;
        }
      }
    } catch { alert("Autopilot hit a snag — try again."); } finally { setAutoBusy(false); }
  };
  // Autopilot review-by-exception: approve every drafted post at once.
  const approveAll = async () => {
    setApproveBusy(true);
    try {
      const d = await postJSON("/api/schedule/approve-all", { campaignId }, 60000);
      if (d.ok) { const r2 = await (await fetch(`/api/campaigns/${campaignId}/schedule`)).json(); if (Array.isArray(r2.slots)) setSlots(r2.slots); }
      else alert(d.error || "Couldn't approve — try again.");
    } catch { alert("Couldn't approve — try again."); } finally { setApproveBusy(false); }
  };
  // Batch stills: render a scene image for every approved post that has no visual yet. Resumable.
  const runStills = async () => {
    setStillsBusy(true); setStillsMsg("Starting…");
    try {
      for (let i = 0; i < 400; i++) {
        const d = await postJSON("/api/batch/stills", { campaignId }, 120000);
        if (d.error) { alert(d.error); break; }
        const made = (d.total || 0) - (d.remaining || 0);
        setStillsMsg(`Rendered ${made}/${d.total || 0}…`);
        if (d.done) {
          setStillsMsg(`✓ Stills done (${d.total || 0}).`);
          try { const r2 = await (await fetch(`/api/campaigns/${campaignId}/schedule`)).json(); if (Array.isArray(r2.slots)) setSlots(r2.slots); } catch { /* ignore */ }
          break;
        }
      }
    } catch { alert("Stills batch hit a snag — try again."); } finally { setStillsBusy(false); }
  };
  const loadTrailer = async () => {
    try { const d = await (await fetch(`/api/trailer/get?campaignId=${campaignId}`)).json(); if (d.job) setTrailer(d.job); } catch { /* ignore */ }
  };
  const saveTrailer = async (jobId: string, beats: any[]) => {
    try { await fetch(`/api/trailer/save`, { method: "POST", body: JSON.stringify({ jobId, beats }) }); } catch { /* ignore */ }
  };
  const updateBeat = (i: number, patch: any) => setTrailer((t: any) => (t ? { ...t, beats: t.beats.map((b: any, idx: number) => (idx === i ? { ...b, ...patch } : b)) } : t));
  const persistTrailer = () => setTrailer((t: any) => { if (t) saveTrailer(t.id, t.beats); return t; });
  const clearTrailer = () => {
    if (!trailer?.beats?.length || !confirm("Clear all storyboard words (narration + shot prompts)?")) return;
    const beats = trailer.beats.map((b: any) => ({ ...b, copy: "", prompt: "" }));
    setTrailer({ ...trailer, beats });
    saveTrailer(trailer.id, beats);
  };
  const planTrailer = async () => {
    setTrailerBusy(true);
    try {
      const d = await postJSON("/api/trailer/plan", { campaignId }, 90000);
      if (d.job) setTrailer(d.job); else alert(d.error || "Couldn't storyboard — try again.");
    } catch { alert("Couldn't storyboard — try again."); } finally { setTrailerBusy(false); }
  };
  const loadItalian = async () => {
    if (itVoices.length || itLoading) return;
    setItLoading(true);
    try { const d = await (await fetch("/api/voiceover/italian")).json(); setItVoices(Array.isArray(d.voices) ? d.voices : []); }
    catch { /* ignore */ } finally { setItLoading(false); }
  };
  const addVoice = async (v: any) => {
    setAddingVoice(v.voiceId);
    try {
      const d = await (await fetch("/api/voiceover/add-voice", { method: "POST", body: JSON.stringify({ ownerId: v.ownerId, voiceId: v.voiceId, name: v.name }) })).json();
      if (d.id) {
        const vd = await (await fetch("/api/voiceover/voices")).json();
        if (Array.isArray(vd.voices)) setVoices(vd.voices);
        setVoVoice(d.id);
      } else alert(d.error || "Couldn't add that voice.");
    } catch { alert("Couldn't add that voice — try again."); }
    finally { setAddingVoice(""); }
  };
  const genVoice = async () => {
    if (!open || !draft) return;
    setVoBusy(true); setNoVo(false);
    try {
      const d = await postJSON("/api/voiceover", { campaignId, text: editScript || draft.caption, voice: voVoice }, 60000);
      if (d.audio) { setVo(d.audio); setVoSeconds(await measureAudio(d.audio)); } else alert(d.error || "Couldn't generate voiceover.");
    } catch (e: any) {
      alert(e?.name === "AbortError" ? "The voiceover timed out — try again." : "Couldn't reach the voice service — try again.");
    } finally {
      setVoBusy(false);
    }
  };
  const approve = async () => {
    if (!open || !draft) return;
    const cap = [draft.caption, (draft.hashtags || []).join(" ")].filter(Boolean).join("\n\n");
    // Assembled post = the finished media (spliced clip / rendered video wins over a still) + aligned caption.
    const media = videoUrl || image;
    // One edit → every channel in the group gets the same finished asset + caption.
    const ids = open.groupIds && open.groupIds.length ? open.groupIds : [open.id];
    await Promise.all(ids.map((id) => fetch("/api/approve", { method: "POST", body: JSON.stringify({ id, status: "approved", caption: cap, mediaUrl: media }) })));
    setSlots(slots.map((s) => (ids.includes(s.id) ? { ...s, status: "approved" } : s)));
    setOpen(null);
  };
  const statusStyle = (s: string) =>
    s === "published" ? "bg-emerald-400/20 text-emerald-300" :
    s === "approved" ? "bg-lime-400/20 text-accent" :
    s === "ready" ? "bg-amber-400/20 text-amber-300" :
    s === "failed" ? "bg-red-400/20 text-red-300" :
    "bg-zinc-800 text-zinc-400";
  const phaseStyle = (p?: string | null) =>
    p === "Start" ? "bg-sky-400/15 text-sky-300" :
    p === "Struggle" ? "bg-amber-400/15 text-amber-300" :
    p === "Success" ? "bg-lime-400/15 text-accent" :
    p === "Service" ? "bg-fuchsia-400/15 text-fuchsia-300" :
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
          <Btn kind="ghost" onClick={() => setTab("offer")}>Edit setup</Btn>
          <Btn kind="soft" onClick={logout}>Log out</Btn>
        </div>
      </nav>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid sm:grid-cols-4 gap-4 mb-8">
          <Card className="p-5"><div className="text-zinc-400 text-xs">Active pillars</div><div className="text-3xl font-black text-accent">{pillars.length}</div></Card>
          <Card className="p-5"><div className="text-zinc-400 text-xs">Posts</div><div className="text-3xl font-black">{slots.length}</div></Card>
          <Card className="p-5"><div className="text-zinc-400 text-xs">Schedule</div><div className="text-xl font-bold mt-1">1 / day</div><div className="text-[11px] text-zinc-500">Mon–Sun · 8am ET</div></Card>
          <Card className="p-5"><div className="text-zinc-400 text-xs">Approved</div><div className="text-3xl font-black">{slots.filter((s) => s.status === "approved").length}<span className="text-zinc-600 text-lg">/{slots.length}</span></div></Card>
        </div>
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          {["offer", "brain", "profile", "heroframe", "calendar", "deliver"].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3.5 py-2 rounded-lg text-sm font-semibold capitalize ${tab === t ? "bg-accent text-zinc-950" : "bg-zinc-900 text-zinc-300 border border-zinc-800"}`}>{t === "heroframe" ? "Hero Frame" : t}</button>
          ))}
          <button key="trailer" onClick={() => setTab("trailer")} className={`ml-auto px-3.5 py-2 rounded-lg text-sm font-semibold capitalize ${tab === "trailer" ? "bg-accent text-zinc-950" : "bg-zinc-900 text-zinc-300 border border-zinc-800"}`}>🎬 Trailer</button>
        </div>

        {/* Top viewer — horizontal editor docked above the calendar; click a post below to toggle it here */}
        {tab === "calendar" && open && (
          <Card className="p-4 mb-4 max-h-[66vh] overflow-auto border-lime-400/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-zinc-500">{open.day} {open.date} · {open.channel || "—"}{open.format ? ` · ${open.format}` : ""}</div>
                <div className="font-bold text-lg">{open.city ? open.pillar.replace(/\[city\]/i, open.city) : open.pillar}</div>
                {open.beatName && <div className="mt-1"><span className={`text-[10px] rounded-full px-2 py-0.5 ${phaseStyle(open.phase)}`}>{open.phase} · {open.beatName}{typeof open.loop === "number" ? ` · loop ${open.loop + 1}` : ""}</span></div>}
                {open.beat && (() => { const jb = arcFor(campaign.campaignType).find((b) => b.id === open.beat)?.job; return jb ? <div className="text-[11px] text-zinc-500 mt-1">Story job: {jb}</div> : null; })()}
              </div>
              <button onClick={() => setOpen(null)} className="text-zinc-500 hover:text-zinc-200 text-xl" title="Close viewer">✕</button>
            </div>
            {draftLoading && <div className="text-zinc-500 mt-8">Drafting…</div>}
            {draft && (
              <div className="mt-5 grid lg:grid-cols-2 gap-5 items-start">
                {/* LEFT — live preview */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-zinc-500">Preview · how it'll post <span className="text-zinc-600">· 🔒 Voice: {isGrowFastBrand(campaign.name) ? "GrowFast (Tyson)" : (campaign.name || "brand")}</span></div>
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
                  {productSel && (
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">Scene:</span>
                        <div className="flex rounded-lg overflow-hidden border border-zinc-700">
                          <button onClick={() => setSceneStyle("hero")} className={`text-xs px-3 py-1.5 ${sceneStyle === "hero" ? "bg-lime-400 text-zinc-950 font-semibold" : "text-zinc-400"}`}>Hero · perfect label</button>
                          <button onClick={() => setSceneStyle("lifestyle")} className={`text-xs px-3 py-1.5 ${sceneStyle === "lifestyle" ? "bg-lime-400 text-zinc-950 font-semibold" : "text-zinc-400"}`}>Lifestyle · in-hand</button>
                        </div>
                      </div>
                      <div className="text-[11px] text-zinc-600 mt-1">
                        {sceneStyle === "hero"
                          ? "Your real can integrated as a clean hero shot — matched lighting, label kept intact."
                          : "Your real can placed into a people/usage moment — hands holding it, matched lighting, label kept."}
                      </div>
                    </div>
                  )}
                  {(() => {
                    const r = routePost({ format: open.format, channel: open.channel, pillarSource: pillarSource(open.pillar) });
                    const ready = routeReady(r, (campaign.inputs || {}).libraries);
                    return (
                      <div className={`text-[11px] rounded-lg px-3 py-2 flex items-center gap-2 ${ready ? "bg-zinc-800/50 text-zinc-400" : "bg-red-500/10 text-red-300 border border-red-500/40"}`}>
                        <span>🎯 Auto-source:</span>
                        <span className="text-zinc-200">{r.label}</span>
                        {!ready && <span className="ml-auto">Connect your {r.needs} library in Brain →</span>}
                      </div>
                    );
                  })()}
                </div>
                {/* RIGHT — generation controls */}
                <div className="space-y-4">
                {/* 1 · Visual — hidden for audio-only posts (Spotify/Podcast use the audio library below) */}
                {aspectFor(open.channel, open.format) !== "audio" && (isLongform(open) ? (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-800/40 p-3">
                    <div className="text-sm font-semibold text-zinc-200">🎥 Long-form uses your uploaded video</div>
                    <div className="text-xs text-zinc-500 mt-1">No AI generation — pick your webcam / screen-share clip from the Video library below and trim it. It exports as the YouTube long-form (and a Spotify audio track).</div>
                  </div>
                ) : pillarSource(open.pillar) === "real" ? (
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">1 · Your photos & footage — pick one from your connected folder (no AI)</div>
                    {mediaLoading && <div className="text-xs text-zinc-500">Loading your media…</div>}
                    {!mediaLoading && driveMedia.length === 0 && <div className="text-xs text-zinc-500">No photos/footage found. Connect a Drive folder in Edit setup → Inputs, or add media to it.</div>}
                    {driveMedia.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 max-h-72 overflow-auto">
                        {driveMedia.map((m) => {
                          const sel = m.kind === "video" && realClip ? realClip.includes(m.id) : false;
                          return (
                            <button key={m.id} onClick={() => pickMedia(m)} className={`relative block rounded-lg overflow-hidden border ${sel ? "border-lime-400" : "border-zinc-800"} bg-zinc-900`}>
                              {m.thumbnailLink ? <img src={m.thumbnailLink} alt="" className="w-full h-20 object-cover" /> : <div className="w-full h-20 flex items-center justify-center text-zinc-600 text-xs">{m.kind}</div>}
                              {m.kind === "video" && <span className="absolute bottom-1 right-1 text-[10px] bg-black/70 text-white rounded px-1">▶</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {realClip && <video src={realClip} controls className="w-full rounded-xl bg-black mt-2" />}
                    <div className="text-[11px] text-zinc-600 mt-1">Real media — no AI generation. Uzi adds the copy, voiceover, and score.</div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">1 · Image prompt — edit to adjust the scene, then generate</div>
                    <textarea value={editBrief} onChange={(e) => setEditBrief(e.target.value)} rows={2} className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 mb-2" />
                    <Btn kind="ghost" className="w-full text-sm" disabled={imgBusy} onClick={genImage}>{imgBusy ? "Generating visual…" : image ? "Regenerate visual ✨" : "Generate visual ✨"}</Btn>
                  </div>
                ))}

                {/* Splice from your libraries. Audio-aspect posts (Spotify/Podcast) show only the audio picker. */}
                {aspectFor(open.channel, open.format) !== "text" && (
                  <div className="border-t border-zinc-800 pt-3">
                    <div className="flex items-center gap-3">
                      {aspectFor(open.channel, open.format) !== "audio" && (
                        <button onClick={() => openSplice("video")} className={`text-xs hover:text-zinc-200 ${spliceOpen && spliceKind === "video" ? "text-lime-300" : "text-zinc-400"}`}>✂️ Splice from video library</button>
                      )}
                      <button onClick={() => openSplice("audio")} className={`text-xs hover:text-zinc-200 ${spliceOpen && spliceKind === "audio" ? "text-lime-300" : "text-zinc-400"}`}>🎧 {aspectFor(open.channel, open.format) === "audio" ? "Pick from audio library" : "Audiogram from audio library"}</button>
                    </div>
                    {spliceOpen && (
                      <div className="mt-2 space-y-2">
                        {spliceLoading && <div className="text-xs text-zinc-500">Loading your {spliceKind} library…</div>}
                        {!spliceLoading && spliceMedia.length === 0 && <div className="text-xs text-zinc-500">No {spliceKind} files found. Connect a {spliceKind === "audio" ? "Audio" : "Video"} library folder in Edit setup → Inputs.</div>}
                        {spliceMedia.length > 0 && (
                          <div className="grid grid-cols-3 gap-2 max-h-44 overflow-auto">
                            {spliceMedia.map((m) => (
                              <button key={m.id} onClick={() => pickSplice(m)} className={`relative block rounded-lg overflow-hidden border ${spliceFile?.id === m.id ? "border-lime-400" : "border-zinc-800"} bg-zinc-900`}>
                                {m.thumbnailLink ? <img src={m.thumbnailLink} alt="" className="w-full h-16 object-cover" /> : <div className="w-full h-16 flex items-center justify-center text-zinc-600 text-[10px] px-1 text-center">{m.name}</div>}
                                <span className="absolute bottom-1 right-1 text-[10px] bg-black/70 text-white rounded px-1">{spliceKind === "audio" ? "🎧" : "▶"}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {spliceBusy && <div className="text-xs text-accent">{spliceBusy}</div>}
                        {splicePlan && (
                          <div className="bg-zinc-800/40 rounded-lg p-3 space-y-2">
                            <div className="text-[11px] text-zinc-400">{splicePlan.source === "ai" ? "AI-picked moment" : "Auto-picked moment"}{splicePlan.why ? ` — ${splicePlan.why}` : ""}</div>
                            <div className="flex items-center gap-2 text-xs flex-wrap">
                              <label className="text-zinc-500">In</label>
                              <input type="number" step="0.1" value={splicePlan.start} onChange={(e) => setSplicePlan({ ...splicePlan, start: Math.max(0, Number(e.target.value) || 0) })} className="w-20 bg-zinc-800 rounded px-2 py-1" />
                              <label className="text-zinc-500">Out</label>
                              <input type="number" step="0.1" value={splicePlan.end} onChange={(e) => setSplicePlan({ ...splicePlan, end: Number(e.target.value) || 0 })} className="w-20 bg-zinc-800 rounded px-2 py-1" />
                              <span className="text-zinc-600">/ {Math.round(splicePlan.total || 0)}s · clip {Math.max(0, (splicePlan.end || 0) - (splicePlan.start || 0)).toFixed(1)}s</span>
                            </div>
                            <label className="flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={spliceCaps} onChange={(e) => setSpliceCaps(e.target.checked)} /> Burn in captions</label>
                            <Btn kind="ghost" className="w-full text-sm" disabled={videoBusy} onClick={makeSplice}>{videoBusy ? (videoStatus || "Working…") : (spliceKind === "audio" ? "Make audiogram 🎧" : "Make clip ✂️")}</Btn>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!["text", "audio"].includes(aspectFor(open.channel, open.format)) && (<>
                {/* 2 · Voiceover decision */}
                <div className="border-t border-zinc-800 pt-3">
                  <div className="text-xs text-zinc-500 mb-1">2 · Voiceover — generate it or turn it off</div>
                  {noVo ? (
                    <div className="flex items-center justify-between bg-zinc-800/40 rounded-lg px-3 py-2 text-sm">
                      <span className="text-zinc-400">🔇 No voiceover</span>
                      <button className="text-accent text-xs" onClick={() => setNoVo(false)}>Add voiceover</button>
                    </div>
                  ) : (<>
                    <textarea value={editScript} onChange={(e) => setEditScript(e.target.value)} rows={2} placeholder={'Voiceover script — edit so it reads cleanly (e.g. "one million ARR", not "$1M ARR")'} className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100" />
                    <div className="flex items-center gap-2 mt-2">
                      <select value={voVoice} onChange={(e) => { const val = e.target.value; const it = itVoices.find((x: any) => x.voiceId === val); if (it) addVoice(it); else setVoVoice(val); }} className="bg-zinc-800 rounded-lg text-xs px-2 py-2 max-w-[38%] truncate" title="Voice">
                        {(voices.length ? voices : ["alloy", "echo", "fable", "onyx", "nova", "shimmer"].map((v) => ({ id: v, name: v }))).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                        {itVoices.length > 0 && <optgroup label="🇮🇹 Italian voices">{itVoices.map((v: any) => <option key={v.voiceId} value={v.voiceId}>{v.name}</option>)}</optgroup>}
                      </select>
                      <Btn kind="ghost" className="flex-1 text-sm" disabled={voBusy} onClick={genVoice}>{voBusy ? "Generating…" : vo ? "Regenerate 🎙" : "Generate voiceover 🎙"}</Btn>
                      <Btn kind="ghost" className="text-sm" onClick={() => { setNoVo(true); setVo(null); }}>No VO</Btn>
                    </div>
                  </>)}
                  {vo && !noVo && <audio controls src={vo} className="w-full mt-2" />}
                </div>

                {/* 3 · Music decision */}
                <div className="border-t border-zinc-800 pt-3">
                  <div className="text-xs text-zinc-500 mb-1">3 · Music score — generate it or turn it off</div>
                  {noMusic ? (
                    <div className="flex items-center justify-between bg-zinc-800/40 rounded-lg px-3 py-2 text-sm">
                      <span className="text-zinc-400">🔇 No music</span>
                      <button className="text-accent text-xs" onClick={() => setNoMusic(false)}>Add music</button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input value={editMusic} onChange={(e) => setEditMusic(e.target.value)} placeholder="Genre · mood · energy — e.g. 'uplifting corporate synth, medium energy, hopeful'" className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100" />
                      <div className="flex items-center gap-2">
                        <Btn kind="ghost" className="flex-1 text-sm" disabled={musicBusy} onClick={genMusic}>{musicBusy ? "Scoring…" : music ? "Re-score 🎵" : "Generate music 🎵"}</Btn>
                        <Btn kind="ghost" className="text-sm" onClick={() => { setNoMusic(true); setMusic(null); }}>No music</Btn>
                      </div>
                    </div>
                  )}
                  {music && !noMusic && <audio controls src={music} className="w-full mt-2" />}
                </div>

                {/* 4 · Video — locked until image + both audio decisions are made */}
                {(() => {
                  const base = image || picked || realClip;
                  const need = [!base ? "pick or generate the visual" : "", !(vo || noVo) ? "decide on voiceover" : "", !(music || noMusic) ? "decide on music" : ""].filter(Boolean);
                  const ready = need.length === 0;
                  return (
                    <div className="border-t border-zinc-800 pt-3">
                      <Btn className="w-full" disabled={!ready || videoBusy} onClick={genVideo}>{videoBusy ? `Working… ${videoStatus}` : videoUrl ? "Re-make video 🎬" : "Make video 🎬"}</Btn>
                      <div className="text-[11px] text-zinc-600 mt-1">{ready ? "Packages your image + voiceover + music — sized to the real audio length." : `Finish first: ${need.join(" · ")}.`}</div>
                    </div>
                  );
                })()}
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
                  <Btn onClick={approve} className="flex-1">{open.groupIds && open.groupIds.length > 1 ? `Approve → ${open.groupIds.length} channels ✓` : "Approve ✓"}</Btn>
                </div>
                <div className="text-xs text-zinc-600">{image ? "Your real product is rendered into the scene. Edit the brief above and regenerate to change it, or pick a different product." : "Pick a product, then “Generate visual” renders a scene built around your real product (needs the OpenAI image key)."}</div>
                </div>
              </div>
            )}
          </Card>
        )}

        {["offer", "brain", "profile", "heroframe"].includes(tab) && (
          <Wizard
            campaignId={campaignId}
            embedded
            stepProp={["offer", "brain", "profile", "heroframe"].indexOf(tab)}
            onStep={(i) => setTab(["offer", "brain", "profile", "heroframe"][i])}
            onExit={() => setTab("calendar")}
          />
        )}

        {tab === "calendar" && (
          <Card className="p-4">
            <div className="mb-3 px-2 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-bold">Calendar · click a post to draft it</div>
                <div className="flex items-center gap-2">
                  {autoMsg && <span className="text-xs text-accent">{autoMsg}</span>}
                  <Btn className="text-xs px-3 py-1.5" disabled={autoBusy} onClick={runAutopilot}>{autoBusy ? "Drafting…" : "⚡ Generate all copy"}</Btn>
                  {slots.some((s) => s.status === "drafted") && (
                    <Btn className="text-xs px-3 py-1.5" disabled={approveBusy} onClick={approveAll}>{approveBusy ? "Approving…" : `✓ Approve all (${slots.filter((s) => s.status === "drafted").length})`}</Btn>
                  )}
                  <Btn kind="ghost" className="text-xs px-3 py-1.5" onClick={() => setTab("deliver")}>Auto-deliver ▶</Btn>
                </div>
              </div>
              {/* Batch pipeline — runs on APPROVED posts. Each stage lights the next. */}
              {(() => {
                const approved = slots.filter((s) => s.status === "approved").length;
                const needStills = slots.filter((s) => s.status === "approved" && !s.mediaUrl).length;
                const haveStills = approved > 0 && needStills === 0;
                const Step = ({ label, on, busy, done, onClick, note }: any) => (
                  <button onClick={onClick} disabled={!on || busy} title={note}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition ${busy ? "bg-accent/70 text-zinc-950 border-transparent" : done ? "bg-lime-400/20 text-accent border-lime-400/40" : on ? "bg-accent text-zinc-950 border-transparent hover:brightness-95" : "bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed"}`}>
                    {label}
                  </button>
                );
                return (
                  <div className="flex items-center gap-1.5 flex-wrap bg-zinc-900/60 rounded-lg px-2.5 py-2">
                    <span className="text-[11px] text-zinc-500 mr-1">Batch pipeline · approved posts:</span>
                    <Step label={stillsBusy ? (stillsMsg || "Rendering…") : haveStills ? "✓ Stills" : `🖼 Generate all stills${needStills ? ` (${needStills})` : ""}`} on={approved > 0} busy={stillsBusy} done={haveStills} onClick={runStills} note="Renders a scene image for every approved post that has no visual." />
                    <span className="text-zinc-700">→</span>
                    <Step label="🎞 Animate stills" on={false} note="Next build — turns stills into motion clips (Kling)." />
                    <span className="text-zinc-700">→</span>
                    <Step label="🎙 Generate VO" on={false} note="Next build — voiceover per approved post." />
                    <span className="text-zinc-700">→</span>
                    <Step label="🎵 Generate music" on={false} note="Next build — score per approved post." />
                    <span className="text-zinc-700">→</span>
                    <Step label="🎬 Master Video" on={false} note="Next build — assembles still + motion + VO + music into the final MP4." />
                    {!stillsBusy && stillsMsg && <span className="text-[11px] text-accent ml-1">{stillsMsg}</span>}
                  </div>
                );
              })()}
              <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-zinc-500 bg-zinc-900/60 rounded-lg px-2.5 py-1.5">
                <button onClick={() => setTab("heroframe")} className="text-zinc-300 hover:text-accent underline">Hero Frame</button>
                <span className="text-zinc-600">frame + formats + channels</span>
                <span className="text-zinc-600">→</span>
                <span className="text-accent font-semibold">Calendar</span>
                <span className="text-zinc-600">draft &amp; approve (queued → drafted → approved → ready)</span>
                <span className="text-zinc-600">→</span>
                <button onClick={() => setTab("deliver")} className="text-zinc-300 hover:text-accent underline">Deliver</button>
                <span className="text-zinc-600">send</span>
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
              {(() => {
                // One row per pillar-firing (a pillar hits N channels the same day/time) — review once.
                const groups: any[] = [];
                const gmap = new Map<string, any>();
                for (const s of slots) {
                  const key = `${s.date}|${s.time || ""}|${s.pillar}|${s.beat || ""}`;
                  let g = gmap.get(key);
                  if (!g) { g = { key, date: s.date, day: s.day, time: s.time, pillar: s.pillar, city: s.city, beatName: s.beatName, phase: s.phase, items: [] }; gmap.set(key, g); groups.push(g); }
                  g.items.push(s);
                }
                const done = ["approved", "ready", "published"];
                return groups.map((g, i) => {
                  const prev = groups[i - 1];
                  const newDay = i === 0 || (prev && prev.date !== g.date);
                  const dayCount = newDay ? slots.filter((s) => s.date === g.date).length : 0;
                  const ids: string[] = g.items.map((x: any) => x.id);
                  const allSel = ids.every((id) => selected.has(id));
                  const gStatus = g.items.every((x: any) => done.includes(x.status)) ? "approved" : g.items.some((x: any) => x.status === "drafted") ? "drafted" : g.items[0].status;
                  return (
                  <Fragment key={g.key}>
                    {newDay && (
                      <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur px-2 py-1.5 flex items-center justify-between text-[11px] font-semibold">
                        <span className="text-zinc-300">{g.day} · {g.date.slice(5)}{g.time ? <span className="text-zinc-500 font-normal"> · {g.time}</span> : null}</span>
                        <span className="text-accent">{dayCount} post{dayCount === 1 ? "" : "s"}</span>
                      </div>
                    )}
                    <div className="w-full flex items-center gap-3 py-2.5 px-2 text-sm hover:bg-zinc-800/50 rounded-lg transition">
                      <input type="checkbox" checked={allSel} onChange={() => toggleGroup(ids)} className="shrink-0" />
                      <button onClick={() => openGroup(g)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                        <div className="w-24 text-zinc-500 shrink-0"><div>{g.day} {g.date.slice(5)}</div>{g.time && <div className="text-[10px] text-zinc-600">{g.time}</div>}</div>
                        <div className="flex items-center gap-1 w-28 shrink-0 text-accent">{g.items.map((x: any) => <span key={x.id} title={x.channel}>{x.glyph}</span>)}<span className="text-zinc-600 text-[10px] ml-0.5">·{g.items.length}</span></div>
                        <div className="flex-1 text-zinc-100 truncate">{g.city ? g.pillar.replace(/\[city\]/i, g.city) : g.pillar}</div>
                      </button>
                      {g.beatName && <span className={`hidden md:inline text-[10px] rounded-full px-2 py-0.5 shrink-0 ${phaseStyle(g.phase)}`}>{g.beatName}</span>}
                      <span className={`text-xs rounded-full px-2 py-0.5 shrink-0 ${statusStyle(gStatus)}`}>{gStatus}</span>
                      <button onClick={() => { if (confirm(`Delete all ${ids.length} posts for “${g.pillar}” on ${g.date.slice(5)}?`)) delGroup(ids); }} className="text-zinc-600 hover:text-red-400 px-1.5 shrink-0" title="Delete">✕</button>
                    </div>
                  </Fragment>
                  );
                });
              })()}
              {slots.length === 0 && <div className="text-zinc-500 text-sm p-6 text-center">No schedule yet — hit Build calendar.</div>}
            </div>
          </Card>
        )}
        {tab === "trailer" && (
          <div>
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-lg font-bold">🎬 Brand Movie Trailer</div>
                  <div className="text-zinc-400 text-sm">A cinematic trailer built beat-by-beat along your story arc. Start with the storyboard, then generate the film.</div>
                </div>
                <div className="flex items-center gap-2">
                  {trailer?.beats?.length > 0 && <Btn kind="ghost" disabled={trailerBusy} onClick={clearTrailer}>Clear</Btn>}
                  <Btn disabled={trailerBusy} onClick={planTrailer}>{trailerBusy ? "Storyboarding…" : (trailer?.beats?.length ? "Re-storyboard" : "Storyboard my trailer 🎬")}</Btn>
                </div>
              </div>
            </Card>
            {trailer?.beats?.length > 0 && (
              <div className="space-y-2 mt-3">
                {trailer.beats.map((b: any, i: number) => (
                  <Card key={b.id + i} className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-500">Beat {i + 1}</span>
                      <span className="font-semibold text-sm">{b.name}</span>
                      <span className={`text-[10px] rounded-full px-2 py-0.5 ${phaseStyle(b.phase)}`}>{b.phase}</span>
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-1">Job: {b.job}</div>
                    <label className="text-[10px] text-zinc-500 mt-2 block">Narration</label>
                    <textarea value={b.copy || ""} onChange={(e) => updateBeat(i, { copy: e.target.value })} onBlur={persistTrailer} rows={2} placeholder="Narration line for this beat…" className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 mt-0.5" />
                    <label className="text-[10px] text-zinc-500 mt-2 block">Shot / cinematography prompt</label>
                    <textarea value={b.prompt || ""} onChange={(e) => updateBeat(i, { prompt: e.target.value })} onBlur={persistTrailer} rows={2} placeholder="Camera, lens, lighting, motion, subject…" className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 mt-0.5" />
                  </Card>
                ))}
                <Card className="p-4 border-dashed">
                  <div className="text-sm text-zinc-300 font-semibold">Next: generate the film</div>
                  <div className="text-xs text-zinc-500 mt-1">Beat-by-beat image → animated shots with end-frame continuity → voiceover, score, transitions, fades, logo motion → master + export (full trailer + per-beat clips). This runs as a background job — coming in the next build.</div>
                </Card>
              </div>
            )}
          </div>
        )}
        {tab === "deliver" && (
          <div className="space-y-4">
            {(() => {
              const ready = slots.filter((s) => ["approved", "ready", "published"].includes(s.status));
              const platforms = social.platforms || [];
              const forChan = (name: string) => ready.filter((s) => (s.channel || "").toLowerCase() === String(name).toLowerCase()).sort((a, b) => a.date.localeCompare(b.date));
              return (<>
                <Card className="p-5">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <div className="font-bold">Deliver · last review before send <span className="text-accent">({ready.filter((s) => s.status !== "published").length} ready)</span></div>
                      <div className="text-zinc-400 text-sm">Each account's posts below, in date order. Click any thumbnail to preview full-size, then send.</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Btn className="text-sm" disabled={deliverBusy} onClick={deliverNow}>{deliverBusy ? "Sending…" : "Send due now ▶"}</Btn>
                      <div className="flex items-center gap-2 text-xs text-zinc-400">Auto
                        <button onClick={() => toggleAuto(!social.autoDeliver)} className={`w-11 h-6 rounded-full relative shrink-0 ${social.autoDeliver ? "bg-accent" : "bg-zinc-700"}`}>
                          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-zinc-950 transition-all ${social.autoDeliver ? "left-[22px]" : "left-0.5"}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="font-bold mb-1">Connected accounts</div>
                  <div className="text-zinc-400 text-sm mb-4">Each platform's queued posts, in date order. Connect each account once.</div>
                  <div className="space-y-4">
                    {platforms.map((p: any) => {
                      const posts = forChan(p.platform);
                      return (
                        <div key={p.platform} className={`rounded-xl border ${p.connected ? "border-lime-400/40" : "border-zinc-800"} bg-zinc-800/30 p-3`}>
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold capitalize">{p.platform}</span>
                              <span className="text-[11px] text-zinc-500">{posts.length} post{posts.length === 1 ? "" : "s"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {p.connected
                                ? <span className="text-[10px] bg-emerald-400/20 text-emerald-300 rounded-full px-2 py-0.5">Connected</span>
                                : p.ready
                                  ? <span className="text-[10px] bg-zinc-800 text-zinc-400 rounded-full px-2 py-0.5">Not connected</span>
                                  : <span className="text-[10px] bg-amber-400/20 text-amber-300 rounded-full px-2 py-0.5">Pending API approval</span>}
                              {!p.connected && p.platform === "linkedin" && social.linkedinConfigured && (
                                <button onClick={connectLinkedIn} className="bg-accent text-zinc-950 font-semibold text-[11px] rounded-lg px-2.5 py-1">Connect</button>
                              )}
                            </div>
                          </div>
                          {!p.connected && p.platform === "linkedin" && !social.linkedinConfigured && <div className="text-xs text-zinc-500 mt-1">Add LinkedIn API keys in Vercel to enable.</div>}
                          {!p.connected && p.platform !== "linkedin" && <div className="text-xs text-zinc-500 mt-1">Unlocks once its API app is approved — posts stay “ready” to send manually.</div>}
                          {posts.length > 0 && (
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3">
                              {posts.map((e) => (
                                <button key={e.id} onClick={() => setPreview(e)} className="relative rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 aspect-square group">
                                  {e.mediaUrl
                                    ? (isVideoUrl(e.mediaUrl) ? <video src={e.mediaUrl} className="w-full h-full object-cover" muted /> : <img src={e.mediaUrl} className="w-full h-full object-cover" alt="" />)
                                    : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-[10px] px-1 text-center">{e.city ? e.pillar.replace(/\[city\]/i, e.city) : e.pillar}</div>}
                                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1 text-left"><div className="text-[9px] text-white truncate">{e.date.slice(5)}</div></div>
                                  {e.status === "published" && <span className="absolute top-0.5 right-0.5 text-[8px] bg-emerald-500/80 text-white rounded px-1">live</span>}
                                  <div className="absolute inset-0 group-hover:bg-black/20 transition" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {platforms.length === 0 && <div className="text-zinc-500 text-sm">Set channels on your pillars (Pillars tab) to see platforms here.</div>}
                  </div>
                </Card>
              </>);
            })()}

            <div className="text-xs text-zinc-600">LinkedIn publishes today. Instagram, Facebook, YouTube, TikTok and X each need their own API app review before auto-posting — until then those posts are marked <span className="text-amber-300">ready</span> so you can post them manually in one click.</div>
          </div>
        )}
      </div>


      {/* Deliver — enlarged final-review preview */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-zinc-950 rounded-2xl border border-zinc-800 w-full max-w-md max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div className="text-sm font-semibold">{preview.glyph} {preview.channel}{preview.format ? <span className="text-zinc-500"> · {preview.format}</span> : null}</div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] rounded-full px-2 py-0.5 ${statusStyle(preview.status)}`}>{preview.status}</span>
                <button onClick={() => setPreview(null)} className="text-zinc-500 hover:text-zinc-200">✕</button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {preview.mediaUrl
                ? (isVideoUrl(preview.mediaUrl)
                    ? <video src={preview.mediaUrl} controls className="w-full rounded-xl bg-black" />
                    : <PostPreview channel={preview.channel || "Instagram"} format={preview.format} aspect={aspectFor(preview.channel, preview.format)} draft={{ headline: "", caption: preview.caption || "", hashtags: [], visualBrief: "", cta: "" }} handle={campaign.handle} imageUrl={preview.mediaUrl || undefined} />)
                : <div className="text-sm text-zinc-400">No media on this post yet.</div>}
              {preview.mediaUrl && isVideoUrl(preview.mediaUrl) && preview.caption && <div className="text-sm text-zinc-200 whitespace-pre-wrap">{preview.caption}</div>}
              {preview.externalUrl && <a href={preview.externalUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-300 underline">view live post ↗</a>}
              <div className="flex gap-2 pt-1">
                <Btn kind="ghost" className="flex-1" onClick={() => { const s = preview; setPreview(null); if (s) openSlot(s); }}>Edit</Btn>
                <Btn className="flex-1" disabled={deliverBusy} onClick={deliverNow}>{deliverBusy ? "Sending…" : "Send now ▶"}</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
