// Two campaign types, two 7-pillar maps. The engine is identical; only the
// pillar logic + generation copy differ. Outputs (channels) are shared.

export type MediaKind = "video" | "visual" | "image" | "graphic" | "text" | "audio" | "any";
// content format = the SPECIFIC kind of post a pillar produces. Each channel renders it in its
// own native format (photo→IG Feed/FB Post, reel→IG Reel/TikTok/YT Short, carousel→IG/LinkedIn
// Carousel, story→IG/FB Story, etc.), so every pillar's output is distinct + channel-appropriate.
export type ContentFormat = "photo" | "reel" | "story" | "carousel" | "graphic" | "longvideo" | "text";
export const CONTENT_FORMATS: { id: ContentFormat; name: string }[] = [
  { id: "photo", name: "Photo" }, { id: "reel", name: "Reel / short video" }, { id: "story", name: "Story" },
  { id: "carousel", name: "Carousel" }, { id: "graphic", name: "Graphic / announcement" },
  { id: "longvideo", name: "Long-form video" }, { id: "text", name: "Text post" },
];
// channels = channelIds this pillar publishes to (fans out to all of them).
// source: "real" = use the brand's real photos/footage from the connected Drive folder (no AI image gen).
// formats = the ONLY formats applicable to this pillar (dropdown is narrowed to these; the first
// is the sensible default). Carousel is intentionally excluded everywhere for now (reserved for
// post-summary decks later). `format` must be one of `formats`.
export type Pillar = { id: number; name: string; desc: string; src: string; media: MediaKind; format: ContentFormat; formats?: ContentFormat[]; channels?: string[]; source?: "ai" | "real" };

// Applicable formats for a pillar (falls back to everything except carousel).
export function formatsForPillar(p: Pillar): ContentFormat[] {
  return p.formats && p.formats.length ? p.formats : CONTENT_FORMATS.map((f) => f.id).filter((id) => id !== "carousel");
}

export const PILLARS_PHYSICAL: Pillar[] = [
  { id: 1, name: "Spotted at", desc: "Buyer-journey moment in-store", src: "Real photos", media: "visual", format: "photo", formats: ["photo", "story", "reel"], channels: ["instagram", "facebook", "x"] },
  { id: 2, name: "Transaction", desc: "Normalize the buy / grab-and-go", src: "Real photos", media: "visual", format: "story", formats: ["story", "photo", "reel"], channels: ["instagram", "facebook"] },
  { id: 3, name: "Now in [city]", desc: "Location announcement on a stock photo of the place", src: "Real / stock", media: "visual", format: "graphic", formats: ["graphic", "photo"], channels: ["instagram", "facebook", "x"] },
  { id: 4, name: "Store → lifestyle bridge", desc: "Attach the payoff to the errand", src: "Real photos", media: "visual", format: "reel", formats: ["reel", "photo", "story"], channels: ["instagram", "facebook", "tiktok"] },
  { id: 5, name: "Locator", desc: '"Where to find us" graphic + live page', src: "Stockists list", media: "graphic", format: "graphic", formats: ["graphic", "photo"], channels: ["instagram", "facebook"] },
  { id: 6, name: "Stock / AI stills", desc: "Scale the world cheaply — a stock/AI scene with the real product composited in (never AI-drawn)", src: "Stock + AI (Nano Banana)", media: "visual", format: "photo", formats: ["photo", "reel"], channels: ["instagram", "facebook", "x"], source: "ai" },
  { id: 7, name: "Ambient film", desc: "Build the feeling (Corona-style) — video with VO + music, signature ritual", src: "Midjourney → Kling", media: "video", format: "reel", formats: ["reel", "longvideo"], channels: ["instagram", "facebook", "tiktok", "youtube"] },
];

