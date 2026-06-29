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
  clipUrl?: string;    // a stock video clip — fallback path
  voUrl?: string;
  musicUrl?: string;
  productUrl?: string; // only overlaid in the stock-clip path
  length: number;
  width: number;
  height: number;
  title?: string;
};

export function buildTimeline(o: TimelineOpts) {
  // Track order = layer order (first track is on top).
  const tracks: any[] = [];
  // Title/hook overlay (first few seconds) — top layer
  if (o.title) {
    tracks.push({
      clips: [{
        asset: { type: "title", text: o.title.slice(0, 120), style: "minimal", size: "medium", position: "center" },
        start: 0, length: Math.min(3.5, o.length), transition: { in: "fade", out: "fade" },
      }],
    });
  }
  if (o.stillUrl) {
    // PRIMARY: animate the on-brand still with a slow zoom (product already in the image).
    tracks.push({
      clips: [{ asset: { type: "image", src: o.stillUrl }, start: 0, length: o.length, effect: "zoomIn", fit: "cover" }],
    });
  } else {
    // FALLBACK: stock clip background + real product overlaid bottom-right.
    if (o.productUrl) {
      tracks.push({
        clips: [{ asset: { type: "image", src: o.productUrl }, start: 0, length: o.length, fit: "none", scale: 0.45, position: "bottomRight", offset: { x: -0.04, y: 0.06 } }],
      });
    }
    tracks.push({
      clips: [{ asset: { type: "video", src: o.clipUrl }, start: 0, length: o.length, fit: "cover" }],
    });
  }
  // Voiceover
  if (o.voUrl) tracks.push({ clips: [{ asset: { type: "audio", src: o.voUrl }, start: 0, length: o.length }] });
  // Music bed, ducked under the voiceover
  if (o.musicUrl) tracks.push({ clips: [{ asset: { type: "audio", src: o.musicUrl, volume: o.voUrl ? 0.15 : 0.6 }, start: 0, length: o.length }] });

  return {
    timeline: { background: "#000000", tracks },
    output: { format: "mp4", size: { width: o.width, height: o.height } },
  };
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
