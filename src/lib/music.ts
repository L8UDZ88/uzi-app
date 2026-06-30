// AI music score via Stable Audio 2.5 on fal.ai (reuses FAL_KEY).
// Stable Audio supports a target DURATION (seconds_total, up to 190s), so we generate the score
// at the voiceover's length + a buffer — the score is a single continuous track LONGER than the
// voiceover (no looping/seams). fal-ai namespace routes cleanly. Synchronous via fal.subscribe.

import { fal } from "@fal-ai/client";

export function musicEnabled(): boolean {
  return !!process.env.FAL_KEY;
}
const MUSIC_MODEL = process.env.MUSIC_MODEL || "fal-ai/stable-audio-25/text-to-audio";

function cfg() {
  if (process.env.FAL_KEY) fal.config({ credentials: process.env.FAL_KEY });
}
const msg = (e: any) => String(e?.body?.detail?.[0]?.msg || e?.body?.detail || e?.message || e);

// Generate an instrumental score of ~`seconds` length. Returns a hosted audio URL (or an error).
export async function generateMusic(prompt: string, seconds: number): Promise<{ audioUrl?: string; error?: string }> {
  if (!process.env.FAL_KEY) return { error: "No FAL_KEY." };
  cfg();
  const secs = Math.max(10, Math.min(190, Math.round(seconds || 30)));
  try {
    const r: any = await fal.subscribe(MUSIC_MODEL, {
      input: { prompt: prompt.slice(0, 600), seconds_total: secs },
    });
    const d = r?.data || r;
    const audioUrl =
      (typeof d?.audio === "string" ? d.audio : "") ||
      d?.audio?.url || d?.audio_url || d?.audio?.[0]?.url || d?.output?.audio?.url;
    if (audioUrl) return { audioUrl };
    return { error: "Music model returned no audio." };
  } catch (e: any) {
    return { error: `fal music: ${msg(e)}` };
  }
}
