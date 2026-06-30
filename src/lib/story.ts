// OmniStory Story Engine — canon + AI auto-fill.
// Two axes kept separate: CHARACTERS (the cast) and REALMS (the stages).
// Brand-agnostic: Mentor = THE BRAND (any brand); Hero = the customer; Elixir = the boon.
// The user supplies a few essentials and the AI fills the whole campaign story.

export type Depth = "metahero" | "metamap" | "mvs" | "omnistory";

export const DEPTHS: { id: Depth; name: string; blurb: string }[] = [
  { id: "metahero", name: "Meta Hero", blurb: "Lightest — all 12 realms, one line each." },
  { id: "metamap", name: "Meta Map", blurb: "12 realms mapped from current state to transformation." },
  { id: "mvs", name: "MVS", blurb: "Minimal Viable Story — the 6 load-bearing realms, deeper." },
  { id: "omnistory", name: "OmniStory", blurb: "Full depth — all 12 realms, richest." },
];

// The 8 archetypes. `core` = required (the MVS floor: Hero, Mentor, Shadow).
export const CHARACTERS: { id: string; name: string; role: string; core?: boolean }[] = [
  { id: "hero", name: "Hero", role: "The customer/audience on the journey, seeking transformation.", core: true },
  { id: "mentor", name: "Mentor", role: "THE BRAND — the guide who equips the hero with tools, knowledge, and the Elixir.", core: true },
  { id: "shadow", name: "Shadow", role: "The antagonist the hero must overcome — the core problem, the old self, the status quo.", core: true },
  { id: "herald", name: "Herald", role: "The trigger/messenger that issues the Call to change (an event, trend, pain, or launch)." },
  { id: "thresholdGuardian", name: "Threshold Guardian", role: "The gatekeeper/obstacle that tests commitment (objections, doubts, friction)." },
  { id: "ally", name: "Ally", role: "Companions who help the hero — community, customers, partners." },
  { id: "trickster", name: "Trickster", role: "The disruptor/comic relief who upends the status quo." },
  { id: "shapeshifter", name: "Shapeshifter", role: "The uncertain, shifting element — skepticism, changing needs, ambiguous players." },
];

// The 12 realms (stages), with each realm's narrative job.
export const REALMS: { id: number; name: string; fn: string }[] = [
  { id: 1, name: "Ordinary World", fn: "The before / status quo. Establish contrast so the transformation is legible." },
  { id: 2, name: "Call to Adventure", fn: "The inciting invitation; the new energy / possibility." },
  { id: 3, name: "Refusal of the Call", fn: "Hesitation and excuses; the cost of inaction." },
  { id: 4, name: "Supernatural Aid", fn: "The Mentor (brand) equips the hero with the gift/tool/knowledge." },
  { id: 5, name: "Crossing the First Threshold", fn: "Commitment; the hero steps into the special world." },
  { id: 6, name: "Tests, Allies & Enemies", fn: "Trials; learning the new world; who helps and who opposes." },
  { id: 7, name: "Approach to the Inmost Cave", fn: "Raise the stakes; final preparation before the central ordeal. (Attic)" },
  { id: 8, name: "Supreme Ordeal", fn: "The central confrontation with the Shadow; death and rebirth." },
  { id: 9, name: "Reward", fn: "The hero seizes the Elixir / prize; the win." },
  { id: 10, name: "The Road Back", fn: "Recommit; carry the prize home out of the special world." },
  { id: 11, name: "Resurrection", fn: "The final test/purification; the new self is proven." },
  { id: 12, name: "Return with the Elixir", fn: "Share the transformation with others — proof, advocacy, community." },
];

export const MVS_REALM_IDS = [1, 4, 5, 8, 9, 12];

export function realmsForDepth(depth: Depth): { id: number; name: string; fn: string }[] {
  return depth === "mvs" ? REALMS.filter((r) => MVS_REALM_IDS.includes(r.id)) : REALMS;
}

export type StoryBible = {
  depth: Depth;
  characters: Record<string, string>; // id -> casting (1-2 sentences for this brand)
  elixir: string;
  ordinaryWorld: string;   // the FROM state
  transformation: string;  // the TO state
  realms: { id: number; name: string; beat: string }[];
};

// What the user has already filled in (any subset). The AI fills only the blanks.
export type PartialBible = {
  characters?: Record<string, string>;
  elixir?: string;
  ordinaryWorld?: string;
  transformation?: string;
  realms?: { id: number; beat: string }[];
};

type Brand = { name?: string; voice?: string; region?: string; product?: string; donts?: string };

export function storyEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const nz = (x?: string) => (x && x.trim() ? x.trim() : "");

