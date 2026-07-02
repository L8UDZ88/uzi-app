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
  { id: 6, name: "Real Photos & Footage", desc: "Your real photos/footage from the connected folder — no AI; add copy, VO + score", src: "Your Drive folder", media: "visual", format: "photo", formats: ["photo", "reel", "story"], channels: ["instagram", "facebook"], source: "real" },
  { id: 7, name: "Ambient film", desc: "Build the feeling (Corona-style) — video with VO + music", src: "Midjourney → Kling", media: "video", format: "reel", formats: ["reel", "longvideo"], channels: ["instagram", "facebook", "tiktok", "youtube"] },
  { id: 8, name: "AI Showcase", desc: "One striking AI hero shot — the product as the main focus in fitting scenery", src: "AI (Nano Banana)", media: "visual", format: "photo", formats: ["photo", "reel"], channels: ["instagram", "facebook", "x"], source: "ai" },
];

export const PILLARS_DIGITAL: Pillar[] = [
  { id: 1, name: "Product in Action", desc: "Show the product actually working — UI, demo, before/after", src: "Screen capture / demo", media: "video", format: "reel", formats: ["reel", "longvideo", "photo"], channels: ["youtube", "instagram", "tiktok"] },
  { id: 2, name: "Problem → Outcome", desc: "Name the pain, show the after-state the product delivers", src: "Concept / UI", media: "image", format: "photo", formats: ["photo", "reel", "graphic"], channels: ["linkedin", "x", "instagram"] },
  { id: 3, name: "Now Shipping", desc: "Launches: new feature, integration, platform, release notes", src: "Release visual", media: "graphic", format: "graphic", formats: ["graphic", "photo", "reel"], channels: ["linkedin", "x", "instagram", "facebook"] },
  { id: 4, name: "Proof & Results", desc: "Customer wins, metrics, testimonials, case studies, logos", src: "Testimonial / data", media: "image", format: "graphic", formats: ["graphic", "photo", "reel", "text"], channels: ["linkedin", "x", "instagram"] },
  { id: 5, name: "Deal Desk (Authority/POV)", desc: "Founder/expert frameworks, contrarian takes, category-owning education", src: "Talking head / POV", media: "video", format: "text", formats: ["text", "reel", "longvideo", "graphic"], channels: ["linkedin", "x"] },
  { id: 6, name: "Start Here", desc: "Trial, demo, pricing, link-in-bio — how to begin, friction removed", src: "CTA graphic", media: "graphic", format: "graphic", formats: ["graphic", "photo", "reel"], channels: ["linkedin", "x", "instagram"] },
  { id: 7, name: "Brand Vision", desc: "The mission and the future you're building; hero brand film", src: "Brand film", media: "video", format: "longvideo", formats: ["longvideo", "reel"], channels: ["youtube"] },
  { id: 8, name: "Product Showcase", desc: "One clean AI hero shot — the product as the main focus in fitting scenery", src: "AI (Nano Banana)", media: "visual", format: "photo", formats: ["photo", "reel"], channels: ["linkedin", "x", "instagram"], source: "ai" },
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
export function outputsForPillar(content: ContentFormat, channels?: string[], omni?: boolean): Output[] {
  // OMNI MODE: fan to EVERY channel, tailoring the format to each channel's native version of the
  // content (channelFormatFor always adapts). NORMAL: only the channels this format natively carries.
  const allowed = channelsForFormat(content);
  const base = omni ? CHANNELS.map((c) => c.id) : (channels && channels.length ? channels : CHANNELS.map((c) => c.id));
  const chans = omni ? base : base.filter((cid) => allowed.includes(cid));
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
