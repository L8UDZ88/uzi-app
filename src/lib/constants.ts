// Two campaign types, two 7-pillar maps. The engine is identical; only the
// pillar logic + generation copy differ. Outputs (channels) are shared.

// media drives which outputs a pillar can be scheduled into (see outputMatchesPillar):
//  video = motion (Reel/Short/TikTok/YouTube/feed-video) · image = photo post ·
//  graphic = designed still/announcement · text = text post · audio = podcast.
export type MediaKind = "video" | "visual" | "image" | "graphic" | "text" | "audio" | "any";
// channels = channelIds this pillar should publish to (it fans out to all of them that are
// enabled). Omit to target every channel that fits the pillar's media type.
export type Pillar = { id: number; name: string; desc: string; src: string; media: MediaKind; channels?: string[] };

export const PILLARS_PHYSICAL: Pillar[] = [
  { id: 1, name: "Spotted at", desc: "Buyer-journey moment in-store", src: "Real photos", media: "visual", channels: ["instagram", "facebook", "tiktok", "x"] },
  { id: 2, name: "Transaction", desc: "Normalize the buy / grab-and-go", src: "Real photos", media: "visual", channels: ["x", "instagram", "facebook"] },
  { id: 3, name: "Now in [city]", desc: "Location announcement on a stock photo of the place", src: "Real / stock", media: "visual", channels: ["instagram", "facebook", "x"] },
  { id: 4, name: "Store → lifestyle bridge", desc: "Attach the payoff to the errand", src: "Real photos", media: "visual", channels: ["instagram", "facebook", "tiktok"] },
  { id: 5, name: "Locator", desc: '"Where to find us" graphic + live page', src: "Stockists list", media: "graphic", channels: ["instagram", "facebook"] },
  { id: 6, name: "Stock / AI stills", desc: "Scale the world cheaply; composite the real product", src: "Stock + AI", media: "visual", channels: ["instagram", "facebook", "tiktok", "youtube"] },
  { id: 7, name: "Ambient film", desc: "Build the feeling (Corona-style) — video with VO + music", src: "Midjourney → Kling", media: "video", channels: ["instagram", "tiktok", "youtube", "facebook"] },
];

export const PILLARS_DIGITAL: Pillar[] = [
  { id: 1, name: "Product in Action", desc: "Show the product actually working — UI, demo, before/after", src: "Screen capture / demo", media: "video", channels: ["youtube", "linkedin", "x", "instagram"] },
  { id: 2, name: "Problem → Outcome", desc: "Name the pain, show the after-state the product delivers", src: "Concept / UI", media: "image", channels: ["linkedin", "x", "instagram"] },
  { id: 3, name: "Now Shipping", desc: "Launches: new feature, integration, platform, release notes", src: "Release visual", media: "graphic", channels: ["linkedin", "x", "instagram", "facebook"] },
  { id: 4, name: "Proof & Results", desc: "Customer wins, metrics, testimonials, case studies, logos", src: "Testimonial / data", media: "image", channels: ["linkedin", "x", "instagram"] },
  { id: 5, name: "Deal Desk (Authority/POV)", desc: "Founder/expert frameworks, contrarian takes, category-owning education", src: "Talking head / carousel", media: "video", channels: ["linkedin", "youtube", "x"] },
  { id: 6, name: "Start Here", desc: "Trial, demo, pricing, link-in-bio — how to begin, friction removed", src: "CTA graphic", media: "graphic", channels: ["linkedin", "x", "instagram"] },
  { id: 7, name: "Vision / Brand Film", desc: "The mission and the future you're building; hero brand film", src: "Brand film", media: "video", channels: ["youtube", "linkedin", "instagram", "tiktok"] },
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
};

export type Output = { channelId: string; channelName: string; glyph: string; formatId: string; formatName: string; aspect: Aspect };

// Active outputs from a channels config keyed "channelId:formatId" (with back-compat for old plain "channelId" booleans).
export function activeOutputs(channels: Record<string, boolean>): Output[] {
  const out: Output[] = [];
  for (const ch of CHANNELS) {
    const formats = CHANNEL_FORMATS[ch.id] || [];
    let any = false;
    for (const f of formats) {
      if (channels?.[`${ch.id}:${f.id}`]) {
        out.push({ channelId: ch.id, channelName: ch.name, glyph: ch.glyph, formatId: f.id, formatName: f.name, aspect: f.aspect });
        any = true;
      }
    }
    if (!any && channels?.[ch.id] && formats[0]) {
      out.push({ channelId: ch.id, channelName: ch.name, glyph: ch.glyph, formatId: formats[0].id, formatName: formats[0].name, aspect: formats[0].aspect });
    }
  }
  return out;
}

// Which output aspects each media type is allowed to use. Keeps pillars on the right outputs:
// e.g. a "video" pillar (Ambient film) never schedules onto a podcast (audio) or text slot.
// Aspects each media type may use, in preference order (best format first per channel).
const MEDIA_ASPECTS: Record<MediaKind, Aspect[]> = {
  video: ["vertical", "wide", "feed"],               // Reel/Short/TikTok/YouTube/feed-video
  visual: ["feed", "carousel", "vertical", "wide", "text"], // image OR video — any visual channel
  image: ["feed", "carousel", "text", "vertical"],   // photo — image OR short video channels
  graphic: ["feed", "carousel", "text"],             // designed still / announcement (feed/post/carousel)
  text: ["text", "carousel"],
  audio: ["audio"],
  any: ["feed", "vertical", "wide", "carousel", "text", "audio"],
};
export function outputMatchesPillar(media: MediaKind, aspect: Aspect): boolean {
  return (MEDIA_ASPECTS[media] || MEDIA_ASPECTS.any).includes(aspect);
}

// Fan a pillar out across EVERY enabled channel that fits its media — one post per channel,
// using that channel's best-fitting format. So "Spotted at" (image) hits all image/video
// channels, "Ambient film" (video) hits all video channels, "Locator" (graphic) hits IG/FB, etc.
export function outputsForPillar(media: MediaKind, outs: Output[], channels?: string[]): Output[] {
  const pref = MEDIA_ASPECTS[media] || MEDIA_ASPECTS.any;
  const byChannel = new Map<string, Output[]>();
  for (const o of outs) {
    if (channels && channels.length && !channels.includes(o.channelId)) continue; // pillar's channel list
    if (!outputMatchesPillar(media, o.aspect)) continue;
    const list = byChannel.get(o.channelId) || [];
    list.push(o);
    byChannel.set(o.channelId, list);
  }
  const picked: Output[] = [];
  for (const list of byChannel.values()) {
    list.sort((a, b) => pref.indexOf(a.aspect) - pref.indexOf(b.aspect));
    picked.push(list[0]); // one (best) format per channel
  }
  return picked;
}

export function aspectFor(channelName: string, formatName: string): Aspect {
  const ch = CHANNELS.find((c) => c.name === channelName);
  const f = ch ? (CHANNEL_FORMATS[ch.id] || []).find((x) => x.name === formatName) : undefined;
  return f?.aspect || "feed";
}
