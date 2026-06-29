// AI music score via Sonauto on fal.ai (reuses FAL_KEY). Async queue: submit -> poll -> audio URL.
// The render lays this under the voiceover (ducked) and trims it to the video length.

export function musicEnabled(): boolean {
  return !!process.env.FAL_KEY;
}
const MUSIC_MODEL = process.env.MUSIC_MODEL || "sonauto/v2/text-to-music";

export async function submitMusic(prompt: string, tags: string): Promise<{ statusUrl?: string; responseUrl?: string; error?: string }> {
  const key = process.env.FAL_KEY;
  if (!key) return { error: "No FAL_KEY." };
  try {
    const r = await fetch(`https://queue.fal.run/${MUSIC_MODEL}`, {
      method: "POST",
      headers: { authorization: `Key ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ prompt: prompt.slice(0, 500), tags: tags.slice(0, 200), num_songs: 1 }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) return { error: `fal music: ${j?.detail || j?.message || `HTTP ${r.status}`}` };
    return { statusUrl: j?.status_url, responseUrl: j?.response_url };
  } catch (e: any) {
    return { error: `fal music: ${String(e?.message || e)}` };
  }
}

const okUrl = (u?: string) => typeof u === "string" && u.startsWith("https://queue.fal.run/");

export async function musicResult(statusUrl: string, responseUrl: string): Promise<{ status?: string; audioUrl?: string; error?: string }> {
  const key = process.env.FAL_KEY;
  if (!key) return { error: "No FAL_KEY." };
  if (!okUrl(statusUrl) || !okUrl(responseUrl)) return { error: "Bad fal URL." };
  try {
    const s = await fetch(statusUrl, { headers: { authorization: `Key ${key}` } });
    const sj: any = await s.json().catch(() => ({}));
    if (sj?.status !== "COMPLETED") return { status: sj?.status || "IN_PROGRESS" };
    const rr = await fetch(responseUrl, { headers: { authorization: `Key ${key}` } });
    const rj: any = await rr.json().catch(() => ({}));
    const audioUrl =
      rj?.audio?.url || rj?.audio_url ||
      rj?.song_paths?.[0] || rj?.songs?.[0]?.url || rj?.songs?.[0]?.audio_url ||
      rj?.output?.audio?.url || rj?.output?.[0]?.url;
    return { status: "COMPLETED", audioUrl };
  } catch (e: any) {
    return { error: `fal music: ${String(e?.message || e)}` };
  }
}
