"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Btn } from "./ui";
import { pillarsFor, CHANNELS, CHANNEL_FORMATS, CAMPAIGN_TYPES } from "@/lib/constants";

const STEPS = ["Type", "Profile", "Inputs", "7 Pillars", "Outputs", "Cadence"];

export default function Wizard({ campaignId }: { campaignId: string }) {
  const r = useRouter();
  const [step, setStep] = useState(0);
  const [cfg, setCfg] = useState<any>({ campaignType: "physical", pillars: {}, channels: {}, inputs: {}, cadence: "steady" });
  const [loaded, setLoaded] = useState(false);
  const [drive, setDrive] = useState<any>({ configured: false, connected: false });
  const [folders, setFolders] = useState<any[]>([]);
  const [folderQ, setFolderQ] = useState("");
  const [driveBusy, setDriveBusy] = useState(false);

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
    // Returning from Google OAuth lands here with ?drive=... — jump to the Inputs step.
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("drive")) setStep(2);
  }, [campaignId]);

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
  const next = async () => {
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
        </Card>
      )}

      {step === 3 && (
        <Card className="p-7">
          <h3 className="text-xl font-bold">Set your 7 pillars</h3>
          <p className="text-zinc-400 text-sm mt-1">{isDigital ? "Digital map" : "Physical map"} — toggle which pillars run and how often.</p>
          <div className="space-y-2 mt-5">
            {PILLARS.map((p) => {
              const on = cfg.pillars?.[p.id]?.on ?? true;
              const freq = cfg.pillars?.[p.id]?.freq ?? "weekly";
              const setP = (patch: any) => u({ pillars: { ...cfg.pillars, [p.id]: { on, freq, ...patch } } });
              return (
                <div key={p.id} className={`flex items-center gap-4 p-3 rounded-xl border ${on ? "border-zinc-700 bg-zinc-800/50" : "border-zinc-800 bg-zinc-900/40 opacity-60"}`}>
                  <button onClick={() => setP({ on: !on })} className={`w-10 h-6 rounded-full relative shrink-0 ${on ? "bg-accent" : "bg-zinc-700"}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full bg-zinc-950 transition-all ${on ? "left-[18px]" : "left-0.5"}`} /></button>
                  <div className="flex-1 min-w-0"><div className="font-semibold text-sm">{p.id}. {p.name}</div><div className="text-zinc-500 text-xs truncate">{p.desc}</div></div>
                  <select value={freq} onChange={(e) => setP({ freq: e.target.value })} className="bg-zinc-800 rounded-lg text-xs px-2 py-1.5">
                    <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="biweekly">2× / week</option><option value="monthly">Monthly</option>
                  </select>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {step === 4 && (
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

      {step === 5 && (
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
