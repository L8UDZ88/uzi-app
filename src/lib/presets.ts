// Fixed brand presets. GrowFast loads Tyson's actual Hero Frame copy directly (no AI draft);
// other campaigns keep the "Draft with AI" flow. Editable after it loads — treat as the seed.

export function isGrowFastBrand(name?: string): boolean {
  return /growfast/i.test(name || "");
}

// Warning shown before letting AI overwrite brain-pulled content on a brain-locked campaign.
export const BRAIN_LOCK_WARNING = "Are you sure? This message was pulled directly from your attached Brain Folder.";

// Tyson's GrowFast brand profile (pulled directly, no AI). Editable in the app.
export const GROWFAST_PROFILE = {
  tagline: "Growth on autopilot.",
  region: "Digital-first B2B SaaS & DTC — global.",
  voice: "Confident, direct, founder-to-founder. Clear over clever, specific over hype, no jargon, no exclamation-point energy.",
  product: "GrowFast — a growth-acceleration platform that connects your lead sources, automates your pipeline stages, and surfaces the exact next action so acquisition runs like a machine.",
  donts: "No hype or buzzwords, no vague promises, never invent metrics or claims, no exclamation-point energy.",
  phrases: "Growth on autopilot; the machine; a compounding system; move your revenue number first.",
};

// Tyson's GrowFast Hero Frame (keyed by HERO_FRAME_FIELDS ids). Edit freely in the app.
export const GROWFAST_HERO_FRAME: Record<string, string> = {
  hero:
    "The founder or growth lead of a 5–200 person B2B or DTC company who has proven their product works but is watching competitors with bigger teams and bigger budgets pull further ahead every month.",
  dream:
    "A fully loaded revenue engine running in the background — qualified leads flowing in daily, pipelines filling without manual hustle, and customer acquisition costs dropping as the business scales.",
  obstacle:
    "Their growth is duct-taped together — a CRM here, an ad account there, a spreadsheet in between — and none of it talks to each other. Every campaign starts from scratch and the team is the bottleneck.",
  cost:
    "Every month without a connected system is a month of paying for leads that never close, hiring to cover gaps that software should fill, and watching a competitor lock up the customers who should have been theirs.",
  enemy:
    "The 'more people to grow more' trap — the belief that scaling requires headcount, when the real bottleneck is a disconnected stack that burns time, buries data, and makes every growth push start over.",
  mechanism:
    "Connect the whole acquisition engine into one compounding loop: when data, targeting and follow-up all talk to each other, acquisition stops being a campaign and starts being a system — each win makes the next one cheaper and faster.",
  conditions:
    "You need clean data flowing into one place, automated follow-up that fires on buyer behavior (not calendar reminders), and a feedback loop that tells you where things break in real time — not next quarter.",
  causality:
    "Unified data surfaces your highest-converting channels → automation routes and nurtures leads without manual intervention → sales reps touch only qualified, ready-to-close opportunities → revenue becomes predictable.",
  system:
    "GrowFast is a growth-acceleration platform that connects your lead sources, automates your pipeline stages, and surfaces the exact actions your team needs to take next — so acquisition runs like a machine.",
  inputs:
    "Your existing lead traffic, ad spend, CRM contacts, email sequences, and sales-rep capacity — GrowFast takes what you already have and routes it through a system engineered to convert.",
  multiplier:
    "Pipeline velocity doubles because no lead sits cold, CAC compresses as winning channels get more budget automatically, and revenue per rep increases because they spend their time closing, not chasing.",
  scoreboard:
    "Weekly CAC by channel, pipeline conversion rate at each stage, time-to-close, and monthly recurring revenue growth — numbers that move inside 30 days so you always know if the machine is working.",
  call:
    "Connect your first data source and run GrowFast's pipeline audit today — in 15 minutes you'll see exactly where leads are leaking and how to fix it, moving your revenue number first.",
};
