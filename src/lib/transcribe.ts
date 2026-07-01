// Speech-to-text via ElevenLabs Scribe. Turns a brand's audio/video assets into text +
// word-level timestamps, so Uzi can (a) intelligently pick the best moment to splice and
// (b) align captions and post copy to what was actually said.

const STT_URL = "https://api.elevenlabs.io/v1/speech-to-text";

export type TranscriptWord = { text: string; start: number; end: number };
export type TranscriptResult = { text: string; words: TranscriptWord[]; language?: string };

export function transcribeEnabled(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

// Transcribe raw audio/video bytes. Returns null on any failure (caller surfaces a friendly error).
export async function transcribeBytes(bytes: ArrayBuffer, filename: string, mime: string): Promise<TranscriptResult | null> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return null;
  try {
    const form = new FormData();
    form.append("model_id", "scribe_v1");
    form.append("file", new Blob([bytes], { type: mime || "application/octet-stream" }), filename || "media");
    const r = await fetch(STT_URL, { method: "POST", headers: { "xi-api-key": key }, body: form });
    if (!r.ok) return null;
    const j: any = await r.json();
    const words: TranscriptWord[] = Array.isArray(j.words)
      ? j.words
          .filter((w: any) => (w.type ? w.type === "word" : true))
          .map((w: any) => ({ text: String(w.text || ""), start: Number(w.start) || 0, end: Number(w.end) || 0 }))
      : [];
    return { text: String(j.text || ""), words, language: j.language_code };
  } catch {
    return null;
  }
}
