// AI music score via Sonauto on fal.ai (reuses FAL_KEY). Async queue: submit -> poll -> audio URL.
// Uses the official @fal-ai/client so partner model ids (e.g. "sonauto/v2/text-to-music")
// resolve correctly — raw REST treats "v2" as the app name and 404s.
// The render lays this under the voiceover (ducked) and trims it to the video length.

import { fal } from "@fal-ai/client";

export function musicEnabled(): boolean {
  return !!process.env.FAL_KEY;
}
const MUSIC_MODEL = process.env.MUSIC_MODEL || "sonauto/v2/text-to-music";

function cfg() {
  if (process.env.FAL_KEY) fal.config({ credentials: process.env.FAL_KEY });
}
const msg = (e: any) => String(e?.body?.detail?.[0]?.msg || e?.body?.detail || e?.message || e);

// Instrumental score: tags + empty lyrics_prompt forces no vocals (Sonauto's documented way).
export async function submitMusic(tags: string[]): Promise<{ requestId?: string; error?: string }> {
  if (!process.env.FAL_KEY) return { error: "No FAL_KEY." };
  cfg();
  try {
    const { request_id } = await fal.queue.submit(MUSIC_MODEL, {
      input: { tags, lyrics_prompt: "", num_songs: 1, output_format: "mp3" },
    });
    return { requestId: request_id };
  } catch (e: any) {
    return { error: `fal music: ${msg(e)}` };
  }
}

export async function musicResult(requestId: string): Promise<{ status?: string; audioUrl?: string; error?: string }> {
  if (!process.env.FAL_KEY) return { error: "No FAL_KEY." };
  if (!requestId) return { error: "Missing request id." };
  cfg();
  try {
    const s: any = await fal.queue.status(MUSIC_MODEL, { requestId });
    if (s?.status !== "COMPLETED") return { status: s?.status || "IN_PROGRESS" };
    const r: any = await fal.queue.result(MUSIC_MODEL, { requestId });
    const d = r?.data || r;
    const audioUrl =
      d?.audio?.url || d?.audio?.[0]?.url ||
      d?.audio_url || (Array.isArray(d?.audio) ? d.audio[0]?.url : undefined);
    return { status: "COMPLETED", audioUrl };
  } catch (e: any) {
    return { error: `fal music: ${msg(e)}` };
  }
}
