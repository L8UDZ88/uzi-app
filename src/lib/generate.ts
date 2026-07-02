// Phase 2 — the generation layer (TypeScript, runs natively on Vercel).
// Turns a calendar slot (pillar + channel + brand config) into a real post draft:
// a channel-aware caption, hashtags, a visual brief, and a CTA.
// Deterministic templates (no external API) — the "machine" that drafts every slot.

type Brand = { name: string; handle?: string; tagline?: string; region?: string; voice?: string; sourceText?: string; city?: string };

export type Draft = {
  pillar: string; channel: string; headline: string;
  caption: string; hashtags: string[]; visualBrief: string; cta: string;
  script?: string; // SHORT spoken voiceover script (kept brief to bound video length)
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

type Copy = { headline: string; caption: string; brief: string; cta: string; tags: string[] };

function pillarCopy(pillar: string, b: Brand): Copy {
  const brand = b.name || "the brand";
  const region = b.region || "your area";
  const place = b.city || region; // "Now in [city]" anchors to the specific city when set
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
      headline: `${brand} just landed in ${place}`,
      caption: `${brand} is now in ${place}. ${tag} Go say hi to it on the shelf.`,
      brief: `BACKGROUND = a real stock photo of ${place} specifically (its skyline/landmark), dark scrim for legible text, product bottom-right. Never a generic placeholder.`,
      cta: `Find it in ${place} →`, tags: [slug(brand), "nowin" + slug(place), slug(place), "justlanded"],
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
    // ---- Digital campaign pillars — Customer-as-Hero (Hero Frame) ----
    "The Hero's World": {
      headline: "You, right now",
      caption: `If your day looks like this, you're not alone. ${tag} We see exactly where you are — and where this goes next.`,
      brief: "Relatable scene of the customer's current reality (their desk, their day, their world). The hero, not the product.",
      cta: "Sound familiar? →", tags: [slug(brand), "founderlife", "therealstory"],
    },
    "The Dream": {
      headline: "Picture the after",
      caption: `Imagine the version of this where it just works. ${tag} That future isn't luck — it's a decision away.`,
      brief: "Aspirational scene of the customer's dream outcome — them, thriving, in the future state.",
      cta: "That could be you →", tags: [slug(brand), "thedream", "whatspossible"],
    },
    "The Obstacle": {
      headline: "What's really in the way",
      caption: `It's not you — it's the old way. ${tag} Here's what it's quietly costing you every week you stay in it.`,
      brief: "Name the enemy / old way and the cost of staying stuck. Push against it; the customer is the one held back.",
      cta: "Name your obstacle →", tags: [slug(brand), "theoldway", "costofstuck"],
    },
    "The Turning Point": {
      headline: "The one thing that changes everything",
      caption: `Most ${region || "people"} miss this. ${tag} The shift that turns the whole game — once you see it, you can't unsee it.`,
      brief: "Talking-head or POV: the single insight / mechanism that unlocks the hero's path.",
      cta: "See the shift →", tags: [slug(brand), "theinsight", "turningpoint"],
    },
    "Proof of Crossing": {
      headline: "People like you, on the other side",
      caption: `Real people who made the crossing. ${tag} The results are theirs — you're next.`,
      brief: "Testimonial/metric with the CUSTOMER as protagonist — their win, their number, their story.",
      cta: "See who made it →", tags: [slug(brand), "proof", "results", "customerwins"],
    },
    "The System": {
      headline: "How it becomes inevitable",
      caption: `This isn't motivation — it's a machine. ${tag} Feed it the right inputs, get the outcome, on repeat.`,
      brief: "Show the system working: inputs → output, cause → effect. The machine that makes the hero's win predictable.",
      cta: "See how it works →", tags: [slug(brand), "thesystem", "howitworks"],
    },
    "The Call": {
      headline: "Your move",
      caption: `You can stay where you are, or take the first step. ${tag || "Two minutes to begin."} The choice is yours.`,
      brief: "CTA: the one concrete next step the hero takes now — friction removed.",
      cta: "Take the first step →", tags: [slug(brand), "yourmove", "startnow"],
    },
    "The New World": {
      headline: "The world we're building",
      caption: `This is bigger than one win. ${tag} Here's the world on the other side — and who it's for.`,
      brief: "Brand/vision film: the mission and the world the hero steps into. The transformation, not the product.",
      cta: "Step into it →", tags: [slug(brand), "thenewworld", "mission", "vision"],
    },
  };
  return map[pillar] || {
    headline: brand, caption: `${brand}. ${tag}`, brief: "On-brand visual.", cta: "Learn more →", tags: [slug(brand)],
  };
}

export function generateDraft(pillar: string, channel: string, format: string, b: Brand): Draft {
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

  // Format shaping — overrides channel defaults so each placement is native.
  const fmt = (format || "").toLowerCase();
  if (fmt === "story") {
    caption = `${c.headline}\n\n👆 ${c.cta}`;
    visualBrief = "9:16 Story frame — bold overlay text, brand sticker, and a link/swipe-up sticker for the CTA. Minimal caption. " + c.brief;
    tagCount = 0;
  } else if (fmt === "reel" || fmt === "short" || fmt === "video") {
    headline = `Hook (0–2s): "${c.headline}…"`;
    caption = `${c.headline} — ${c.caption}`;
    visualBrief = "9:16 short video — hook in the first 2 seconds, trending audio, burned-in captions. " + c.brief;
    tagCount = Math.min(tagCount, 4);
  } else if (fmt === "carousel") {
    caption = `${c.headline}\n\n${c.caption}\n\nSwipe → ${c.cta}`;
    visualBrief = "Multi-slide carousel — Slide 1: hook. Slides 2–5: one point each. Final slide: the CTA. " + c.brief;
  } else if (fmt === "thread") {
    caption = `${c.caption}\n\n🧵 A thread ↓`;
    visualBrief = "Thread — post 1 is the hook, 3–5 follow-ups each land one idea, last post is the CTA. " + c.brief;
    tagCount = 2;
  } else if (fmt === "article") {
    caption = `${c.headline}\n\n${c.caption}\n\n${c.cta}`;
    visualBrief = "Long-form article — header image plus structured sections. " + c.brief;
    tagCount = 3;
  } else if (fmt === "long") {
    caption = `${c.caption}\n\nFull video — chapters + SEO description auto-generated.`;
    visualBrief = "Long-form 16:9 video — full narrative with chapters. " + c.brief;
    tagCount = 4;
  } else if (fmt === "clip") {
    caption = `Clip: ${c.caption}`;
    visualBrief = "Short audiogram clip cut from the full episode, captioned for social. " + c.brief;
    tagCount = 3;
  }

  return {
    pillar, channel: ch, headline, caption,
    hashtags: c.tags.slice(0, tagCount).map((t) => "#" + t),
    visualBrief, cta: c.cta,
    script: c.headline, // short fallback spoken line
  };
}
