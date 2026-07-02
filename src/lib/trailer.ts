// Brand Movie Trailer — the storyboard planner. Turns the campaign's Hero Frame arc into a
// beat-by-beat shot list: each beat gets ONE cinematic visual prompt (a microcosm of the hero at
// that moment) and ONE short narration line, grounded in the brand brain. This is the fast,
// cheap first pass; image/video generation + assembly follow in later steps.

import { arcFor } from "./beats";
import { voiceSystemPrompt } from "./voice";
import { copySystemPrompt } from "./copywriting";

export type TrailerBeat = {
  id: string; name: string; phase: string; job: string;
  prompt: string;          // cinematography prompt for the beat's image/shots
  copy: string;            // one narration line
  imageUrl?: string;       // generated still (later step)
  videoUrl?: string;       // animated shots (later step)
  endFrameUrl?: string;    // last frame → seeds the next beat (continuity)
  status?: string;         // pending | image | video | done | failed
};

type Brand = { name?: string; sourceText?: string; voice?: string };

// One Claude call storyboards every beat at once (fast). Falls back to job-derived prompts.
export async function planTrailerBeats(campaignType: string | undefined, brand: Brand): Promise<TrailerBeat[]> {
  const arc = arcFor(campaignType);
  const base = arc.map((b) => ({ id: b.id, name: b.name, phase: b.phase, job: b.job }));
  const fallback = (): TrailerBeat[] => base.map((b) => ({ ...b, prompt: `Cinematic, filmic shot embodying: ${b.job}. Shallow depth of field, motivated lighting, slow camera move.`, copy: "", status: "pending" }));

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return fallback();

  const system =
    voiceSystemPrompt({ name: brand.name, voice: brand.voice }) + "\n\n" +
    copySystemPrompt() + "\n\n" +
    `You are a film director storyboarding a cinematic brand trailer that forms ONE continuous film. ` +
    `For each beat produce (1) a vivid cinematography prompt — camera, lens, lighting, motion, subject, mood — a microcosm of the hero's journey at that beat; and (2) one short line of narration grounded in the brand. ` +
    `The beats must feel continuous: consistent world, tone, and protagonist across shots.`;
  const user =
    `Brand: ${brand.name || "the brand"}.\n` +
    (brand.sourceText ? `Brand brain (ground everything in this, invent nothing):\n<brain>\n${String(brand.sourceText).slice(0, 6000)}\n</brain>\n\n` : "") +
    `Beats in order:\n${base.map((b, i) => `${i + 1}. [id:${b.id}] ${b.name} (${b.phase}) — job: ${b.job}`).join("\n")}\n\n` +
    `Return ONLY a JSON array, one object per beat IN ORDER, each: {"id": string (the beat id), "prompt": string (1-2 sentence cinematography prompt), "copy": string (one narration line, <= 20 words)}.`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2000, temperature: 0.6, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) return fallback();
    const data: any = await res.json();
    const text: string = (data.content || []).map((b: any) => (b.type === "text" ? b.text : "")).join("").trim().replace(/```json/gi, "").replace(/```/g, "").trim();
    const arr: any[] = JSON.parse(text);
    const byId = new Map(arr.map((x) => [String(x.id), x]));
    return base.map((b) => {
      const g = byId.get(b.id);
      return { ...b, prompt: String(g?.prompt || `Cinematic shot: ${b.job}`), copy: String(g?.copy || ""), status: "pending" } as TrailerBeat;
    });
  } catch {
    return fallback();
  }
}
