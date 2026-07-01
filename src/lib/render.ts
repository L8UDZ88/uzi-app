// Video assembly + mastering via Shotstack (cloud renderer). Direct REST, no SDK.
// Builds a timeline from a stock clip + voiceover + optional music, returns an MP4.
// SHOTSTACK_ENV: "stage" (free sandbox, watermarked) or "v1" (production). Defaults to stage.

export function renderEnabled(): boolean {
  return !!process.env.SHOTSTACK_API_KEY;
}
const ENV = process.env.SHOTSTACK_ENV || "stage";
const BASE = `https://api.shotstack.io/${ENV}`;

type TimelineOpts = {
  stillUrl?: string;   // the generated on-brand still (product baked in) — primary path
  clipUrl?: string;    // an animated or stock video clip
  clipSeconds?: number; // the clip's real duration — we slow it to stretch across `length` (no loop)
  clipLoopSeg?: number; // legacy fallback if clipSeconds is unknown
  voUrl?: string;
  musicUrl?: string;
  musicLoopSeg?: number; // tile the music every N seconds to cover the full length (default 30)
  productUrl?: string; // only overlaid in the stock-clip path
  logoUrl?: string;    // optional brand logo overlay (from Brand Design) — the ONLY on-video overlay
  length: number;      // total video length (kept > voiceover length so VO is never cut)
  width: number;
  height: number;
  title?: string;      // (ignored — no AI text is burned onto the video)
};

export function buildTimeline(o: TimelineOpts) {
  // Track order = layer order (first track is on top).
  const tracks: any[] = [];
  // NOTE: no auto text overlay. Any on-video overlay must be a brand asset (logo / brand-name
  // logotype) from Brand Design — never AI caption text burned onto the video.
  if (o.logoUrl) {
    tracks.push({
      clips: [{ asset: { type: "image", src: o.logoUrl }, start: 0, length: o.length, fit: "none", scale: 0.18, position: "topLeft", offset: { x: 0.05, y: -0.06 }, opacity: 0.9 }],
    });
  }
  if (o.stillUrl) {
    // PRIMARY: animate the on-brand still with a slow zoom (product already in the image).
    tracks.push({
      clips: [{ asset: { type: "image", src: o.stillUrl }, start: 0, length: o.length, effect: "zoomIn", fit: "cover" }],
    });
  } else {
    // Animated/stock clip background (+ product overlay only in the stock path).
    if (o.productUrl) {
      tracks.push({
        clips: [{ asset: { type: "image", src: o.productUrl }, start: 0, length: o.length, fit: "none", scale: 0.45, position: "bottomRight", offset: { x: -0.04, y: 0.06 } }],
      });
    }
    // Slow the clip down to STRETCH across the full length — one continuous shot, no loop, no
    // freeze. (Shotstack `speed` < 1 = slow motion.) If the clip is already long enough, play 1x.
    const srcDur = o.clipSeconds && o.clipSeconds > 0 ? o.clipSeconds : (o.clipLoopSeg && o.clipLoopSeg > 0 ? o.clipLoopSeg : o.length);
    const speed = Math.max(0.25, Math.min(1, srcDur / o.length));
    tracks.push({ clips: [{ asset: { type: "video", src: o.clipUrl, speed }, start: 0, length: o.length, fit: "cover" }] });
  }
  // Voiceover
  if (o.voUrl) tracks.push({ clips: [{ asset: { type: "audio", src: o.voUrl }, start: 0, length: o.length }] });
  // Music bed, ducked under the voiceover. Tile the (~30s) score so it ALWAYS covers the full
  // video length (which is longer than the voiceover) — it never cuts out early.
  if (o.musicUrl) {
    const seg = o.musicLoopSeg && o.musicLoopSeg > 0 ? o.musicLoopSeg : 30;
    const vol = o.voUrl ? 0.15 : 0.6;
    const mclips: any[] = [];
    for (let s = 0; s < o.length; s += seg) {
      mclips.push({ asset: { type: "audio", src: o.musicUrl, volume: vol }, start: s, length: Math.min(seg, o.length - s) });
    }
    tracks.push({ clips: mclips });
  }

  return {
    timeline: { background: "#000000", tracks },
    output: { format: "mp4", size: { width: o.width, height: o.height } },
  };
}

// Channel-native output size for a format.
export function aspectSize(format: string): { width: number; height: number } {
  const f = (format || "").toLowerCase();
  if (f === "long" || f === "article") return { width: 1920, height: 1080 };            // 16:9
  if (f === "feed" || f === "post" || f === "carousel") return { width: 1080, height: 1080 }; // 1:1
  return { width: 1080, height: 1920 };                                                  // 9:16 vertical (reel/short/story/video)
}

type SpliceOpts = {
  clipUrl: string;
  start: number;        // in-point into the source (seconds)
  length: number;       // clip duration (seconds)
  width: number;
  height: number;
  musicUrl?: string;
  musicLoopSeg?: number;
  logoUrl?: string;
  captions?: { text: string; start: number; length: number }[]; // burned captions, timed relative to the clip
};

