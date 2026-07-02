// Phase 2a — AI caption generation via Claude (direct REST call, no SDK dependency).
// Grounds each post in the brand's voice so copy is original and varied.
// Falls back to the deterministic templates if no API key is set or a call fails,
// so the app always returns a draft.

import { generateDraft, Draft } from "./generate";
import { HERO_FRAME_FIELDS } from "./heroframe";
import { voiceSystemPrompt } from "./voice";
import { copySystemPrompt } from "./copywriting";

// The Story Arc context for a post: which beat it carries + the campaign's Hero Frame brief + loop.
export type StoryCtx = { beat: { name: string; phase: string; job: string; keys: string[] }; brief: Record<string, string>; loop: number };

type Brand = { name: string; handle?: string; tagline?: string; region?: string; voice?: string; sourceText?: string; city?: string; product?: string; phrases?: string; donts?: string; language?: string };

function languageRule(lang?: string): string {
  if (lang === "it") return "Write ALL copy in Italian.";
  if (lang === "bilingual") return "Write the caption in BOTH languages: English first, then the Italian translation directly below it.";
  return "Write ALL copy in English (unless a proper noun or signature phrase is in another language).";
}

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

// Hard-cap the caption so it can never come back as a wall of text, trimmed at a sentence end.
function capCaption(text: string, isFilm: boolean): string {
  const t = (text || "").trim();
  const max = isFilm ? 520 : 320;
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  const end = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "), slice.lastIndexOf(".\n"), slice.lastIndexOf("!\n"), slice.lastIndexOf("?\n"));
  if (end > max * 0.5) return slice.slice(0, end + 1).trim();
  const sp = slice.lastIndexOf(" ");
  return (sp > max * 0.5 ? slice.slice(0, sp) : slice).trim() + ".";
}

export async function generateDraftAI(pillar: string, channel: string, format: string, brand: Brand, story?: StoryCtx): Promise<{ draft: Draft; usedAI: boolean }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { draft: generateDraft(pillar, channel, format, brand), usedAI: false }; // no key yet → templates

  const ch = channel || "Instagram";
  const fmt = (format || "").toLowerCase();
  const fmtHint = FORMAT_HINT[fmt] || "";
  const src = (brand.sourceText || "").trim();

  // STORY BEAT conditioning: this post must execute a specific Hero Frame beat, grounded in the
  // campaign's Hero Frame brief. Escalates on later loops (the spiral).
  let beatBlock = "";
  let beatTone = "";
  if (story?.beat) {
    const b = story.beat;
    const nameOf = (k: string) => HERO_FRAME_FIELDS.find((f) => f.id === k)?.name || k;
    const facts = (b.keys || []).map((k) => { const v = (story.brief || {})[k]; return v && v.trim() ? `- ${nameOf(k)}: ${v.trim()}` : ""; }).filter(Boolean).join("\n");
    beatTone = ` This is brand STORY content: write as a mentor speaking to the hero (the customer) — calm authority, causal (make the outcome feel earned, never hyped), specific to the hero's real world. No generic inspiration, no "unlock/unleash/empower" filler, no exclamation-point energy.`;
    beatBlock =
      `\n\nSTORY BEAT — this post is the "${b.name}" beat (the ${b.phase} phase of the campaign's ongoing story arc).\n` +
      `THE JOB OF THIS POST: ${b.job}\n` +
      (facts ? `Ground it in these facts from the campaign's Hero Frame:\n${facts}\n` : "") +
      (story.loop > 0 ? `This is loop ${story.loop + 1} of the arc — ESCALATE: raise the stakes and reach for a bigger version of the dream than earlier loops, so the story climbs over time.\n` : "") +
      `Write copy that DELIVERS this beat's job specifically — not a generic post about the pillar. The reader should feel this exact moment in the journey.`;
  }

  const system =
    voiceSystemPrompt({ name: brand.name, voice: brand.voice, tagline: brand.tagline, phrases: brand.phrases, donts: brand.donts }) + "\n\n" +
    copySystemPrompt() + "\n\n" +
    `You are the senior social copywriter for ${brand.name || "the brand"}. ` +
    `${languageRule(brand.language)} ` +
    `THE CUSTOMER IS THE HERO of every post — center their world, their dream, and their transformation. The product is only ever the tool the hero picks up to cross from their current reality to the future they want; never make the product the star or lead with features. ` +
    (brand.product ? `The product (the hero's tool — never invent other products or generic items): ${brand.product}. ` : "") +
    `Brand voice: ${brand.voice || "warm, bold, concise, human"}. ` +
    (brand.tagline ? `Tagline (don't repeat it verbatim): "${brand.tagline}". ` : "") +
    (brand.phrases ? `Weave in these signature phrases naturally where they fit: ${brand.phrases}. ` : "") +
    (brand.donts ? `HARD RULES — never do any of these: ${brand.donts}. ` : "") +
    (brand.region ? `Region/world: ${brand.region}. ` : "") +
    (brand.city ? `This specific post ANNOUNCES AVAILABILITY IN ${brand.city.toUpperCase()} — anchor every line to ${brand.city} (its name, vibe, landmarks). Do not mention other cities. ` : "") +
    (src
      ? `\n\nGround every post in the brand's REAL source material below — use its facts, product names, claims, and phrasing. Do not invent facts that contradict it.\n<source_material>\n${src.slice(0, 9000)}\n</source_material>\n`
      : "") +
    `Write platform-native, original copy. Never use a generic template. Vary the hook and angle every time — no two posts should feel alike.` +
    beatTone;

  // The spoken voiceover ("script") is kept SHORT to bound video length — except Ambient Film,
  // which is meant to run long. The on-screen caption can still be full-length and rich.
  const isFilm = /ambient|brand film|\bfilm\b|vision/i.test(pillar);
  const scriptRule = isFilm
    ? `"script": an evocative spoken voiceover for an ambient brand film — up to ~90 words.`
    : `"script": a SHORT spoken voiceover, AT MOST 40 words (~15-18 seconds when read aloud). Keep it punchy and tight — this directly bounds the video length, so do NOT just reuse the caption.`;
  const user =
    `Write ONE ${ch} ${format || "post"} for this content pillar: "${pillar}".` +
    beatBlock + `\n` +
    (fmtHint ? fmtHint + "\n" : "") +
    `Return ONLY valid JSON (no markdown, no commentary) with exactly these keys:\n` +
    `{"headline": string, "caption": string, "script": string, "hashtags": string[] (3-6 items, each starting with #), "visualBrief": string (one sentence of art direction), "cta": string (short)}\n` +
    `${scriptRule}\n` +
    `Keep the caption SHORT and punchy — ${isFilm ? "4-6 tight sentences max" : "2-4 tight sentences max, roughly 50 words"}; no padding, no rambling. The script is the spoken track and must follow the length rule above. Be specific and fresh; avoid clichés.`;

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
        caption: capCaption(String(json.caption || ""), isFilm),
        script: String(json.script || ""),
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