function merged(provided: PartialBible, ai: any, brand: Brand, depth: Depth): StoryBible {
  const realms = realmsForDepth(depth);
  const pc = provided.characters || {};
  const aic = (ai && ai.characters) || {};
  const characters: Record<string, string> = {};
  for (const c of CHARACTERS) {
    characters[c.id] = nz(pc[c.id]) || nz(aic[c.id]) || (c.id === "mentor" ? (brand.name || "the brand") : "");
  }
  const pBeat = new Map<number, string>((provided.realms || []).map((r) => [Number(r.id), nz(r.beat)]));
  const aBeat = new Map<number, string>(((ai && ai.realms) || []).map((r: any) => [Number(r.id), nz(r.beat)]));
  return {
    depth,
    characters,
    elixir: nz(provided.elixir) || nz(ai && ai.elixir),
    ordinaryWorld: nz(provided.ordinaryWorld) || nz(ai && ai.ordinaryWorld),
    transformation: nz(provided.transformation) || nz(ai && ai.transformation),
    realms: realms.map((r) => ({ id: r.id, name: r.name, beat: pBeat.get(r.id) || aBeat.get(r.id) || "" })),
  };
}

const MODEL = "claude-sonnet-4-6";

// AI fills ONLY the fields the user left blank; anything the user wrote is preserved verbatim.
export async function generateStoryBible(provided: PartialBible, brand: Brand, depth: Depth): Promise<{ bible: StoryBible; usedAI: boolean; error?: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { bible: merged(provided, null, brand, depth), usedAI: false, error: "Add ANTHROPIC_API_KEY in Vercel to auto-fill." };

  const realms = realmsForDepth(depth);
  const depthRule =
    depth === "mvs" ? "Use the 6 Minimal-Viable-Story realms only." :
    depth === "metahero" ? "Keep each realm beat to ONE punchy line." :
    depth === "omnistory" ? "Give each realm beat 2-3 rich, specific sentences." :
    "Give each realm beat 1-2 clear sentences, framed as a step from the current state toward the transformation.";

  const system =
    `You are a brand story strategist applying the OmniStory framework (the hero's journey as a marketing operating system). ` +
    `CANON, non-negotiable: the HERO is the brand's CUSTOMER (not the brand); the MENTOR is THE BRAND itself; the ELIXIR is the boon the brand helps the customer win (the product + the transformation it unlocks); the SHADOW is what the customer must overcome. ` +
    `Characters and realms are separate axes. ` +
    `The user has already written SOME fields — treat those as fixed truth and stay consistent with them; only WRITE the fields marked [BLANK], leaving the rest matching what the user wrote. Concrete and on-brand — no generic mythology filler. ${depthRule}`;

  const pc = provided.characters || {};
  const pBeat = new Map<number, string>((provided.realms || []).map((r) => [Number(r.id), nz(r.beat)]));
  const mark = (v: string) => (v ? `[USER WROTE: ${v}]` : "[BLANK]");

  const brandCtx =
    `BRAND (the Mentor): ${brand.name || "the brand"}. ` +
    (brand.product ? `Product: ${brand.product}. ` : "") +
    (brand.voice ? `Voice: ${brand.voice}. ` : "") +
    (brand.region ? `Region/world: ${brand.region}. ` : "") +
    (brand.donts ? `Never: ${brand.donts}. ` : "");

  const stateLines = [
    ...CHARACTERS.map((c) => `character.${c.id} (${c.name} — ${c.role}): ${mark(nz(pc[c.id]))}`),
    `elixir (the boon the brand unlocks): ${mark(nz(provided.elixir))}`,
    `ordinaryWorld (customer's before-state): ${mark(nz(provided.ordinaryWorld))}`,
    `transformation (after-state): ${mark(nz(provided.transformation))}`,
    ...realms.map((r) => `realm.${r.id} "${r.name}" (job: ${r.fn}): ${mark(pBeat.get(r.id) || "")}`),
  ].join("\n");

  const user =
    `${brandCtx}\n\nCURRENT STORY (fill only the [BLANK] fields; keep the [USER WROTE] ones consistent):\n${stateLines}\n\n` +
    `Return ONLY valid JSON (no markdown) with exactly these keys:\n` +
    `{"characters": { ${CHARACTERS.map((c) => `"${c.id}": string`).join(", ")} }, ` +
    `"elixir": string, "ordinaryWorld": string, "transformation": string, ` +
    `"realms": [ {"id": number, "name": string, "beat": string} ]}\n` +
    `Mentor must be ${brand.name || "the brand"} itself. Provide a beat for every realm id listed above.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 2000, temperature: 0.8, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) {
      let d = `HTTP ${res.status}`; try { const e: any = await res.json(); d = e?.error?.message || d; } catch {}
      return { bible: merged(provided, null, brand, depth), usedAI: false, error: d };
    }
    const data: any = await res.json();
    const text: string = (data.content || []).map((b: any) => (b.type === "text" ? b.text : "")).join("").trim();
    const json = JSON.parse(text.replace(/```json/gi, "").replace(/```/g, "").trim());
    return { bible: merged(provided, json, brand, depth), usedAI: true };
  } catch (e: any) {
    return { bible: merged(provided, null, brand, depth), usedAI: false, error: String(e?.message || e) };
  }
}
