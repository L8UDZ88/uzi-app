// Audio-driven talking avatar via fal (Kling AI Avatar). Given a presenter photo + an audio clip,
// produces a lip-synced video of the avatar speaking the audio. Reuses FAL_KEY.
import { fal } from "@fal-ai/client";

export function avatarEnabled(): boolean {
  return !!process.env.FAL_KEY;
}
const AVATAR_MODEL = process.env.AVATAR_MODEL || "fal-ai/kling-video/ai-avatar/v2/standard";

export async function generateAvatarVideo(imageUrl: string, audioUrl: string): Promise<{ video: string | null; error?: string }> {
  if (!process.env.FAL_KEY) return { video: null, error: "No FAL_KEY." };
  if (!imageUrl || !audioUrl) return { video: null, error: "Need a presenter photo and an audio clip." };
  fal.config({ credentials: process.env.FAL_KEY });
  try {
    const r: any = await fal.subscribe(AVATAR_MODEL, { input: { image_url: imageUrl, audio_url: audioUrl } });
    const d = r?.data || r;
    const url = d?.video?.url || d?.videos?.[0]?.url || d?.url;
    if (url) return { video: url };
    return { video: null, error: "Avatar returned no video." };
  } catch (e: any) {
    return { video: null, error: `avatar: ${String(e?.body?.detail || e?.message || e)}` };
  }
}
