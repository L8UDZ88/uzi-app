"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Btn } from "./ui";
import { pillarsFor, CHANNELS, CONTENT_FORMATS, CAMPAIGN_TYPES, channelsForFormat, formatsForPillar } from "@/lib/constants";
import { HERO_FRAME_FIELDS } from "@/lib/heroframe";
import { GROWFAST_HERO_FRAME, GROWFAST_PROFILE, isGrowFastBrand, BRAIN_LOCK_WARNING } from "@/lib/presets";

const STEPS = ["Offer", "Brain", "Profile", "Story", "Pillars"];

// A single typed content-library folder picker (Documents / Audio / Video). Connects its own
// Drive folder via the `slot` param so each library is a distinct, visible source.
function LibraryPicker({ campaignId, slot, label, hint, lib, onPicked }: { campaignId: string; slot: string; label: string; hint: string; lib: any; onPicked: (info: any) => void; }) {
  const [q, setQ] = useState("");
  const [folders, setFolders] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const search = async (v: string) => { setQ(v); try { const d = await (await fetch(`/api/google/folders?q=${encodeURIComponent(v)}`)).json(); setFolders(d.folders || []); } catch { setFolders([]); } };
  const pick = async (f: any) => {
    setBusy(true);
    const d = await (await fetch(`/api/google/connect-folder`, { method: "POST", body: JSON.stringify({ campaignId, folderId: f.id, folderName: f.name, slot }) })).json();
    setBusy(false);
    if (d.ok) { onPicked({ folderId: f.id, folderName: f.name, fileCount: d.fileCount }); setOpen(false); setFolders([]); }
  };
  return (
    <div className={`p-4 rounded-xl border ${lib?.folderId ? "border-lime-400/60 bg-lime-400/5" : "border-zinc-800 bg-zinc-800/40"}`}>
      <div className="font-semibold text-sm">{label}</div>
      <div className="text-[11px] text-zinc-500">{hint}</div>
      {lib?.folderId && !open ? (
        <div className="mt-2 text-xs text-zinc-200">✓ {lib.folderName} <span className="text-zinc-500">· {lib.fileCount ?? 0} files</span> <button onClick={() => { setOpen(true); search(""); }} className="ml-1 underline text-zinc-400">Change</button></div>
      ) : (
        <div className="mt-2">
          <input value={q} onChange={(e) => search(e.target.value)} onFocus={() => folders.length === 0 && search("")} placeholder="Search folders…" className="w-full bg-zinc-800 rounded-lg px-3 py-1.5 text-xs mb-1.5" />
          <div className="max-h-32 overflow-auto divide-y divide-zinc-800 rounded-lg border border-zinc-800">
            {folders.map((f) => <button key={f.id} disabled={busy} onClick={() => pick(f)} className="w-full text-left px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50">📁 {f.name}</button>)}
            {folders.length === 0 && <div className="px-3 py-1.5 text-[11px] text-zinc-500">Type to search folders.</div>}
          </div>
          {busy && <div className="text-[11px] text-accent mt-1">Connecting…</div>}
        </div>
      )}
    </div>
  );
}

