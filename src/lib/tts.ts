// Voiceover (text-to-speech) via OpenAI's audio API. Direct REST, no SDK.
// Returns an mp3 data URL for in-browser playback (Stage 1: validate voice quality).
// Swappable to ElevenLabs later behind the same interface.

export function ttsEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export const TTS_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

// Turn a social caption into a clean spoken script: drop hashtags, collapse blank lines,
// strip the leading handle if present.
export function voiceScript(caption: string): string {
  return (caption || "")
    .replace(/#[^\s#]+/g, "")
    .replace(/\s*\n\s*\n\s*/g, ". ")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function generateVoiceover(text: string, voice = "alloy"): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !text.trim()) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.TTS_MODEL || "gpt-4o-mini-tts",
        voice: TTS_VOICES.includes(voice) ? voice : "alloy",
        input: text.slice(0, 3500),
        response_format: "mp3",
      }),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:audio/mp3;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
