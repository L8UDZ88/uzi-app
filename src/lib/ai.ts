// Phase 2a — AI caption generation via Claude (direct REST call, no SDK dependency).
// Grounds each post in the brand's voice so copy is original and varied.
// Falls back to the deterministic templates if no API key is set or a call fails,
// so the app always returns a draft.

import { generateDraft, Draft } from "./generate";

type Brand = { name: string; handle?: string; tagline?: string; region?: string; voice?: string };

const MODEL = "claude-sonnet-4-6"; // swap to "claude-haiku-4-5-20251001" for cheaper, or "claude-opus-4-8" for top quality

export async function generateDraftAI(pillar: string, channel: string, brand: Brand): Promise<Draft> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return generateDraft(pillar, channel, brand); // no key yet → templates

  const ch = channel || "Instagram";
  const system =
    `You are the senior social copywriter for ${brand.name || "the brand"}. ` +
    `Brand voice: ${brand.voice || "warm, bold, concise, human"}. ` +
    (brand.tagline ? `Tagline (don't repeat it verbatim): "${brand.tagline}". ` : "") +
    (brand.region ? `Region: ${brand.region}. ` : "") +
    `Write platform-native, original copy. Never use a generic template. Vary the hook and angle every time — no two posts should feel alike.`;

  const user =
    `Write ONE ${ch} post for this content pillar: "${pillar}".\n` +
    `Return ONLY valid JSON (no markdown, no commentary) with exactly these keys:\n` +
    `{"headline": string, "caption": string, "hashtags": string[] (3-6 items, each starting with #), "visualBrief": string (one sentence of art direction), "cta": string (short)}\n` +
    `Make the caption fit ${ch}'s norms (length, tone). Be specific and fresh; avoid clichés.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        temperature: 0.9,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) return generateDraft(pillar, channel, brand);
    const data: any = await res.json();
    const text: string = (data.content || []).map((b: any) => (b.type === "text" ? b.text : "")).join("").trim();
    const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const json = JSON.parse(clean);
    return {
      pillar,
      channel: ch,
      headline: String(json.headline || ""),
      caption: String(json.caption || ""),
      hashtags: Array.isArray(json.hashtags) ? json.hashtags.map(String) : [],
      visualBrief: String(json.visualBrief || ""),
      cta: String(json.cta || ""),
    };
  } catch {
    return generateDraft(pillar, channel, brand); // any error → safe fallback
  }
}
