// Image-to-video — animates the approved still into real motion (fal.ai, default Kling model).
// Async queue API: submit -> poll status -> fetch result video. Direct REST, no SDK.
// If FAL_KEY isn't set, the caller falls back to the still + slow-zoom render.

export function animateEnabled(): boolean {
  return !!process.env.FAL_KEY;
}
const MODEL = process.env.FAL_MODEL || "fal-ai/kling-video/v1.6/standard/image-to-video";

export async function submitAnimate(imageUrl: string, prompt: string): Promise<{ statusUrl?: string; responseUrl?: string; error?: string }> {
  const key = process.env.FAL_KEY;
  if (!key) return { error: "No FAL_KEY." };
  try {
    const r = await fetch(`https://queue.fal.run/${MODEL}`, {
      method: "POST",
      headers: { authorization: `Key ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, prompt: prompt.slice(0, 500), duration: "10" }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) return { error: `fal: ${j?.detail || j?.message || `HTTP ${r.status}`}` };
    return { statusUrl: j?.status_url, responseUrl: j?.response_url };
  } catch (e: any) {
    return { error: `fal: ${String(e?.message || e)}` };
  }
}

const okUrl = (u?: string) => typeof u === "string" && u.startsWith("https://queue.fal.run/");

export async function animateResult(statusUrl: string, responseUrl: string): Promise<{ status?: string; videoUrl?: string; error?: string }> {
  const key = process.env.FAL_KEY;
  if (!key) return { error: "No FAL_KEY." };
  if (!okUrl(statusUrl) || !okUrl(responseUrl)) return { error: "Bad fal URL." };
  try {
    const s = await fetch(statusUrl, { headers: { authorization: `Key ${key}` } });
    const sj: any = await s.json().catch(() => ({}));
    if (sj?.status !== "COMPLETED") return { status: sj?.status || "IN_PROGRESS" };
    const rr = await fetch(responseUrl, { headers: { authorization: `Key ${key}` } });
    const rj: any = await rr.json().catch(() => ({}));
    const videoUrl = rj?.video?.url || rj?.video_url || rj?.output?.video?.url || rj?.output?.[0]?.url;
    return { status: "COMPLETED", videoUrl };
  } catch (e: any) {
    return { error: `fal: ${String(e?.message || e)}` };
  }
}
