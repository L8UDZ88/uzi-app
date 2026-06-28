// Stock footage — provider-agnostic. Search/pull clips by keyword for the video engine.
// Pexels today (free, instant API). Storyblocks (and others) plug in behind the same
// interface once partner keys land — the rest of the app never changes.

export type StockClip = {
  id: string;
  provider: string;
  thumb: string;      // preview image
  download: string;   // mp4 URL to use in the render
  duration: number;   // seconds
  width: number;
  height: number;
  credit?: string;    // attribution (some providers require it)
};
export type Orientation = "portrait" | "landscape" | "square";

export function stockProviders(): string[] {
  const p: string[] = [];
  if (process.env.PEXELS_API_KEY) p.push("pexels");
  if (process.env.STORYBLOCKS_PUBLIC_KEY && process.env.STORYBLOCKS_PRIVATE_KEY) p.push("storyblocks");
  return p;
}
export function stockEnabled(): boolean {
  return stockProviders().length > 0;
}

export async function searchStock(query: string, orientation: Orientation = "portrait", provider?: string, perPage = 12): Promise<StockClip[]> {
  const prov = provider || stockProviders()[0];
  if (prov === "pexels") return searchPexels(query, orientation, perPage);
  // Storyblocks adapter slots in here (HMAC-signed) once partner keys are available.
  return [];
}

async function searchPexels(query: string, orientation: Orientation, perPage: number): Promise<StockClip[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key || !query.trim()) return [];
  try {
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=${perPage}`;
    const r = await fetch(url, { headers: { authorization: key } });
    if (!r.ok) return [];
    const j: any = await r.json();
    return (j.videos || []).map((v: any): StockClip => {
      const files = (v.video_files || []).filter((f: any) => f.file_type === "video/mp4").sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
      const best = files.find((f: any) => (f.height || 0) <= 1080) || files[0];
      return {
        id: String(v.id),
        provider: "pexels",
        thumb: v.image,
        download: best?.link || "",
        duration: v.duration || 0,
        width: v.width || 0,
        height: v.height || 0,
        credit: v.user?.name ? `Video by ${v.user.name} on Pexels` : "Pexels",
      };
    }).filter((c: StockClip) => c.download);
  } catch {
    return [];
  }
}

// Lightweight keyword extraction from a visual brief, for a default search query.
const STOP = new Set("a an the of to in on at for with and or but from into over under up down then this that these those it its is are was were be been being shot scene visual video footage clip handheld vertical horizontal candid feels like as no logos staged".split(/\s+/));
export function keywordsFromBrief(brief: string, max = 5): string {
  const words = (brief || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) { if (!seen.has(w)) { seen.add(w); out.push(w); } if (out.length >= max) break; }
  return out.join(" ");
}
