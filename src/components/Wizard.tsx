"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Btn } from "./ui";
import { pillarsFor, CHANNELS, CHANNEL_FORMATS, CAMPAIGN_TYPES } from "@/lib/constants";
import { DEPTHS, CHARACTERS, realmsForDepth } from "@/lib/story";

const STEPS = ["Type", "Profile", "Inputs", "Story", "7 Pillars", "Outputs", "Cadence"];

export default function Wizard({ campaignId }: { campaignId: string }) {
  const r = useRouter();
  const [step, setStep] = useState(0);
  const [cfg, setCfg] = useState<any>({ campaignType: "physical", pillars: {}, channels: {}, inputs: {}, cadence: "steady" });
  const [loaded, setLoaded] = useState(false);
  const [drive, setDrive] = useState<any>({ configured: false, connected: false });
  const [folders, setFolders] = useState<any[]>([]);
  const [folderQ, setFolderQ] = useState("");
  const [driveBusy, setDriveBusy] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [prodBusy, setProdBusy] = useState(false);
  const [storyBusy, setStoryBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/campaigns/${campaignId}`).then((x) => x.json()).then((d) => {
      const c = d.campaign;
      if (c) setCfg({
        campaignType: c.campaignType || "physical",
        name: c.name, handle: c.handle, tagline: c.tagline, region: c.region, voice: c.voice,
        pillars: c.pillars || {}, channels: c.channels || {}, inputs: c.inputs || {}, cadence: c.cadence || "steady",
      });
      setLoaded(true);
    });
    fetch(`/api/google/status?campaignId=${campaignId}`).then((x) => x.json()).then(setDrive).catch(() => {});
    fetch(`/api/products?campaignId=${campaignId}`).then((x) => x.json()).then((d) => setProducts(d.products || [])).catch(() => {});
    // Returning from Google OAuth lands here with ?drive=... — jump to the Inputs step.
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("drive")) setStep(2);
  }, [campaignId]);

  const uploadProduct = (file: File | undefined, kind: string = "product") => {
    if (!file) return;
    setProdBusy(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const d = await (await fetch("/api/products", { method: "POST", body: JSON.stringify({ campaignId, name: file.name, dataUrl: reader.result, kind }) })).json();
      setProdBusy(false);
      if (d.id) setProducts((p) => [{ id: d.id, name: d.name, kind: d.kind }, ...p]);
    };
    reader.readAsDataURL(file);
  };
  const delProduct = async (id: string) => {
    await fetch(`/api/products?id=${id}`, { method: "DELETE" });
    setProducts((p) => p.filter((x) => x.id !== id));
  };

  // When connected but no folder chosen yet, preload root folders for the picker.
  useEffect(() => {
    if (drive.connected && !drive.folderId && folders.length === 0) searchFolders("");
  }, [drive.connected, drive.folderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const connectDrive = () => { window.location.href = `/api/google/auth?campaignId=${campaignId}`; };
  const searchFolders = async (q: string) => {
    setFolderQ(q);
    try { const d = await (await fetch(`/api/google/folders?q=${encodeURIComponent(q)}`)).json(); setFolders(d.folders || []); }
    catch { setFolders([]); }
  };
  const pickFolder = async (f: any) => {
    setDriveBusy(true);
    const d = await (await fetch(`/api/google/connect-folder`, { method: "POST", body: JSON.stringify({ campaignId, folderId: f.id, folderName: f.name }) })).json();
    setDriveBusy(false);
    if (d.ok) {
      setDrive({ ...drive, folderId: f.id, folderName: f.name, fileCount: d.fileCount, textFiles: d.textFiles });
      u({ inputs: { ...cfg.inputs, drive: true, driveFolderName: f.name } });
      setFolders([]);
    }
  };

  const u = (patch: any) => setCfg({ ...cfg, ...patch });
  const save = (extra: any = {}) => fetch(`/api/campaigns/${campaignId}`, { method: "PUT", body: JSON.stringify({ ...cfg, ...extra }) });

  // Story Engine: a few seeds -> AI fills the whole campaign story (cast + realm beats).
  const setStory = (patch: any) => u({ inputs: { ...cfg.inputs, story: { ...(cfg.inputs?.story || {}), ...patch } } });
  const genStory = async () => {
    setStoryBusy(true);
    const s = cfg.inputs?.story || {};
    const seed = { hero: s.seedHero, shadow: s.seedShadow, elixir: s.seedElixir, world: s.seedWorld };
    const depth = s.depth || "mvs";
    try {
      const d = await (await fetch("/api/story/generate", { method: "POST", body: JSON.stringify({ campaignId, seed, depth }) })).json();
      if (d.bible) setStory({ ...d.bible, depth, seedHero: s.seedHero, seedShadow: s.seedShadow, seedElixir: s.seedElixir, seedWorld: s.seedWorld });
      else alert(d.error || "Couldn't generate the story — try again.");
    } catch {
      alert("Couldn't reach the story service — try again.");
    } finally {
      setStoryBusy(false);
    }
  };

  const next = async () => {
    // "Now in [city]" requires at least one city before leaving the Pillars step.
    const nowin = pillarsFor(cfg.campaignType).find((p) => /\[city\]/i.test(p.name));
    if (step === 4 && nowin && (cfg.pillars?.[nowin.id]?.on ?? true)) {
      if (!String(cfg.pillars?.[nowin.id]?.cities || "").trim()) {
        alert(`Add at least one city for "${nowin.name}" — each post anchors to a specific city. (Or switch that pillar off if you don't want city-launch posts.)`);
        return;
      }
    }
    await save();
    if (step < STEPS.length - 1) setStep(step + 1);
    else { await save({ onboarded: true }); await fetch(`/api/campaigns/${campaignId}/schedule`, { method: "POST" }); r.push(`/campaign/${campaignId}`); }
  };

  if (!loaded) return <div className="p-10 text-zinc-500">Loading…</div>;
  const PILLARS = pillarsFor(cfg.campaignType);
  const isDigital = cfg.campaignType === "digital";

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= step ? "bg-accent" : "bg-zinc-800"}`} />
            <div className={`text-xs mt-2 ${i <= step ? "text-zinc-200" : "text-zinc-600"}`}>{s}</div>
          </div>
        ))}
      </div>

      {step === 0 && (
        <Card className="p-7">
          <h3 className="text-xl font-bold">New campaign — what are you launching?</h3>
          <p className="text-zinc-400 text-sm mt-1">This sets your 7-pillar map. You can run different types for different brands.</p>
          <div className="grid sm:grid-cols-2 gap-4 mt-5">
            {CAMPAIGN_TYPES.map((t) => (
              <button key={t.id} onClick={() => u({ campaignType: t.id, pillars: {} })}
                className={`text-left p-5 rounded-xl border ${cfg.campaignType === t.id ? "border-lime-400 bg-lime-400/5" : "border-zinc-800 bg-zinc-800/40"}`}>
                <div className="font-bold">{t.name}</div>
                <div className="text-zinc-400 text-sm mt-1">{t.blurb}</div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card className="p-7">
          <h3 className="text-xl font-bold">Brand profile</h3>
          <p className="text-zinc-400 text-sm mt-1">The seam — everything Uzi generates reads from this.</p>
          <div className="grid sm:grid-cols-2 gap-3 mt-5">
            <input placeholder="Brand name" className="bg-zinc-800 rounded-xl px-4 py-3 text-sm" value={cfg.name || ""} onChange={(e) => u({ name: e.target.value })} />
            <input placeholder="Handle (@brand)" className="bg-zinc-800 rounded-xl px-4 py-3 text-sm" value={cfg.handle || ""} onChange={(e) => u({ handle: e.target.value })} />
            <input placeholder="Tagline" className="bg-zinc-800 rounded-xl px-4 py-3 text-sm" value={cfg.tagline || ""} onChange={(e) => u({ tagline: e.target.value })} />
            <input placeholder={isDigital ? "Category / ICP (e.g. B2B SaaS, ops teams)" : "Region (e.g. Sicily)"} className="bg-zinc-800 rounded-xl px-4 py-3 text-sm" value={cfg.region || ""} onChange={(e) => u({ region: e.target.value })} />
            <input placeholder="Voice (warm, bold, short punchy lines…)" className="bg-zinc-800 rounded-xl px-4 py-3 text-sm sm:col-span-2" value={cfg.voice || ""} onChange={(e) => u({ voice: e.target.value })} />
          </div>
          <div className="mt-5">
            <div className="text-sm font-semibold text-zinc-200">Brand kit — keeps every generation on-brand</div>
            <div className="grid sm:grid-cols-2 gap-3 mt-2">
              <select value={cfg.inputs?.brandKit?.language || "en"} onChange={(e) => u({ inputs: { ...cfg.inputs, brandKit: { ...(cfg.inputs?.brandKit || {}), language: e.target.value } } })} className="bg-zinc-800 rounded-xl px-4 py-3 text-sm">
                <option value="en">Language: English</option>
                <option value="it">Language: Italian</option>
                <option value="bilingual">Language: Bilingual (EN + IT)</option>
              </select>
              <input placeholder="Signature phrases (comma-sep)" className="bg-zinc-800 rounded-xl px-4 py-3 text-sm" value={cfg.inputs?.brandKit?.phrases || ""} onChange={(e) => u({ inputs: { ...cfg.inputs, brandKit: { ...(cfg.inputs?.brandKit || {}), phrases: e.target.value } } })} />
              <textarea placeholder="What is the product, exactly? (e.g. Blue Kamikaze — a blue ready-to-drink Sicilian cocktail, 6% ABV, slim can)" rows={2} className="bg-zinc-800 rounded-xl px-4 py-3 text-sm sm:col-span-2" value={cfg.inputs?.brandKit?.product || ""} onChange={(e) => u({ inputs: { ...cfg.inputs, brandKit: { ...(cfg.inputs?.brandKit || {}), product: e.target.value } } })} />
              <input placeholder="Never do… (e.g. never depict a restaurant/menu; never AI-draw the can)" className="bg-zinc-800 rounded-xl px-4 py-3 text-sm sm:col-span-2" value={cfg.inputs?.brandKit?.donts || ""} onChange={(e) => u({ inputs: { ...cfg.inputs, brandKit: { ...(cfg.inputs?.brandKit || {}), donts: e.target.value } } })} />
            </div>
            <p className="text-xs text-zinc-500 mt-2">These force every caption, voiceover, and image to stay on-brand and in the right language.</p>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-7">
          <h3 className="text-xl font-bold">Connect inputs</h3>
          <p className="text-zinc-400 text-sm mt-1">{isDigital ? "Your source material — copywriting, frameworks, cornerstone content, product docs." : "Your cornerstone assets — one weekly input fuels everything."}</p>
          <div className="grid sm:grid-cols-2 gap-4 mt-5">
            <div className={`p-5 rounded-xl border ${drive.folderId ? "border-lime-400 bg-lime-400/5" : "border-zinc-800 bg-zinc-800/40"}`}>
              <div className="font-bold flex items-center gap-2">Google Drive {drive.connected && <span className="text-[10px] uppercase tracking-wide bg-zinc-800 text-zinc-300 rounded-full px-2 py-0.5">linked</span>}</div>
              {!drive.configured && (
                <div className="text-zinc-500 text-xs mt-2">Drive isn&apos;t enabled on the server yet — add the Google API keys in Vercel to turn it on.</div>
              )}
              {drive.configured && !drive.connected && (
                <>
                  <div className="text-zinc-400 text-sm mt-1">Link your Google account, then pick a folder of brand copy &amp; assets.</div>
                  <button onClick={connectDrive} className="mt-3 bg-accent text-zinc-950 font-semibold text-sm rounded-lg px-4 py-2">Connect Google Drive</button>
                </>
              )}
              {drive.connected && drive.folderId && (
                <>
                  <div className="text-sm text-zinc-200 mt-2">✓ Folder: <span className="font-semibold">{drive.folderName}</span></div>
                  <div className="text-xs text-zinc-500">{drive.textFiles || 0} readable files ingested · grounds your captions</div>
                  <button onClick={() => setDrive({ ...drive, folderId: null })} className="mt-2 text-xs text-zinc-400 underline">Change folder</button>
                </>
              )}
              {drive.connected && !drive.folderId && (
                <div className="mt-2">
                  <div className="text-xs text-zinc-400 mb-2">{drive.email ? `Linked as ${drive.email}. ` : ""}Pick a folder:</div>
                  <input value={folderQ} onChange={(e) => searchFolders(e.target.value)} placeholder="Search folders…" className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm mb-2" />
                  <div className="max-h-40 overflow-auto divide-y divide-zinc-800 rounded-lg border border-zinc-800">
                    {folders.map((f) => (
                      <button key={f.id} disabled={driveBusy} onClick={() => pickFolder(f)} className="w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50">📁 {f.name}</button>
                    ))}
                    {folders.length === 0 && <div className="px-3 py-2 text-xs text-zinc-500">No folders found — try a search term.</div>}
                  </div>
                  {driveBusy && <div className="text-xs text-accent mt-2">Reading folder…</div>}
                </div>
              )}
            </div>
            <label className="text-left p-5 rounded-xl border border-dashed border-zinc-700 bg-zinc-800/40 cursor-pointer">
              <div className="font-bold">Drag &amp; drop upload</div>
              <div className="text-zinc-400 text-sm mt-1">{cfg.inputs?.uploads?.length ? cfg.inputs.uploads.length + " files added" : "Drop docs, screenshots, logos, copy"}</div>
              <input type="file" multiple className="hidden" onChange={(e) => u({ inputs: { ...cfg.inputs, uploads: [...(cfg.inputs?.uploads || []), ...Array.from(e.target.files || []).map((f) => f.name)] } })} />
            </label>
          </div>

          <div className="mt-5">
            <div className="text-sm font-semibold text-zinc-200">{isDigital ? "Product / app screenshot (transparent PNG)" : "Product images (transparent PNG)"}</div>
            <div className="text-zinc-400 text-sm">Upload your {isDigital ? "product UI / device shot" : "product cut out on a transparent background"}. Uzi renders it <em>into</em> the scene — the real thing, never AI-drawn.</div>
            <div className="flex flex-wrap gap-3 mt-3">
              {products.filter((p) => p.kind !== "logo").map((p) => (
                <div key={p.id} className="relative w-20 h-20 rounded-lg border border-zinc-700 bg-[conic-gradient(#27272a_90deg,#18181b_90deg_180deg,#27272a_180deg_270deg,#18181b_270deg)] bg-[length:16px_16px] overflow-hidden">
                  <img src={`/api/product/${p.id}`} alt={p.name} className="w-full h-full object-contain" />
                  <button onClick={() => delProduct(p.id)} className="absolute top-0.5 right-0.5 text-[10px] bg-black/70 text-white rounded px-1">✕</button>
                </div>
              ))}
              <label className="w-20 h-20 rounded-lg border border-dashed border-zinc-700 bg-zinc-800/40 flex items-center justify-center cursor-pointer text-2xl text-zinc-500">
                {prodBusy ? "…" : "+"}
                <input type="file" accept="image/png" className="hidden" onChange={(e) => uploadProduct(e.target.files?.[0], "product")} />
              </label>
            </div>
          </div>

          <div className="mt-5">
            <div className="text-sm font-semibold text-zinc-200">Logo / brand design (transparent PNG)</div>
            <div className="text-zinc-400 text-sm">Your logo and brand marks. Uzi infuses these into the imagery (colors + a tasteful logo placement) for both digital and physical brands.</div>
            <div className="flex flex-wrap gap-3 mt-3">
              {products.filter((p) => p.kind === "logo").map((p) => (
                <div key={p.id} className="relative w-20 h-20 rounded-lg border border-zinc-700 bg-[conic-gradient(#27272a_90deg,#18181b_90deg_180deg,#27272a_180deg_270deg,#18181b_270deg)] bg-[length:16px_16px] overflow-hidden">
                  <img src={`/api/product/${p.id}`} alt={p.name} className="w-full h-full object-contain" />
                  <button onClick={() => delProduct(p.id)} className="absolute top-0.5 right-0.5 text-[10px] bg-black/70 text-white rounded px-1">✕</button>
                </div>
              ))}
              <label className="w-20 h-20 rounded-lg border border-dashed border-zinc-700 bg-zinc-800/40 flex items-center justify-center cursor-pointer text-2xl text-zinc-500">
                {prodBusy ? "…" : "+"}
                <input type="file" accept="image/png" className="hidden" onChange={(e) => uploadProduct(e.target.files?.[0], "logo")} />
              </label>
            </div>
          </div>
        </Card>
      )}

      {step === 3 && (() => {
        const s = cfg.inputs?.story || {};
        const depth = s.depth || "mvs";
        const realms = realmsForDepth(depth);
        const filled = Array.isArray(s.realms) && s.realms.length > 0;
        return (
        <Card className="p-7">
          <h3 className="text-xl font-bold">Your campaign Story</h3>
          <p className="text-zinc-400 text-sm mt-1">Your content follows one hero's journey so posts progress instead of repeating. Give a few essentials — AI fills in the rest. You can edit anything.</p>

          <div className="mt-5">
            <label className="text-xs text-zinc-400">Depth — how much story to tell</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
              {DEPTHS.map((d) => (
                <button key={d.id} onClick={() => setStory({ depth: d.id })} title={d.blurb}
                  className={`p-2 rounded-lg border text-xs text-left ${depth === d.id ? "border-lime-400 bg-lime-400/10 text-accent" : "border-zinc-700 text-zinc-300"}`}>
                  <div className="font-semibold">{d.name}</div>
                  <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">{d.blurb}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            <div className="sm:col-span-2 text-xs text-zinc-500">The 3 essentials (the rest is optional — AI infers it):</div>
            <input value={s.seedHero || ""} onChange={(e) => setStory({ seedHero: e.target.value })} placeholder="Hero — who is your customer? (e.g. the person who wants something different)" className="bg-zinc-800 rounded-xl px-4 py-3 text-sm sm:col-span-2" />
            <input value={s.seedShadow || ""} onChange={(e) => setStory({ seedShadow: e.target.value })} placeholder="Shadow — what are they up against? (the problem / status quo)" className="bg-zinc-800 rounded-xl px-4 py-3 text-sm" />
            <input value={s.seedElixir || ""} onChange={(e) => setStory({ seedElixir: e.target.value })} placeholder="Elixir — the payoff your product unlocks" className="bg-zinc-800 rounded-xl px-4 py-3 text-sm" />
            <input value={s.seedWorld || ""} onChange={(e) => setStory({ seedWorld: e.target.value })} placeholder="Ordinary World — their before-state (optional)" className="bg-zinc-800 rounded-xl px-4 py-3 text-sm sm:col-span-2" />
          </div>

          <Btn className="w-full mt-4" disabled={storyBusy} onClick={genStory}>{storyBusy ? "Writing your story…" : filled ? "Re-generate story ✨" : "Auto-fill my story with AI ✨"}</Btn>
          <div className="text-[11px] text-zinc-600 mt-1">You (the brand) are the Mentor. Your customer is the Hero. The product is the Elixir.</div>

          {filled && (
            <div className="mt-5 space-y-3">
              <details open>
                <summary className="text-sm font-semibold cursor-pointer select-none">Cast · {CHARACTERS.length} characters</summary>
                <div className="mt-2 space-y-2">
                  {CHARACTERS.map((c) => (
                    <div key={c.id}>
                      <label className="text-[11px] text-zinc-500">{c.name}{c.core ? " ★" : ""} — {c.role}</label>
                      <textarea value={(s.characters || {})[c.id] || ""} onChange={(e) => setStory({ characters: { ...(s.characters || {}), [c.id]: e.target.value } })} rows={2} className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm mt-0.5" />
                    </div>
                  ))}
                </div>
              </details>
              <details open>
                <summary className="text-sm font-semibold cursor-pointer select-none">Realms · the {realms.length}-beat arc</summary>
                <div className="mt-2 space-y-2">
                  {realms.map((r, i) => {
                    const beat = (s.realms || []).find((x: any) => x.id === r.id)?.beat || "";
                    return (
                      <div key={r.id}>
                        <label className="text-[11px] text-zinc-500">{i + 1}. {r.name} — <span className="text-zinc-600">{r.fn}</span></label>
                        <textarea value={beat} onChange={(e) => { const realmsArr = realms.map((rr) => ({ id: rr.id, name: rr.name, beat: rr.id === r.id ? e.target.value : ((s.realms || []).find((x: any) => x.id === rr.id)?.beat || "") })); setStory({ realms: realmsArr }); }} rows={2} className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm mt-0.5" />
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>
          )}
        </Card>
        );
      })()}

      {step === 4 && (
        <Card className="p-7">
          <h3 className="text-xl font-bold">Set your 7 pillars</h3>
          <p className="text-zinc-400 text-sm mt-1">{isDigital ? "Digital map" : "Physical map"} — toggle pillars, set each one's format + which channels it posts to, and how often.</p>
          <div className="space-y-2 mt-5">
            {PILLARS.map((p) => {
              const pc = cfg.pillars?.[p.id] || {};
              const on = pc.on ?? true;
              const freq = pc.freq ?? "weekly";
              const cities = pc.cities ?? "";
              const media = pc.media ?? p.media;
              const chans: string[] = pc.channels ?? p.channels ?? [];
              const setP = (patch: any) => u({ pillars: { ...cfg.pillars, [p.id]: { on, freq, cities, media, channels: chans, ...patch } } });
              const toggleChan = (cid: string) => setP({ channels: chans.includes(cid) ? chans.filter((x) => x !== cid) : [...chans, cid] });
              const isNowin = /\[city\]/i.test(p.name);
              return (
                <div key={p.id} className={`rounded-xl border ${on ? "border-zinc-700 bg-zinc-800/50" : "border-zinc-800 bg-zinc-900/40 opacity-60"}`}>
                  <div className="flex items-center gap-4 p-3">
                    <button onClick={() => setP({ on: !on })} className={`w-10 h-6 rounded-full relative shrink-0 ${on ? "bg-accent" : "bg-zinc-700"}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full bg-zinc-950 transition-all ${on ? "left-[18px]" : "left-0.5"}`} /></button>
                    <div className="flex-1 min-w-0"><div className="font-semibold text-sm">{p.id}. {p.name}</div><div className="text-zinc-500 text-xs truncate">{p.desc}</div></div>
                    <select value={freq} onChange={(e) => setP({ freq: e.target.value })} className="bg-zinc-800 rounded-lg text-xs px-2 py-1.5">
                      <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="biweekly">2× / week</option><option value="monthly">Monthly</option>
                    </select>
                  </div>
                  {on && (
                    <div className="px-3 pb-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-zinc-400 w-16 shrink-0">Format:</span>
                        <select value={media} onChange={(e) => setP({ media: e.target.value })} className="bg-zinc-800 rounded-lg text-xs px-2 py-1.5">
                          <option value="video">Video</option>
                          <option value="visual">Image + Video</option>
                          <option value="image">Image</option>
                          <option value="graphic">Graphic</option>
                          <option value="text">Text</option>
                          <option value="audio">Audio</option>
                        </select>
                      </div>
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className="text-xs text-zinc-400 w-16 shrink-0 pt-1">Channels:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {CHANNELS.map((c) => {
                            const sel = chans.includes(c.id);
                            return (
                              <button key={c.id} onClick={() => toggleChan(c.id)} className={`px-2.5 py-1 rounded-full text-xs border ${sel ? "border-lime-400 bg-lime-400 text-zinc-950 font-medium" : "border-zinc-700 text-zinc-300"}`}>
                                {sel ? "✓ " : ""}{c.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {isNowin && (
                        <div>
                          <label className="text-xs text-zinc-400">Cities (comma-separated) — one post per city, each anchored to that city <span className="text-accent">*required</span></label>
                          <input value={cities} onChange={(e) => setP({ cities: e.target.value })} placeholder="e.g. Catania, Messina, Siracusa" className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm mt-1" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {step === 5 && (
        <Card className="p-7">
          <h3 className="text-xl font-bold">Connect outputs</h3>
          <p className="text-zinc-400 text-sm mt-1">Pick a channel, then the formats you want. Each format becomes its own tailored post + preview. (Live publishing is Phase 3.)</p>
          <div className="space-y-3 mt-5">
            {CHANNELS.map((c) => {
              const formats = CHANNEL_FORMATS[c.id] || [];
              const anyOn = formats.some((f) => cfg.channels?.[`${c.id}:${f.id}`]);
              return (
                <div key={c.id} className={`p-4 rounded-xl border ${anyOn ? "border-lime-400/60 bg-lime-400/5" : "border-zinc-800 bg-zinc-800/40"}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl text-accent">{c.glyph}</span>
                    <span className="font-semibold text-sm">{c.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formats.map((f) => {
                      const key = `${c.id}:${f.id}`;
                      const on = !!cfg.channels?.[key];
                      return (
                        <button key={f.id} onClick={() => u({ channels: { ...cfg.channels, [key]: !on } })}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${on ? "border-lime-400 bg-lime-400 text-zinc-950" : "border-zinc-700 bg-zinc-900 text-zinc-300"}`}>
                          {on ? "✓ " : ""}{f.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {step === 6 && (
        <Card className="p-7">
          <h3 className="text-xl font-bold">Cadence</h3>
          <p className="text-zinc-400 text-sm mt-1">How aggressively should the machine fire?</p>
          <div className="grid sm:grid-cols-3 gap-3 mt-5">
            {[["chill", "Chill", "3× / week"], ["steady", "Steady", "Daily"], ["machinegun", "Machine gun", "Multi-daily"]].map(([id, t, d]) => (
              <button key={id} onClick={() => u({ cadence: id })} className={`p-5 rounded-xl border text-left ${cfg.cadence === id ? "border-lime-400 bg-lime-400/5" : "border-zinc-800 bg-zinc-800/40"}`}>
                <div className="font-bold">{t}</div><div className="text-zinc-400 text-sm">{d}</div>
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="flex justify-between mt-6">
        <Btn kind="ghost" onClick={() => setStep(Math.max(0, step - 1))} style={{ visibility: step === 0 ? "hidden" : "visible" }}>Back</Btn>
        <Btn onClick={next}>{step < STEPS.length - 1 ? "Continue" : "Build my calendar →"}</Btn>
      </div>
    </div>
  );
}
