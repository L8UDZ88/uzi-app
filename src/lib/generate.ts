// Phase 2 — the generation layer (TypeScript, runs natively on Vercel).
// Turns a calendar slot (pillar + channel + brand config) into a real post draft:
// a channel-aware caption, hashtags, a visual brief, and a CTA.
// Deterministic templates (no external API) — the "machine" that drafts every slot.

type Brand = { name: string; handle?: string; tagline?: string; region?: string; voice?: string };

export type Draft = {
  pillar: string; channel: string; headline: string;
  caption: string; hashtags: string[]; visualBrief: string; cta: string;
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

type Copy = { headline: string; caption: string; brief: string; cta: string; tags: string[] };

function pillarCopy(pillar: string, b: Brand): Copy {
  const brand = b.name || "the brand";
  const region = b.region || "your area";
  const tag = b.tagline || "";
  const map: Record<string, Copy> = {
    "Spotted at": {
      headline: `Spotted: ${brand} in the wild`,
      caption: `Caught ${brand} on the shelf today. ${tag} Grab one on your next run.`,
      brief: "Real in-store photo: person holding the product, store shelf/signage visible. Chain-neutral if the retailer isn't confirmed.",
      cta: "Find it in store →", tags: [slug(brand), "spotted", "foundinstore", slug(region)],
    },
    "Transaction": {
      headline: "Two minutes in, two out",
      caption: `No fuss. ${brand} straight off the shelf and out the door — grab-and-go for wherever today takes you.`,
      brief: "Checkout / grab-and-go moment: product at the register or in-hand leaving the store.",
      cta: "Grab yours →", tags: [slug(brand), "grabandgo", "readywhenyouare"],
    },
    "Now in [city]": {
      headline: `${brand} just landed`,
      caption: `${brand} is now in ${region}. ${tag} Go say hi to it on the shelf — new stores every month.`,
      brief: `BACKGROUND = a real stock photo of the actual city/place, dark scrim for legible text, product bottom-right. Fallback: an iconic ${region} landmark. Never a generic placeholder.`,
      cta: "See where to find it →", tags: [slug(brand), "nowin" + slug(region), slug(region), "justlanded"],
    },
    "Store → lifestyle bridge": {
      headline: "From the shelf to the good part",
      caption: `Grab it on the errand, open it at the payoff. ${brand} goes from store to ${region} in one easy move.`,
      brief: "Two-shot diptych: THE STORE (grab) → THE PLAN (lifestyle payoff: beach / rooftop / out with friends).",
      cta: "Make it the plan →", tags: [slug(brand), "thegoodlife", slug(region) + "life"],
    },
    "Locator": {
      headline: "Where to find us",
      caption: `Where to find ${brand} right now. Save this so you never come up empty — new stores added every month.`,
      brief: "Locator graphic: region map + store/province counts. Pairs with the live locator page.",
      cta: "Save & find a store →", tags: [slug(brand), "wheretofind", "locator", slug(region)],
    },
    "Stock / AI stills": {
      headline: `A little ${region}, in a frame`,
      caption: `${tag || "The good life,"} captured. ${brand} — same world, every week.`,
      brief: "Stock/AI scene of the local world (scene-setter, no product) OR a reveal frame with the REAL product composited in. Never let AI draw the product.",
      cta: "Tap to find it →", tags: [slug(brand), slug(region), "findyour" + slug(region)],
    },
    "Ambient film": {
      headline: "Slow down for a second",
      caption: `Some moments deserve a slower one. ${brand}.`,
      brief: "Corona-style ambient film: environment first, product as portal, golden hour, the signature ritual, real-product reveal, end-frame logo + tagline.",
      cta: "Find your moment →", tags: [slug(brand), "findyour" + slug(region), "ambient"],
    },
    // ---- Digital campaign pillars ----
    "Product in Action": {
      headline: `See ${brand} do the work`,
      caption: `Here's ${brand} actually working. ${tag} Watch it handle the thing you'd rather not.`,
      brief: "Screen recording / UI walkthrough: show the product solving the core job in 1–2 steps.",
      cta: "Try it yourself →", tags: [slug(brand), "producttour", "demo", "saas"],
    },
    "Problem → Outcome": {
      headline: "Before vs after",
      caption: `The painful way vs the ${brand} way. ${tag} Skip the busywork, keep the result.`,
      brief: "Two-state visual: the messy 'before' → the clean 'after' the product delivers.",
      cta: "Get the after →", tags: [slug(brand), "beforeandafter", "workflow"],
    },
    "Now Shipping": {
      headline: `New in ${brand}`,
      caption: `Just shipped: a new way to ${tag || "move faster"}. Live now in ${brand}.`,
      brief: "Release visual: feature name + one-line benefit, clean UI snippet.",
      cta: "See what's new →", tags: [slug(brand), "shipping", "changelog", "newfeature"],
    },
    "Proof & Results": {
      headline: "Receipts",
      caption: `Real results from real teams using ${brand}. The numbers do the talking.`,
      brief: "Testimonial card or metric graphic: a customer quote or a hard outcome.",
      cta: "See the results →", tags: [slug(brand), "casestudy", "results", "proof"],
    },
    "Deal Desk (Authority/POV)": {
      headline: "Hot take",
      caption: `Most ${region || "teams"} get this wrong. Here's the framework that fixes it.`,
      brief: "Talking-head or carousel: a contrarian POV or named framework, founder/expert voice.",
      cta: "Read the framework →", tags: [slug(brand), "framework", "pov", "founder"],
    },
    "Start Here": {
      headline: `Start with ${brand}`,
      caption: `Two minutes to your first win. Free to start — ${tag || "no card required"}.`,
      brief: "CTA graphic: a clear 'start free / book a demo' with the one-step promise.",
      cta: "Start free →", tags: [slug(brand), "starthere", "freetrial", "getstarted"],
    },
    "Vision / Brand Film": {
      headline: "Why we built this",
      caption: `The future we're building with ${brand}. ${tag}`,
      brief: "Brand/vision film: the mission, the change you're making, hero product moments.",
      cta: "Join us →", tags: [slug(brand), "vision", "mission", "buildinpublic"],
    },
  };
  return map[pillar] || {
    headline: brand, caption: `${brand}. ${tag}`, brief: "On-brand visual.", cta: "Learn more →", tags: [slug(brand)],
  };
}

export function generateDraft(pillar: string, channel: string, b: Brand): Draft {
  const c = pillarCopy(pillar, b);
  const ch = channel || "Instagram";
  let headline = c.headline;
  let caption = c.caption;
  let visualBrief = c.brief;
  let tagCount = 4;

  if (ch === "LinkedIn") {
    caption = `${c.headline}.\n\n${c.caption}\n\n${c.cta}`;
    visualBrief = c.brief + " Native image post (no external link in body — link in first comment).";
    tagCount = 3;
  } else if (ch === "Instagram") {
    caption = `${c.caption} ✨\n\n${c.cta}`;
    tagCount = 5;
  } else if (ch === "Facebook") {
    caption = `${c.caption}\n\nWhere do you reach for it? 👇`;
    visualBrief = c.brief + " Native image; community question at close.";
    tagCount = 3;
  } else if (ch === "TikTok") {
    headline = `Hook (0–2s): "${c.headline}…"`;
    caption = `${c.headline} — ${c.caption}`;
    visualBrief = "Short-form vertical video. Hook in first 2 seconds, auto-captions on. " + c.brief;
    tagCount = 4;
  } else if (ch === "YouTube") {
    headline = `${c.headline} — Short`;
    caption = `${c.caption}\n\nChapters + SEO description auto-generated.`;
    visualBrief = "60–90s Short cut from the cornerstone. " + c.brief;
    tagCount = 4;
  } else if (ch === "Podcast") {
    caption = `Show note: ${c.caption}`;
    visualBrief = "Audiogram / waveform clip for social; full episode to RSS.";
    tagCount = 3;
  } else if (ch === "X") {
    caption = c.caption; // keep it tight — X rewards brevity, ≤280 chars
    tagCount = 2;
  }

  return {
    pillar, channel: ch, headline, caption,
    hashtags: c.tags.slice(0, tagCount).map((t) => "#" + t),
    visualBrief, cta: c.cta,
  };
}
