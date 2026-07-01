// The Hero Frame brief — the campaign's story spine (replaces the OmniStory cast/realms setup).
// The user fills the 5 load-bearing inputs; the AI drafts all 13 from the brand kit + the
// connected Drive folder's ingested text ("master brain"). Fill-only-blanks: user edits win.
// This brief feeds every post's copy, conditioned on that post's beat (Phase 2+).

export type HeroFrameField = { id: string; name: string; hint: string; core?: boolean };

// 13 inputs, in Hero Frame order. `core` = load-bearing (the message fails without it).
export const HERO_FRAME_FIELDS: HeroFrameField[] = [
  { id: "hero", name: "Hero", hint: "Who the message speaks to — your ideal customer, named specifically.", core: true },
  { id: "dream", name: "Dream Outcome", hint: "The future reality they want. The gravitational center of everything.", core: true },
  { id: "obstacle", name: "Obstacle", hint: "The painful problem / market force / broken system in the way.", core: true },
  { id: "cost", name: "Cost of Inaction", hint: "What staying stuck actually costs them, in specifics." },
  { id: "enemy", name: "Enemy", hint: "The thing to push against — a competitor, the 'old way', a belief, a pressure." },
  { id: "mechanism", name: "Core Mechanism", hint: "The one thing that changes everything — the insight/shift that unlocks the path.", core: true },
  { id: "conditions", name: "Conditions for Inevitability", hint: "What would have to be true for success to become inevitable." },
  { id: "causality", name: "Causality Formula", hint: "The cause→effect logic of the outcome (e.g. more demand + better conversion = predictable revenue)." },
  { id: "system", name: "System / Offer", hint: "The product, service, or machine that produces the outcome — the mechanism made concrete." },
  { id: "inputs", name: "Inputs / Resources", hint: "What gets fed in: capital, leads, content, conversations, data, attention." },
  { id: "multiplier", name: "Multiplied Outcome", hint: "What the system multiplies: revenue, margin, pipeline, trust, valuation." },
  { id: "scoreboard", name: "Scoreboard / Metrics", hint: "How the hero knows they're winning — the game they can measure." },
  { id: "call", name: "Call to Adventure", hint: "The specific choice the hero must make now. Concrete, not 'let's chat'.", core: true },
];

export type HeroFrameBrief = Record<string, string>;

type Brand = { name?: string; voice?: string; region?: string; product?: string; donts?: string; tagline?: string; sourceText?: string };

export function heroFrameEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const nz = (x?: string) => (x && x.trim() ? x.trim() : "");
const MODEL = "claude-sonnet-4-6";

function merged(provided: HeroFrameBrief, ai: any): HeroFrameBrief {
  const out: HeroFrameBrief = {};
  for (const f of HERO_FRAME_FIELDS) out[f.id] = nz(provided?.[f.id]) || nz(ai?.[f.id]);
  return out;
}

// AI drafts every field the user left blank, from the brand kit + Drive "master brain".
// Anything the user already wrote is preserved verbatim.
export async function generateHeroFrame(provided: HeroFrameBrief, brand: Brand): Promise<{ brief: HeroFrameBrief; usedAI: boolean; error?: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { brief: merged(provided || {}, null), usedAI: false, error: "Add ANTHROPIC_API_KEY in Vercel to auto-draft." };

  const mark = (v: string) => (v ? `[USER WROTE — keep: ${v}]` : "[BLANK — draft this]");
  const src = (brand.sourceText || "").trim();

  const system =
    `You are a brand strategist writing a "Hero Frame" brief — a Call-to-Adventure that fuses the hero's journey with a systems/causality worldview. ` +
    `The transformation is the predictable output of feeding the right inputs into the right machine — myth supplies the pull, causality supplies the credibility. ` +
    `CANON: the HERO is the brand's CUSTOMER (not the brand); the brand is the Mentor; the ELIXIR/System is what the brand hands the hero. ` +
    `Draft each field concretely and specifically to THIS brand — never generic. A field is weak if it could be pasted into another company's brief unchanged. ` +
    `Only draft the fields marked [BLANK]; keep the [USER WROTE] fields as-is and stay consistent with them.`;

  const brandCtx =
    `BRAND: ${brand.name || "the brand"}. ` +
    (brand.product ? `Product: ${brand.product}. ` : "") +
    (brand.voice ? `Voice: ${brand.voice}. ` : "") +
    (brand.region ? `Region/market: ${brand.region}. ` : "") +
    (brand.tagline ? `Tagline: "${brand.tagline}". ` : "") +
    (brand.donts ? `Never: ${brand.donts}. ` : "");
  const brain = src ? `\n\nBRAND MASTER BRAIN (real source material — ground every field in these facts):\n<brain>\n${src.slice(0, 9000)}\n</brain>\n` : "";

  const state = HERO_FRAME_FIELDS.map((f) => `${f.id} (${f.name} — ${f.hint}): ${mark(nz(provided?.[f.id]))}`).join("\n");

  const user =
    `${brandCtx}${brain}\n\nCURRENT BRIEF (fill only the [BLANK] fields):\n${state}\n\n` +
    `Return ONLY valid JSON (no markdown) with exactly these keys: ${HERO_FRAME_FIELDS.map((f) => `"${f.id}"`).join(", ")}. ` +
    `Each value is a tight, specific sentence or two.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1800, temperature: 0.7, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) {
      let d = `HTTP ${res.status}`; try { const e: any = await res.json(); d = e?.error?.message || d; } catch {}
      return { brief: merged(provided || {}, null), usedAI: false, error: d };
    }
    const data: any = await res.json();
    const text: string = (data.content || []).map((b: any) => (b.type === "text" ? b.text : "")).join("").trim();
    const json = JSON.parse(text.replace(/```json/gi, "").replace(/```/g, "").trim());
    return { brief: merged(provided || {}, json), usedAI: true };
  } catch (e: any) {
    return { brief: merged(provided || {}, null), usedAI: false, error: String(e?.message || e) };
  }
}
