// Two campaign types, two 7-pillar maps. The engine is identical; only the
// pillar logic + generation copy differ. Outputs (channels) are shared.

export type Pillar = { id: number; name: string; desc: string; src: string };

export const PILLARS_PHYSICAL: Pillar[] = [
  { id: 1, name: "Spotted at", desc: "Buyer-journey moment in-store", src: "Real photos" },
  { id: 2, name: "Transaction", desc: "Normalize the buy / grab-and-go", src: "Real photos" },
  { id: 3, name: "Now in [city]", desc: "Location announcement on a stock photo of the place", src: "Real / stock" },
  { id: 4, name: "Store → lifestyle bridge", desc: "Attach the payoff to the errand", src: "Real photos" },
  { id: 5, name: "Locator", desc: '"Where to find us" graphic + live page', src: "Stockists list" },
  { id: 6, name: "Stock / AI stills", desc: "Scale the world cheaply; composite the real product", src: "Stock + AI" },
  { id: 7, name: "Ambient film", desc: "Build the feeling (Corona-style)", src: "Midjourney → Kling" },
];

export const PILLARS_DIGITAL: Pillar[] = [
  { id: 1, name: "Product in Action", desc: "Show the product actually working — UI, demo, before/after", src: "Screen capture / demo" },
  { id: 2, name: "Problem → Outcome", desc: "Name the pain, show the after-state the product delivers", src: "Concept / UI" },
  { id: 3, name: "Now Shipping", desc: "Launches: new feature, integration, platform, release notes", src: "Release visual" },
  { id: 4, name: "Proof & Results", desc: "Customer wins, metrics, testimonials, case studies, logos", src: "Testimonial / data" },
  { id: 5, name: "Deal Desk (Authority/POV)", desc: "Founder/expert frameworks, contrarian takes, category-owning education", src: "Talking head / carousel" },
  { id: 6, name: "Start Here", desc: "Trial, demo, pricing, link-in-bio — how to begin, friction removed", src: "CTA graphic" },
  { id: 7, name: "Vision / Brand Film", desc: "The mission and the future you're building; hero brand film", src: "Brand film" },
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
  { id: "youtube", name: "YouTube", glyph: "▶" },
  { id: "instagram", name: "Instagram", glyph: "◎" },
  { id: "facebook", name: "Facebook", glyph: "f" },
  { id: "tiktok", name: "TikTok", glyph: "♪" },
  { id: "podcast", name: "Podcast", glyph: "🎙" },
] as const;

export type PillarCfg = Record<string, { on: boolean; freq: string }>;
export type ChannelCfg = Record<string, boolean>;
