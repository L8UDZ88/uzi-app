// High-quality text-to-image via Flux on fal.ai (reuses FAL_KEY). Produces premium, cinematic,
// futuristic tech-forward visuals — a big step up from gpt-image on the plain-scene path.
import { fal } from "@fal-ai/client";

type Brand = { name?: string; region?: string; voice?: string; donts?: string };

export function fluxEnabled(): boolean {
  return !!process.env.FAL_KEY;
}
const FLUX_MODEL = process.env.FLUX_MODEL || "fal-ai/flux/dev";

function sizeFor(aspect?: string): string {
  switch (aspect) {
    case "vertical": return "portrait_16_9";
    case "wide": return "landscape_16_9";
    case "feed":
    case "carousel": return "portrait_4_3";
    default: return "square_hd";
  }
}

// The house look: premium, cinematic, futuristic/tech — never cheap or clip-arty.
const STYLE =
  "Ultra high-end cinematic photograph, futuristic premium tech aesthetic: sleek and sophisticated, " +
  "dramatic volumetric lighting with soft glow, crisp micro-detail, shallow depth of field, refined modern color grade " +
  "(deep blacks with tasteful electric accent light), glass-and-metal materials, product-launch / editorial quality, 8k, sharp. " +
  "No text, no captions, no watermarks, no logos, no UI chrome.";

export async function generateFlux(brief: string, brand: Brand, aspect?: string): Promise<{ image: string | null; error?: string }> {
  if (!process.env.FAL_KEY) return { image: null, error: "No FAL_KEY." };
  fal.config({ credentials: process.env.FAL_KEY });
  const prompt =
    `${brief || "an evocative brand scene"}${brand.name ? ` — for ${brand.name}` : ""}. ` +
    (brand.region ? `Context/world: ${brand.region}. ` : "") +
    STYLE +
    (brand.donts ? ` Avoid: ${brand.donts}.` : "");
  try {
    const r: any = await fal.subscribe(FLUX_MODEL, {
      input: { prompt, image_size: sizeFor(aspect), num_images: 1, output_format: "png", sync_mode: true, enable_safety_checker: true },
    });
    const d = r?.data || r;
    const url = d?.images?.[0]?.url;
    if (url) return { image: url };
    return { image: null, error: "Flux returned no image." };
  } catch (e: any) {
    return { image: null, error: `flux: ${String(e?.body?.detail || e?.message || e)}` };
  }
}