// Customer-as-Hero pillar system (Hero Frame). Every pillar is a stage in the CUSTOMER's
// transformation — the product only ever appears as the tool the hero picks up, never the star.
// Copy for each pillar is drawn from the brand's Hero Frame inputs set in the Story step.
export const PILLARS_DIGITAL: Pillar[] = [
  { id: 1, name: "The Customer's World", desc: "Mirror the customer's current reality so they feel seen — their day, their identity, their world (Customer)", src: "Concept / relatable scene", media: "image", format: "photo", formats: ["photo", "reel", "text"], channels: ["linkedin", "x", "instagram"] },
  { id: 2, name: "The Dream", desc: "Paint the future they want as vividly theirs — the after-state, made personal (Dream Outcome)", src: "Aspirational scene", media: "image", format: "photo", formats: ["photo", "reel", "graphic"], channels: ["linkedin", "x", "instagram"] },
  { id: 3, name: "The Obstacle", desc: "Name the enemy / old way keeping them stuck, and what staying costs them (Obstacle + Enemy + Cost)", src: "Concept / POV", media: "image", format: "text", formats: ["text", "photo", "reel", "graphic"], channels: ["linkedin", "x", "instagram"] },
  { id: 4, name: "The Turning Point", desc: "The one insight that changes everything — the reframe that opens the path (Core Mechanism)", src: "Talking head / POV", media: "video", format: "text", formats: ["text", "reel", "longvideo", "graphic"], channels: ["linkedin", "x"] },
  { id: 5, name: "Proof of Crossing", desc: "Heroes like them who made it — wins, metrics, testimonials with the CUSTOMER as protagonist (Scoreboard)", src: "Testimonial / data", media: "image", format: "graphic", formats: ["graphic", "photo", "reel", "text"], channels: ["linkedin", "x", "instagram"] },
  { id: 6, name: "The System", desc: "How the machine makes their transformation inevitable — inputs → output, cause → effect (System + Causality)", src: "Demo / diagram", media: "video", format: "reel", formats: ["reel", "longvideo", "graphic", "photo"], channels: ["youtube", "linkedin", "instagram", "tiktok"] },
  { id: 7, name: "The Call", desc: "The concrete next step the hero takes now — the specific choice, friction removed (Call to Adventure)", src: "CTA graphic", media: "graphic", format: "graphic", formats: ["graphic", "photo", "reel"], channels: ["linkedin", "x", "instagram"] },
  { id: 8, name: "The New World", desc: "The mission and the world on the other side of the crossing — the hero brand film (Vision + Multiplied Outcome)", src: "Brand film", media: "video", format: "longvideo", formats: ["longvideo", "reel"], channels: ["youtube"] },
];

export const CAMPAIGN_TYPES = [
  { id: "physical", name: "Physical product", blurb: "Retail / in-store — locations, shelves, the store-visibility system." },
  { id: "digital", name: "Digital product", blurb: "SaaS, apps, agencies, info products — launches, proof, authority, signups." },
] as const;

export function pillarsFor(type?: string): Pillar[] {
  return type === "digital" ? PILLARS_DIGITAL : PILLARS_PHYSICAL;
}

// Back-compat default (physical) for any older import.
export const PILLARS = PILLARS_PHYSICAL;

export const CHANNELS = [
  { id: "linkedin", name: "LinkedIn", glyph: "in" },
  { id: "x", name: "X", glyph: "𝕏" },
  { id: "youtube", name: "YouTube", glyph: "▶" },
  { id: "instagram", name: "Instagram", glyph: "◎" },
  { id: "facebook", name: "Facebook", glyph: "f" },
  { id: "tiktok", name: "TikTok", glyph: "♪" },
  { id: "podcast", name: "Podcast", glyph: "🎙" },
  { id: "spotify", name: "Spotify", glyph: "🎧" },
] as const;

export type PillarCfg = Record<string, { on: boolean; freq: string }>;
export type ChannelCfg = Record<string, boolean>;

// Each channel exposes its own formats. "aspect" drives the preview frame.
export type Aspect = "feed" | "vertical" | "wide" | "text" | "carousel" | "audio";
export type Format = { id: string; name: string; aspect: Aspect };
export const CHANNEL_FORMATS: Record<string, Format[]> = {
  linkedin: [{ id: "post", name: "Post", aspect: "text" }, { id: "carousel", name: "Carousel", aspect: "carousel" }, { id: "article", name: "Article", aspect: "text" }],
  x: [{ id: "post", name: "Post", aspect: "text" }, { id: "thread", name: "Thread", aspect: "text" }],
  youtube: [{ id: "long", name: "Long-form", aspect: "wide" }, { id: "short", name: "Short", aspect: "vertical" }],
  instagram: [{ id: "feed", name: "Feed", aspect: "feed" }, { id: "story", name: "Story", aspect: "vertical" }, { id: "reel", name: "Reel", aspect: "vertical" }, { id: "carousel", name: "Carousel", aspect: "carousel" }],
  facebook: [{ id: "post", name: "Post", aspect: "text" }, { id: "story", name: "Story", aspect: "vertical" }, { id: "reel", name: "Reel", aspect: "vertical" }],
  tiktok: [{ id: "video", name: "Video", aspect: "vertical" }],
  podcast: [{ id: "episode", name: "Episode", aspect: "audio" }, { id: "clip", name: "Clip", aspect: "audio" }],
  spotify: [{ id: "audio", name: "Audio", aspect: "audio" }],
};

