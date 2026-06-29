// Image-to-video — animates the approved still into real motion (fal.ai, default Kling model).
// Uses the official @fal-ai/client (queue: submit -> poll status -> result) so model ids resolve.
// If FAL_KEY isn't set, the caller falls back to the still + slow-zoom render.

import { fal } from "@fal-ai/client";

export function animateEnabled(): boolean {
  return !!process.env.FAL_KEY;
}
const MODEL = process.env.FAL_MODEL || "fal-ai/kling-video/v1.6/standard/image-to-video";

function cfg() {
  if (process.env.FAL_KEY) fal.config({ credentials: process.env.FAL_KEY });
}
const msg = (e: any) => String(e?.body?.detail?.[0]?.msg || e?.body?.detail || e?.message || e);

export async function submitAnimate(imageUrl: string, prompt: string): Promise<{ requestId?: string; error?: string }> {
  if (!process.env.FAL_KEY) return { error: "No FAL_KEY." };
  cfg();
  try {
    const { request_id } = await fal.queue.submit(MODEL, {
      input: { image_url: imageUrl, prompt: prompt.slice(0, 500), duration: "10" },
    });
    return { requestId: request_id };
  } catch (e: any) {
    return { error: `fal: ${msg(e)}` };
  }
}

export async function animateResult(requestId: string): Promise<{ status?: string; videoUrl?: string; error?: string }> {
  if (!process.env.FAL_KEY) return { error: "No FAL_KEY." };
  if (!requestId) return { error: "Missing request id." };
  cfg();
  try {
    const s: any = await fal.queue.status(MODEL, { requestId });
    if (s?.status !== "COMPLETED") return { status: s?.status || "IN_PROGRESS" };
    const r: any = await fal.queue.result(MODEL, { requestId });
    const d = r?.data || r;
    const videoUrl = d?.video?.url || d?.video_url || d?.output?.video?.url || d?.output?.[0]?.url;
    return { status: "COMPLETED", videoUrl };
  } catch (e: any) {
    return { error: `fal: ${msg(e)}` };
  }
}
