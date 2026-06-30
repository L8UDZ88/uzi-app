// AI music score via Google's Lyria 2 on fal.ai (reuses FAL_KEY).
// fal-ai namespace routes cleanly (Sonauto's "sonauto/v2/..." path 404s as "Application 'v2'").
// Lyria is fast (~30s, no coldstart) so we run it synchronously via fal.subscribe.
// The render lays this under the voiceover (ducked) and trims it to the video length.

import { fal } from "@fal-ai/client";

export function musicEnabled(): boolean {
  return !!process.env.FAL_KEY;
}
const MUSIC_MODEL = process.env.MUSIC_MODEL || "fal-ai/lyria2";

function cfg() {
  if (process.env.FAL_KEY) fal.config({ credentials: process.env.FAL_KEY });
}
const msg = (e: any) => String(e?.body?.detail?.[0]?.msg || e?.body?.detail || e?.message || e);

// Generate an instrumental score. Returns a hosted audio URL (or an error).
export async function generateMusic(prompt: string, negativePrompt: string): Promise<{ audioUrl?: string; error?: string }> {
  if (!process.env.FAL_KEY) return { error: "No FAL_KEY." };
  cfg();
  try {
    const r: any = await fal.subscribe(MUSIC_MODEL, {
      input: { prompt: prompt.slice(0, 600), negative_prompt: negativePrompt.slice(0, 200) },
    });
    const d = r?.data || r;
    const audioUrl = d?.audio?.url || d?.audio_url || d?.audio?.[0]?.url || d?.output?.audio?.url;
    if (audioUrl) return { audioUrl };
    return { error: "Music model returned no audio." };
  } catch (e: any) {
    return { error: `fal music: ${msg(e)}` };
  }
}