export type Output = { channelId: string; channelName: string; glyph: string; formatId: string; formatName: string; aspect: Aspect };

// Map a pillar's content format to the right native format on a given channel (with graceful
// fallback so every channel always gets something appropriate).
const FORMAT_FALLBACK: Record<ContentFormat, string[]> = {
  photo:     ["feed", "post", "carousel"],
  graphic:   ["feed", "post", "carousel"],
  carousel:  ["carousel", "feed", "post", "thread"],
  story:     ["story", "reel", "feed", "post"],
  reel:      ["reel", "short", "video", "feed", "post"],
  longvideo: ["long", "video", "reel", "short", "feed", "post"],
  text:      ["post", "thread", "article", "feed"],
};
export function channelFormatFor(channelId: string, content: ContentFormat): Format | null {
  const formats = CHANNEL_FORMATS[channelId] || [];
  for (const fid of FORMAT_FALLBACK[content] || FORMAT_FALLBACK.photo) {
    const f = formats.find((x) => x.id === fid);
    if (f) return f;
  }
  return formats[0] || null;
}

// Which channels can NATIVELY carry each content format. A pillar can only publish to these —
// e.g. a Photo never goes to a video-only channel (TikTok/YouTube), a Carousel only exists on
// Instagram + LinkedIn, a Story only on Instagram + Facebook. Long-form video lives on YouTube
// but is also allowed as auto-shortened cuts on Instagram/Facebook/TikTok.
export const FORMAT_CHANNELS: Record<ContentFormat, string[]> = {
  photo:     ["linkedin", "x", "instagram", "facebook"],
  graphic:   ["linkedin", "x", "instagram", "facebook"],
  reel:      ["instagram", "facebook", "tiktok", "youtube"],
  story:     ["instagram", "facebook"],
  carousel:  ["instagram", "linkedin"],
  longvideo: ["youtube", "spotify"],
  text:      ["linkedin", "x", "facebook"],
};
export function channelsForFormat(content: ContentFormat): string[] {
  return FORMAT_CHANNELS[content] || FORMAT_CHANNELS.photo;
}
export function channelSupportsFormat(channelId: string, content: ContentFormat): boolean {
  return channelsForFormat(content).includes(channelId);
}

// Fan a pillar out across its channels — one post per channel, each in the channel's native
// version of the pillar's content format. So Ambient Film = Reels/Shorts, Locator = Carousels,
// Spotted at = Feed photos, Transaction = Stories — distinct, channel-appropriate, every time.
export function outputsForPillar(content: ContentFormat, channels?: string[]): Output[] {
  // Fan to the channels this pillar targets, keeping only those that natively carry the format.
  const allowed = channelsForFormat(content);
  const base = channels && channels.length ? channels : CHANNELS.map((c) => c.id);
  const chans = base.filter((cid) => allowed.includes(cid));
  const out: Output[] = [];
  for (const cid of chans) {
    const ch = CHANNELS.find((c) => c.id === cid);
    if (!ch) continue;
    const f = channelFormatFor(cid, content);
    if (!f) continue;
    out.push({ channelId: cid, channelName: ch.name, glyph: ch.glyph, formatId: f.id, formatName: f.name, aspect: f.aspect });
  }
  return out;
}

export function aspectFor(channelName: string, formatName: string): Aspect {
  const ch = CHANNELS.find((c) => c.name === channelName);
  const f = ch ? (CHANNEL_FORMATS[ch.id] || []).find((x) => x.name === formatName) : undefined;
  return f?.aspect || "feed";
}
