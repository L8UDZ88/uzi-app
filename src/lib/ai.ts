// Phase 2a — AI caption generation via Claude (direct REST call, no SDK dependency).
// Grounds each post in the brand's voice so copy is original and varied.
// Falls back to the deterministic templates if no API key is set or a call fails,
// so the app always returns a draft.

import { generateDraft, Draft } from "./generate";

type Brand = { name: string; handle?: string; tagline?: string; region?: string; voice?: string; sourceText?: string };

const MODEL = "claude-sonnet-4-6"; // swap to "claude-haiku-4-5-20251001" for cheaper, or "claude-opus-4-8" for top quality

const FORMAT_HINT: Record<string, string> = {
  story: "Format = STORY: 9:16, one punchy line of overlay text, minimal/no hashtags, CTA as a link sticker.",
  reel: "Format = REEL: 9:16 short video, a strong spoken/visual hook in the first 2 seconds, captions on.",
  short: "Format = SHORT: 9:16 vertical short video, hook-first, fast, captioned.",
  video: "Format = VIDEO: 9:16 short video, hook in the first 2 seconds, trending audio, captions on.",
  carousel: "Format = CAROUSEL: write it as a swipeable deck — slide 1 hook, slides 2–5 one point each, final slide CTA.",
  thread: "Format = THREAD: write post 1 as a scroll-stopping hook, then 3–5 short follow-up posts, last post is the CTA.",
  article: "Format = ARTICLE: long-form, structured with a strong headline and clear sections.",
  long: "Format = LONG-FORM VIDEO: 16:9, full narrative with chapters; caption is a rich description.",
  feed: "Format = FEED POST: standard feed caption, full length, on-platform norms.",
  post: "Format = POST: standard feed/timeline post.",
  episode: "Format = PODCAST EPISODE: write show notes for the full episode.",
  clip: "Format = AUDIO CLIP: short audiogram clip pulled from the episode.",
};

export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function generateDraftAI(pillar: string, channel: string, format: string, brand: Brand): Promise<{ draft: Draft; usedAI: boolean }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { draft: generateDraft(pillar, channel, format, brand), usedAI: false }; // no key yet → templates

  const ch = channel || "Instagram";
  const fmt = (format || "").toLowerCase();
  const fmtHint = FORMAT_HINT[fmt] || "";
  const src = (brand.sourceText || "").trim();
  const system =
    `You are the senior social copywriter for ${brand.name || "the brand"}. ` +
    `Brand voice: ${brand.voice || "warm, bold, concise, human"}. ` +
    (brand.tagline ? `Tagline (don't repeat it verbatim): "${brand.tagline}". ` : "") +
    (brand.region ? `Region: ${brand.region}. ` : "") +
    (src
      ? `\n\nGround every post in the brand's REAL source material below — use its facts, product names, claims, and phrasing. Do not invent facts that contradict it.\n<source_material>\n${src.slice(0, 9000)}\n</source_material>\n`
      : "") +
    `Write platform-native, original copy. Never use a generic template. Vary the hook and angle every time — no two posts should feel alike.`;

  const user =
    `Write ONE ${ch} ${format || "post"} for this content pillar: "${pillar}".\n` +
    (fmtHint ? fmtHint + "\n" : "") +
    `Return ONLY valid JSON (no markdown, no commentary) with exactly these keys:\n` +
    `{"headline": string, "caption": string, "hashtags": string[] (3-6 items, each starting with #), "visualBrief": string (one sentence of art direction), "cta": string (short)}\n` +
    `Make the caption fit the ${ch} ${format || "post"} norms (length, tone). Be specific and fresh; avoid clichés.`;

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
    if (!res.ok) return { draft: generateDraft(pillar, channel, format, brand), usedAI: false };
    const data: any = await res.json();
    const text: string = (data.content || []).map((b: any) => (b.type === "text" ? b.text : "")).join("").trim();
    const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const json = JSON.parse(clean);
    return {
      draft: {
        pillar,
        channel: ch,
        headline: String(json.headline || ""),
        caption: String(json.caption || ""),
        hashtags: Array.isArray(json.hashtags) ? json.hashtags.map(String) : [],
        visualBrief: String(json.visualBrief || ""),
        cta: String(json.cta || ""),
      },
      usedAI: true,
    };
  } catch {
    return { draft: generateDraft(pillar, channel, format, brand), usedAI: false }; // any error → safe fallback
  }
}
