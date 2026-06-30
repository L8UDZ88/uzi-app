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

// Browse ElevenLabs' shared voice library for native ITALIAN voices, each with a preview sample
// to audition. The user adds the ones they like (addSharedVoice) and they become usable for TTS.
export type SharedVoice = { voiceId: string; ownerId: string; name: string; accent?: string; gender?: string; age?: string; description?: string; previewUrl?: string };
export async function listSharedItalian(): Promise<SharedVoice[]> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return [];
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/shared-voices?page_size=60&language=it", { headers: { "xi-api-key": key } });
    if (!r.ok) return [];
    const j: any = await r.json();
    return (j.voices || []).map((v: any) => ({
      voiceId: v.voice_id, ownerId: v.public_owner_id, name: v.name,
      accent: v.accent, gender: v.gender, age: v.age, description: v.description, previewUrl: v.preview_url,
    })).filter((v: SharedVoice) => v.voiceId && v.ownerId);
  } catch { return []; }
}

// Add a shared-library voice to the account so it can be used for TTS. Returns the new voice id.
export async function addSharedVoice(ownerId: string, voiceId: string, name: string): Promise<{ id?: string; error?: string }> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return { error: "No ElevenLabs key." };
  if (!ownerId || !voiceId) return { error: "Missing voice." };
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/voices/add/${ownerId}/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ new_name: (name || "Italian voice").slice(0, 40) }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) return { error: `ElevenLabs: ${j?.detail?.message || (typeof j?.detail === "string" ? j.detail : `HTTP ${r.status}`)}` };
    return { id: j?.voice_id };
  } catch (e: any) {
    return { error: `ElevenLabs: ${String(e?.message || e)}` };
  }
}

// ElevenLabs TTS — multilingual model handles Italian/Sicilian with the right accent.
export async function generateElevenVoiceover(text: string, voiceId: string): Promise<{ audio?: string; error?: string }> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return { error: "No ElevenLabs key." };
  if (!text.trim()) return { error: "No script text." };
  if (!voiceId) return { error: "No voice selected." };
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text: text.slice(0, 5000),
        model_id: process.env.ELEVEN_MODEL || "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      }),
    });
    if (!r.ok) {
      let detail = `HTTP ${r.status}`;
      try {
        const e: any = await r.json();
        detail = e?.detail?.message || (typeof e?.detail === "string" ? e.detail : JSON.stringify(e).slice(0, 220));
      } catch {}
      return { error: `ElevenLabs: ${detail}` };
    }
    const buf = Buffer.from(await r.arrayBuffer());
    return { audio: `data:audio/mp3;base64,${buf.toString("base64")}` };
  } catch (e: any) {
    return { error: `ElevenLabs: ${String(e?.message || e)}` };
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

export async function generateVoiceover(text: string, voice = "alloy"): Promise<{ audio?: string; error?: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { error: "No OpenAI key." };
  if (!text.trim()) return { error: "No script text." };
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
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try { const e: any = await res.json(); detail = e?.error?.message || detail; } catch {}
      return { error: `OpenAI: ${detail}` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return { audio: `data:audio/mp3;base64,${buf.toString("base64")}` };
  } catch (e: any) {
    return { error: `OpenAI: ${String(e?.message || e)}` };
  }
}
