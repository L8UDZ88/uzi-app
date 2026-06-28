// Voiceover (text-to-speech) via OpenAI's audio API. Direct REST, no SDK.
// Returns an mp3 data URL for in-browser playback (Stage 1: validate voice quality).
// Swappable to ElevenLabs later behind the same interface.

export function ttsEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY || !!process.env.ELEVENLABS_API_KEY;
}
export function elevenEnabled(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

export const TTS_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

export type VoiceOption = { id: string; name: string; provider: "openai" | "elevenlabs" };

// Voices available to the picker. If ElevenLabs is connected, surface its real voices
// (Italian/Sicilian males, clones, etc.); always include OpenAI's as a fallback.
export async function listVoices(): Promise<VoiceOption[]> {
  const out: VoiceOption[] = [];
  if (elevenEnabled()) {
    try {
      const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY as string } });
      if (r.ok) {
        const j: any = await r.json();
        for (const v of j.voices || []) {
          const lbl = v.labels || {};
          const tags = [lbl.accent, lbl.gender, lbl.age, lbl.description].filter(Boolean).join(", ");
          out.push({ id: v.voice_id, name: tags ? `${v.name} · ${tags}` : v.name, provider: "elevenlabs" });
        }
      }
    } catch { /* fall through to OpenAI */ }
  }
  if (process.env.OPENAI_API_KEY) for (const v of TTS_VOICES) out.push({ id: v, name: `${v} (OpenAI)`, provider: "openai" });
  return out;
}

// ElevenLabs TTS — multilingual model handles Italian/Sicilian with the right accent.
export async function generateElevenVoiceover(text: string, voiceId: string): Promise<string | null> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key || !text.trim() || !voiceId) return null;
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text: text.slice(0, 5000),
        model_id: process.env.ELEVEN_MODEL || "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true },
      }),
    });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return `data:audio/mp3;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

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