// Trim a source video to [start, start+length] and output at the channel aspect. One clean cut,
// played at 1x. Optional burned captions (timed to the trimmed clip) and a logo overlay.
export function buildSpliceTimeline(o: SpliceOpts) {
  const tracks: any[] = [];
  if (o.captions && o.captions.length) {
    tracks.push({
      clips: o.captions.map((c) => ({
        asset: { type: "title", text: c.text, style: "subtitle", size: "medium", position: "bottom" },
        start: Math.max(0, c.start), length: Math.max(0.4, c.length),
      })),
    });
  }
  if (o.logoUrl) {
    tracks.push({ clips: [{ asset: { type: "image", src: o.logoUrl }, start: 0, length: o.length, fit: "none", scale: 0.16, position: "topLeft", offset: { x: 0.05, y: -0.06 }, opacity: 0.9 }] });
  }
  tracks.push({ clips: [{ asset: { type: "video", src: o.clipUrl, trim: Math.max(0, o.start) }, start: 0, length: o.length, fit: "cover" }] });
  if (o.musicUrl) {
    const seg = o.musicLoopSeg && o.musicLoopSeg > 0 ? o.musicLoopSeg : 30;
    const mclips: any[] = [];
    for (let s = 0; s < o.length; s += seg) mclips.push({ asset: { type: "audio", src: o.musicUrl, volume: 0.12 }, start: s, length: Math.min(seg, o.length - s) });
    tracks.push({ clips: mclips });
  }
  return { timeline: { background: "#000000", tracks }, output: { format: "mp4", size: { width: o.width, height: o.height } } };
}

type AudiogramOpts = {
  audioUrl: string;
  start: number;         // in-point into the source audio (seconds)
  length: number;        // clip duration (seconds)
  width: number;
  height: number;
  title?: string;        // brand/episode label shown at top
  logoUrl?: string;
  captions?: { text: string; start: number; length: number }[];
  audioOnly?: boolean;   // true → output raw trimmed audio (mp3) for Podcast
};

// Turn an audio clip into an audiogram: a branded dark card with the brand logo/label and
// timed captions over the trimmed audio. audioOnly → a raw trimmed MP3 for Podcast.
export function buildAudiogramTimeline(o: AudiogramOpts) {
  const trimmedAudio = { asset: { type: "audio", src: o.audioUrl, trim: Math.max(0, o.start) }, start: 0, length: o.length };
  if (o.audioOnly) {
    return { timeline: { background: "#000000", tracks: [{ clips: [trimmedAudio] }] }, output: { format: "mp3" } };
  }
  const tracks: any[] = [];
  if (o.captions && o.captions.length) {
    tracks.push({ clips: o.captions.map((c) => ({ asset: { type: "title", text: c.text, style: "subtitle", size: "medium", position: "center" }, start: Math.max(0, c.start), length: Math.max(0.4, c.length) })) });
  }
  if (o.title) {
    tracks.push({ clips: [{ asset: { type: "title", text: o.title, style: "minimal", size: "small", position: "top" }, start: 0, length: o.length }] });
  }
  if (o.logoUrl) {
    tracks.push({ clips: [{ asset: { type: "image", src: o.logoUrl }, start: 0, length: o.length, fit: "none", scale: 0.22, position: "top", offset: { x: 0, y: -0.12 }, opacity: 0.95 }] });
  }
  tracks.push({ clips: [trimmedAudio] });
  return { timeline: { background: "#0B0B0C", tracks }, output: { format: "mp4", size: { width: o.width, height: o.height } } };
}

export async function shotstackRender(timeline: any): Promise<{ id?: string; error?: string }> {
  const key = process.env.SHOTSTACK_API_KEY;
  if (!key) return { error: "No Shotstack key." };
  try {
    const r = await fetch(`${BASE}/render`, {
      method: "POST",
      headers: { "x-api-key": key, "content-type": "application/json" },
      body: JSON.stringify(timeline),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) return { error: `Shotstack: ${j?.response?.error || j?.message || `HTTP ${r.status}`}` };
    return { id: j?.response?.id };
  } catch (e: any) {
    return { error: `Shotstack: ${String(e?.message || e)}` };
  }
}

export async function shotstackStatus(id: string): Promise<{ status?: string; url?: string; error?: string }> {
  const key = process.env.SHOTSTACK_API_KEY;
  if (!key) return { error: "No Shotstack key." };
  try {
    const r = await fetch(`${BASE}/render/${id}`, { headers: { "x-api-key": key } });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) return { error: `Shotstack: HTTP ${r.status}` };
    return { status: j?.response?.status, url: j?.response?.url };
  } catch (e: any) {
    return { error: `Shotstack: ${String(e?.message || e)}` };
  }
}