export default function Wizard({ campaignId, embedded, stepProp, onStep, onExit }: { campaignId: string; embedded?: boolean; stepProp?: number; onStep?: (i: number) => void; onExit?: () => void }) {
  const r = useRouter();
  const [innerStep, setInnerStep] = useState(0);
  // When embedded in the dashboard, the step is controlled by the parent's unified nav.
  const step = embedded && typeof stepProp === "number" ? stepProp : innerStep;
  const setStep = (i: number) => { if (embedded && onStep) onStep(i); else setInnerStep(i); };
  const [cfg, setCfg] = useState<any>({ campaignType: "digital", pillars: {}, channels: {}, inputs: {}, cadence: "steady" });
  const [profileBusy, setProfileBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [drive, setDrive] = useState<any>({ configured: false, connected: false });
  const [folders, setFolders] = useState<any[]>([]);
  const [folderQ, setFolderQ] = useState("");
  const [driveBusy, setDriveBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [social, setSocial] = useState<any>({ platforms: [] });
  const [products, setProducts] = useState<any[]>([]);
  const [prodBusy, setProdBusy] = useState(false);
  const [storyBusy, setStoryBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/campaigns/${campaignId}`).then((x) => x.json()).then((d) => {
      const c = d.campaign;
      if (c) {
        const gf = isGrowFastBrand(c.name);
        const inp = c.inputs || {};
        const bk = inp.brandKit || {};
        // GrowFast is locked to its brain content: seed Profile + Hero Frame from the fixed preset
        // wherever the field is still empty (fully editable after).
        const hasStory = inp.story && Object.values(inp.story).some((v: any) => String(v || "").trim());
        const story = !hasStory && gf ? { ...GROWFAST_HERO_FRAME } : inp.story;
        const brandKit = gf
          ? { ...bk, product: bk.product || GROWFAST_PROFILE.product, donts: bk.donts || GROWFAST_PROFILE.donts, phrases: bk.phrases || GROWFAST_PROFILE.phrases }
          : bk;
        setCfg({
          campaignType: c.campaignType || "physical",
          name: c.name, handle: c.handle,
          tagline: c.tagline || (gf ? GROWFAST_PROFILE.tagline : ""),
          region: c.region || (gf ? GROWFAST_PROFILE.region : ""),
          voice: c.voice || (gf ? GROWFAST_PROFILE.voice : ""),
          pillars: c.pillars || {}, channels: c.channels || {},
          inputs: { ...inp, brandKit, ...(story ? { story } : {}) },
          cadence: c.cadence || "steady",
        });
      }
      setLoaded(true);
    });
    fetch(`/api/google/status?campaignId=${campaignId}`).then((x) => x.json()).then(setDrive).catch(() => {});
    fetch(`/api/social/status?campaignId=${campaignId}`).then((x) => x.json()).then(setSocial).catch(() => {});
    fetch(`/api/products?campaignId=${campaignId}`).then((x) => x.json()).then((d) => setProducts(d.products || [])).catch(() => {});
    // Returning from Google OAuth lands here with ?drive=... — jump to the Inputs step.
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("drive")) setStep(1);
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

  // Drag & drop → upload file contents and ingest their text into the brain (used alongside Drive).
  const handleUpload = async (fileList: FileList | null) => {
    const arr = Array.from(fileList || []);
    if (!arr.length) return;
    setUploadBusy(true);
    try {
      const files = await Promise.all(arr.map(async (f) => ({
        name: f.name, mime: f.type,
        dataUrl: await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); }),
      })));
      const d = await (await fetch(`/api/upload`, { method: "POST", body: JSON.stringify({ campaignId, files }) })).json();
      if (d.ok) u({ inputs: { ...cfg.inputs, uploads: [...(cfg.inputs?.uploads || []), ...arr.map((f) => f.name)] } });
      else alert(d.error || "Couldn't read those files — try again.");
    } catch { alert("Upload failed — try again."); } finally { setUploadBusy(false); }
  };

  // Re-Sync all inputs: reset entered content to empty and re-pull the brain from connected sources.
  const resyncAll = async () => {
    if (typeof window !== "undefined" && !window.confirm("Reset all entered content (Profile, Story, brain) and re-sync everything from your connected Drive + libraries?")) return;
    setSyncBusy(true); setSyncMsg("Re-syncing from your inputs…");
    try {
      const d = await (await fetch(`/api/ingest`, { method: "POST", body: JSON.stringify({ campaignId, resync: true }) })).json();
      if (d.ok) { setSyncMsg("✓ Reset & re-synced — reloading…"); setTimeout(() => window.location.reload(), 700); }
      else setSyncMsg(d.error || "Couldn't re-sync — try again.");
    } catch { setSyncMsg("Couldn't re-sync — try again."); } finally { setSyncBusy(false); }
  };

  const syncLibraries = async () => {
    setSyncBusy(true); setSyncMsg("");
    try {
      const d = await (await fetch(`/api/ingest`, { method: "POST", body: JSON.stringify({ campaignId }) })).json();
      if (d.ok) setSyncMsg(`✓ Brain updated from ${d.docs} document${d.docs === 1 ? "" : "s"}${d.transcripts ? ` + ${d.transcripts} transcript${d.transcripts === 1 ? "" : "s"}` : ""}.`);
      else setSyncMsg(d.error || "Couldn't sync — try again.");
    } catch { setSyncMsg("Couldn't sync — try again."); } finally { setSyncBusy(false); }
  };

  // Clear the editable answers on a page (keeps the brand name).
  const clearProfile = () => {
    if (typeof window !== "undefined" && !window.confirm("Clear the profile fields on this page?")) return;
    u({ tagline: "", region: "", voice: "", inputs: { ...cfg.inputs, brandKit: { ...(cfg.inputs?.brandKit || {}), product: "", donts: "", phrases: "" } } });
  };
  const clearStory = () => {
    if (typeof window !== "undefined" && !window.confirm("Clear all Story fields on this page?")) return;
    u({ inputs: { ...cfg.inputs, story: {} } });
  };

  const u = (patch: any) => setCfg({ ...cfg, ...patch });
  const save = (extra: any = {}) => fetch(`/api/campaigns/${campaignId}`, { method: "PUT", body: JSON.stringify({ ...cfg, ...extra }) });

  // Story Engine: the campaign's Hero Frame brief. AI drafts every field from the brand kit +
  // the connected Drive folder ("master brain"); the user reviews/edits. Fill-only-blanks.
  const setStory = (patch: any) => u({ inputs: { ...cfg.inputs, story: { ...(cfg.inputs?.story || {}), ...patch } } });
  const genStory = async () => {
    if (isGrowFastBrand(cfg.name) && typeof window !== "undefined" && !window.confirm(BRAIN_LOCK_WARNING)) return;
    setStoryBusy(true);
    const provided = cfg.inputs?.story || {};
    try {
      const d = await (await fetch("/api/story/heroframe", { method: "POST", body: JSON.stringify({ campaignId, provided }) })).json();
      if (d.brief) setStory(d.brief);
      else alert(d.error || "Couldn't draft the story — try again.");
    } catch {
      alert("Couldn't reach the story service — try again.");
    } finally {
      setStoryBusy(false);
    }
  };

  // Draft the Brand profile from the connected Drive folder ("master brain"). Fill-only-blanks.
  const genProfile = async () => {
    if (isGrowFastBrand(cfg.name) && typeof window !== "undefined" && !window.confirm(BRAIN_LOCK_WARNING)) return;
    setProfileBusy(true);
    try {
      const bk = cfg.inputs?.brandKit || {};
      const current = { name: cfg.name, tagline: cfg.tagline, region: cfg.region, voice: cfg.voice, brandKit: bk };
      const d = await (await fetch("/api/profile/draft", { method: "POST", body: JSON.stringify({ campaignId, current }) })).json();
      if (d.profile) {
        const p = d.profile;
        u({
          tagline: cfg.tagline || p.tagline || "",
          region: cfg.region || p.region || "",
          voice: cfg.voice || p.voice || "",
          inputs: { ...cfg.inputs, brandKit: { ...bk, product: bk.product || p.product || "", donts: bk.donts || p.donts || "", phrases: bk.phrases || p.phrases || "" } },
        });
      } else alert(d.error || "Couldn't draft the profile — try again.");
    } catch {
      alert("Couldn't reach the profile service — try again.");
    } finally {
      setProfileBusy(false);
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
    else { await save({ onboarded: true }); await fetch(`/api/campaigns/${campaignId}/schedule`, { method: "POST" }); if (embedded && onExit) onExit(); else r.push(`/campaign/${campaignId}`); }
  };
  // Jump directly to any setup step (saves first) — the top stepper is clickable.
  const goStep = async (i: number) => { await save(); setStep(i); };
  // Jump straight to the Calendar without hitting Back.
  const goCalendar = async () => { await save({ onboarded: true }); if (embedded && onExit) onExit(); else r.push(`/campaign/${campaignId}`); };

  if (!loaded) return <div className="p-10 text-zinc-500">Loading…</div>;
  const PILLARS = pillarsFor(cfg.campaignType);
  const isDigital = cfg.campaignType === "digital";

  return (
    <div className={embedded ? "" : "max-w-3xl mx-auto px-6 py-10"}>
      {!embedded && (
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <button key={s} onClick={() => goStep(i)} className="flex-1 text-left group">
            <div className={`h-1.5 rounded-full ${i <= step ? "bg-accent" : "bg-zinc-800 group-hover:bg-zinc-700"}`} />
            <div className={`text-xs mt-2 ${i === step ? "text-accent font-semibold" : i < step ? "text-zinc-200" : "text-zinc-600 group-hover:text-zinc-400"}`}>{s}</div>
          </button>
        ))}
        <button onClick={goCalendar} className="flex-1 text-left group">
          <div className="h-1.5 rounded-full bg-zinc-800 group-hover:bg-zinc-700" />
          <div className="text-xs mt-2 text-zinc-500 group-hover:text-accent">Calendar →</div>
        </button>
      </div>
      )}

      {step === 0 && (
        <Card className="p-7">
          <h3 className="text-xl font-bold">Your offer — what are you selling?</h3>
          <p className="text-zinc-400 text-sm mt-1">Digital or physical product. This sets your content-pillar map and story shape.</p>
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

      {step === 2 && (
        <Card className="p-7">
          <h3 className="text-xl font-bold">Brand profile</h3>
          <p className="text-zinc-400 text-sm mt-1">Just identity + guardrails. Tagline, positioning, voice and product are written from your Brain — this page only holds what the Brain can't (name, language, hard rules).</p>
          <div className="flex gap-2 mt-3">
            <Btn className="flex-1" disabled={profileBusy} onClick={genProfile}>{profileBusy ? "Drafting from your brand…" : "Draft profile from my brand ✨"}</Btn>
            <Btn kind="ghost" onClick={clearProfile}>Clear</Btn>
          </div>
          <div className="text-[11px] text-zinc-600 mt-1 mb-3">Pulls from your connected Drive folder (Inputs step). Fills blanks; keeps anything you've written.</div>
          {/* Identity + guardrails — the only things the Brain can't provide */}
          <div className="grid sm:grid-cols-2 gap-3 mt-5">
            <input placeholder="Brand name" className="bg-zinc-800 rounded-xl px-4 py-3 text-sm" value={cfg.name || ""} onChange={(e) => u({ name: e.target.value })} />
            <input placeholder="Handle (@brand)" className="bg-zinc-800 rounded-xl px-4 py-3 text-sm" value={cfg.handle || ""} onChange={(e) => u({ handle: e.target.value })} />
            <select value={cfg.inputs?.brandKit?.language || "en"} onChange={(e) => u({ inputs: { ...cfg.inputs, brandKit: { ...(cfg.inputs?.brandKit || {}), language: e.target.value } } })} className="bg-zinc-800 rounded-xl px-4 py-3 text-sm">
              <option value="en">Language: English</option>
              <option value="it">Language: Italian</option>
              <option value="bilingual">Language: Bilingual (EN + IT)</option>
            </select>
            <input placeholder="Signature phrases (comma-sep) — optional" className="bg-zinc-800 rounded-xl px-4 py-3 text-sm" value={cfg.inputs?.brandKit?.phrases || ""} onChange={(e) => u({ inputs: { ...cfg.inputs, brandKit: { ...(cfg.inputs?.brandKit || {}), phrases: e.target.value } } })} />
            <input placeholder="Never do… (hard rule — e.g. never AI-draw the product)" className="bg-zinc-800 rounded-xl px-4 py-3 text-sm sm:col-span-2" value={cfg.inputs?.brandKit?.donts || ""} onChange={(e) => u({ inputs: { ...cfg.inputs, brandKit: { ...(cfg.inputs?.brandKit || {}), donts: e.target.value } } })} />
          </div>
          <p className="text-xs text-zinc-500 mt-2">Language and hard rules govern every generation. Everything else comes from your Brain.</p>

          <details className="mt-4">
            <summary className="text-sm font-semibold cursor-pointer select-none text-zinc-300">Advanced — override tagline / positioning / voice / product</summary>
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <input placeholder="Tagline" className="bg-zinc-800 rounded-xl px-4 py-3 text-sm" value={cfg.tagline || ""} onChange={(e) => u({ tagline: e.target.value })} />
              <input placeholder={isDigital ? "Category / ICP (e.g. B2B SaaS, ops teams)" : "Region (e.g. Sicily)"} className="bg-zinc-800 rounded-xl px-4 py-3 text-sm" value={cfg.region || ""} onChange={(e) => u({ region: e.target.value })} />
              <input placeholder="Voice (warm, bold, short punchy lines…)" className="bg-zinc-800 rounded-xl px-4 py-3 text-sm sm:col-span-2" value={cfg.voice || ""} onChange={(e) => u({ voice: e.target.value })} />
              <textarea placeholder="What is the product, exactly?" rows={2} className="bg-zinc-800 rounded-xl px-4 py-3 text-sm sm:col-span-2" value={cfg.inputs?.brandKit?.product || ""} onChange={(e) => u({ inputs: { ...cfg.inputs, brandKit: { ...(cfg.inputs?.brandKit || {}), product: e.target.value } } })} />
            </div>
            <div className="text-[11px] text-zinc-600 mt-2">Usually auto-filled from your Brain — leave blank to let the Brain drive.</div>
          </details>
        </Card>
      )}

      {step === 1 && (
        <Card className="p-7">
          <div className="relative text-center">
            <Btn kind="ghost" className="absolute right-0 top-0 text-xs" disabled={syncBusy} onClick={resyncAll}>{syncBusy ? "Re-syncing…" : "↻ Re-Sync all inputs"}</Btn>
            <h3 className="text-3xl font-bold">Connect Your Brain</h3>
            <p className="text-zinc-400 text-sm mt-1">{isDigital ? "Your source material — copywriting, frameworks, cornerstone content, product docs." : "Your cornerstone assets — one weekly input fuels everything."}</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-5">
            {/* LEFT — Inputs (everything that feeds the brain) */}
            <div className="xl:col-span-8 space-y-5">
              <div className="text-xs font-semibold text-accent uppercase tracking-wide">Inputs</div>
          <div className="grid sm:grid-cols-2 gap-4">
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
              <div className="text-zinc-400 text-sm mt-1">{uploadBusy ? "Reading & ingesting…" : cfg.inputs?.uploads?.length ? cfg.inputs.uploads.length + " files added — ingested into your brain" : "Drop docs (.docx/PDF/txt), copy, frameworks"}</div>
              <div className="text-[11px] text-zinc-600 mt-1">Works alongside Google Drive — both feed the brain together.</div>
              <input type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
            </label>
          </div>

          {drive.connected && (
            <div className="mt-6">
              <div className="text-sm font-semibold text-zinc-200">Content libraries <span className="text-[11px] font-normal text-zinc-500">— a separate folder per type, so it's clear what each post pulls from. Uzi splices these into posts.</span></div>
              <div className="grid sm:grid-cols-3 gap-3 mt-3">
                {([["documents", "Copywriting", ".docx / PDF — copy, frameworks, scripts"], ["audio", "Audio", "Podcasts, VO, recordings"], ["video", "Video", "Talking-head, demos, b-roll"]] as const).map(([slot, label, hint]) => (
                  <LibraryPicker key={slot} campaignId={campaignId} slot={slot} label={label} hint={hint}
                    lib={cfg.inputs?.libraries?.[slot]}
                    onPicked={(info) => u({ inputs: { ...cfg.inputs, libraries: { ...(cfg.inputs?.libraries || {}), [slot]: info } } })} />
                ))}
              </div>
              <div className="flex items-center gap-3 mt-3">
                <button onClick={syncLibraries} disabled={syncBusy} className="bg-accent text-zinc-950 font-semibold text-sm rounded-lg px-4 py-2 disabled:opacity-50">{syncBusy ? "Synthesizing…" : "Sync libraries into the brain ✨"}</button>
                {syncMsg && <span className="text-xs text-zinc-400">{syncMsg}</span>}
              </div>
              <div className="text-[11px] text-zinc-600 mt-1">Reads your Documents (+ any transcribed clips) and distills them into one grounded brain that all copy is written from — no invented facts.</div>
            </div>
          )}

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

            </div>

            {/* RIGHT — Outputs (channels connected for publishing) */}
            <div className="xl:col-span-4">
              <div className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">Outputs</div>
              <div className="text-[11px] text-zinc-500 mb-3">Channels connected for publishing. <span className="text-lime-400">Green</span> = ready, <span className="text-red-400">red</span> = connect it.</div>
              <div className="space-y-1.5">
                {CHANNELS.map((ch) => {
                  const p = (social.platforms || []).find((x: any) => x.platform === ch.id);
                  const connected = !!p?.connected;
                  return (
                    <div key={ch.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${connected ? "border-lime-400/50 bg-lime-400/5" : "border-red-500/40 bg-red-500/5"}`}>
                      <span className="text-sm text-zinc-200">{ch.glyph} {ch.name}</span>
                      <span className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-lime-400" : "bg-red-500"}`} title={connected ? "Connected" : "Not connected"} />
                    </div>
                  );
                })}
              </div>
              <div className="text-[11px] text-zinc-600 mt-3">Connect accounts in the Deliver tab.</div>
            </div>
          </div>
        </Card>
      )}

      {step === 3 && (() => {
        const s = cfg.inputs?.story || {};
        return (
        <Card className="p-7">
          <h3 className="text-xl font-bold">Your campaign Story — the Hero Frame</h3>
          <p className="text-zinc-400 text-sm mt-1">The one story every post advances, told in the Hero Frame's stages. AI drafts it from your brand + Brain; review and edit. ★ = load-bearing.</p>

          <div className="flex gap-2 mt-4">
            <Btn className="flex-1" disabled={storyBusy} onClick={genStory}>{storyBusy ? "Drafting from your brand…" : "Draft my story with AI ✨"}</Btn>
            <Btn kind="ghost" onClick={clearStory}>Clear</Btn>
          </div>

          {/* Hero Frame as an ordered narrative — the framework's own structure, stage by stage */}
          <div className="mt-5 border-l-2 border-zinc-800 pl-5 space-y-4">
            {HERO_FRAME_FIELDS.map((f, i) => (
              <div key={f.id} className="relative">
                <span className={`absolute -left-[26px] top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${f.core ? "bg-accent text-zinc-950" : "bg-zinc-700 text-zinc-300"}`}>{i + 1}</span>
                <label className="text-xs font-semibold text-zinc-200">{f.name}{f.core ? " ★" : ""}</label>
                <div className="text-[11px] text-zinc-600 mb-1">{f.hint}</div>
                <textarea value={s[f.id] || ""} onChange={(e) => setStory({ [f.id]: e.target.value })} rows={2} placeholder="Leave blank for AI to draft" className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm" />
              </div>
            ))}
          </div>
        </Card>
        );
      })()}

      {step === 4 && (
        <Card className="p-7">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-xl font-bold">Set your pillars</h3>
              <p className="text-zinc-400 text-sm mt-1">{isDigital ? "Digital map" : "Physical map"} — toggle pillars and set each one's format + channels.</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[11px] text-zinc-400 mb-1">Schedule</div>
              <div className="text-xs text-zinc-300 bg-zinc-800/60 rounded-lg px-3 py-2">1 pillar / day · Mon–Sun · 8am ET</div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-lime-400/30 bg-lime-400/5 p-4 text-center">
            <div className="text-sm font-bold tracking-tight">Customer-as-Hero pillar system</div>
            <p className="text-xs text-zinc-400 max-w-lg mx-auto mt-1">Each pillar is a stage in your customer's transformation — drawn from your Hero Frame in the Story step. The product only ever appears as the tool the hero picks up. Tune the format and channels per pillar below.</p>
          </div>

          <div className="space-y-2 mt-5">
            {PILLARS.map((p) => {
              const pc = cfg.pillars?.[p.id] || {};
              const on = pc.on ?? true;
              const freq = pc.freq ?? "weekly";
              const cities = pc.cities ?? "";
              // Only formats applicable to this pillar are offered (carousel excluded everywhere for now).
              const applicableFormats = formatsForPillar(p);
              const savedFormat = pc.format ?? p.format;
              // Auto-migrate any now-unavailable saved format (e.g. old carousel) to the pillar default.
              const format = applicableFormats.includes(savedFormat) ? savedFormat : p.format;
              const source = pc.source ?? p.source ?? "ai";
              const chans: string[] = pc.channels ?? p.channels ?? [];
              const allowedChans = channelsForFormat(format);
              // Only channels this format can natively carry are eligible; drop any stragglers.
              const selChans = chans.filter((cid) => allowedChans.includes(cid));
              const setP = (patch: any) => u({ pillars: { ...cfg.pillars, [p.id]: { on, freq, cities, format, source, channels: selChans, ...patch } } });
              // Changing format prunes selected channels to the new format's compatible set.
              const setFormat = (f: any) => setP({ format: f, channels: selChans.filter((cid) => channelsForFormat(f).includes(cid)) });
              const toggleChan = (cid: string) => setP({ channels: selChans.includes(cid) ? selChans.filter((x) => x !== cid) : [...selChans, cid] });
              const isNowin = /\[city\]/i.test(p.name);
              return (
                <div key={p.id} className={`rounded-xl border ${on ? "border-zinc-700 bg-zinc-800/50" : "border-zinc-800 bg-zinc-900/40 opacity-60"}`}>
                  <div className="flex items-center gap-4 p-3">
                    <button onClick={() => setP({ on: !on })} className={`w-10 h-6 rounded-full relative shrink-0 ${on ? "bg-accent" : "bg-zinc-700"}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full bg-zinc-950 transition-all ${on ? "left-[18px]" : "left-0.5"}`} /></button>
                    <div className="flex-1 min-w-0"><div className="font-semibold text-sm">{p.id}. {p.name}</div><div className="text-zinc-500 text-xs truncate">{p.desc}</div></div>
                  </div>
                  {on && (
                    <div className="px-3 pb-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-zinc-400 w-16 shrink-0">Format:</span>
                        <select value={format} onChange={(e) => setFormat(e.target.value)} className="bg-zinc-800 rounded-lg text-xs px-2 py-1.5">
                          {applicableFormats.map((fid) => { const f = CONTENT_FORMATS.find((x) => x.id === fid); return f ? <option key={f.id} value={f.id}>{f.name}</option> : null; })}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400 w-16 shrink-0">Source:</span>
                        <span className="text-xs text-zinc-300">{format === "longvideo" ? "Your uploaded video — webcam / screen-share (no AI)" : source === "real" ? "Real footage — your connected Drive folder" : "AI generated"}</span>
                      </div>
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className="text-xs text-zinc-400 w-16 shrink-0 pt-1">Channels:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {CHANNELS.filter((c) => allowedChans.includes(c.id)).map((c) => {
                            const sel = selChans.includes(c.id);
                            const spot = c.id === "spotify"; // audio track — shown in yellow
                            const on = spot ? "border-yellow-400 bg-yellow-400 text-zinc-950 font-medium" : "border-lime-400 bg-lime-400 text-zinc-950 font-medium";
                            const off = spot ? "border-yellow-400/50 text-yellow-300" : "border-zinc-700 text-zinc-300";
                            return (
                              <button key={c.id} onClick={() => toggleChan(c.id)} className={`px-2.5 py-1 rounded-full text-xs border ${sel ? on : off}`}>
                                {sel ? "✓ " : ""}{c.name}{spot ? " (audio)" : ""}
                              </button>
                            );
                          })}
                        </div>
                        <span className="text-[11px] text-zinc-500 pt-1 ml-auto shrink-0">→ {selChans.length} {selChans.length === 1 ? "post" : "posts"}</span>
                      </div>
                      <div className="text-[11px] text-zinc-600">Only channels that natively carry a {CONTENT_FORMATS.find((f) => f.id === format)?.name || format} are shown.</div>
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

      <div className="flex justify-between mt-6">
        <Btn kind="ghost" onClick={() => setStep(Math.max(0, step - 1))} style={{ visibility: step === 0 ? "hidden" : "visible" }}>Back</Btn>
        <Btn onClick={next}>{step < STEPS.length - 1 ? "Continue" : "Build my calendar →"}</Btn>
      </div>
    </div>
  );
}
