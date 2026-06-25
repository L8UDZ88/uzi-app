export const PILLARS = [
  { id: 1, name: "Spotted at", desc: "Buyer-journey moment in-store", src: "Real photos" },
  { id: 2, name: "Transaction", desc: "Normalize the buy / grab-and-go", src: "Real photos" },
  { id: 3, name: "Now in [city]", desc: "Location announcement on a stock photo of the place", src: "Real / stock" },
  { id: 4, name: "Store → lifestyle bridge", desc: "Attach the payoff to the errand", src: "Real photos" },
  { id: 5, name: "Locator", desc: '"Where to find us" graphic + live page', src: "Stockists list" },
  { id: 6, name: "Stock / AI stills", desc: "Scale the world cheaply; composite the real product", src: "Stock + AI" },
  { id: 7, name: "Ambient film", desc: "Build the feeling (Corona-style)", src: "Midjourney → Kling" },
] as const;

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
