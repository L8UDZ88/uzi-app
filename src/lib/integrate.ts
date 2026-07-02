// True product integration via Google's Nano Banana (Gemini image) on fal.ai.
// Feeds the REAL product image into the model so it's placed INTO the scene with matched
// lighting, shadow and perspective — and the label/text is preserved (no overlay, no garble).
// Reuses FAL_KEY. Fast model (no coldstart) so we run it synchronously via fal.subscribe.

import { fal } from "@fal-ai/client";

type Brand = { name?: string; region?: string; voice?: string; product?: string; donts?: string };
export type SceneStyle = "hero" | "lifestyle";

export function integrateEnabled(): boolean {
  return !!process.env.FAL_KEY;
}
const INTEGRATE_MODEL = process.env.INTEGRATE_MODEL || "fal-ai/nano-banana/edit";

function cfg() {
  if (process.env.FAL_KEY) fal.config({ credentials: process.env.FAL_KEY });
}
const msg = (e: any) => String(e?.body?.detail?.[0]?.msg || e?.body?.detail || e?.message || e);

function aspectRatio(aspect?: string): string {
  switch (aspect) {
    case "vertical": return "9:16";
    case "wide": return "16:9";
    case "feed":
    case "carousel": return "4:5";
    default: return "1:1";
  }
}

function buildPrompt(brief: string, brand: Brand, style: SceneStyle): string {
  const keepLabel =
    "Use the EXACT product from the provided image — keep its can shape, colors, logo, and ALL label text perfectly intact and legible; do not redraw, restyle, relabel, or warp it. ";
  const integrate =
    "Integrate it naturally into the scene: match the scene's lighting direction, color temperature, shadows, reflections and perspective so it truly belongs in the photo (not a flat paste-on). ";
  const region = brand.region ? `Setting and mood: ${brand.region}. ` : "";
  const donts = brand.donts ? `Avoid: ${brand.donts}. ` : "";
  const single = "Show only this one product — no other cans, bottles, or glasses. No invented text or watermarks. ";
  if (style === "lifestyle") {
    return (
      `Photorealistic lifestyle photo${brand.name ? ` for ${brand.name}` : ""}. ` +
      keepLabel +
      `Place the product into a candid, real moment where people are naturally interacting with it — holding it, toasting, or about to drink — hands and grip realistic and correctly scaled to the can. ` +
      integrate + region + `Scene: ${brief}. ` + donts + single +
      `Editorial, premium, natural light.`
    );
  }
  return (
    `Photorealistic hero product photo${brand.name ? ` for ${brand.name}` : ""}. ` +
    keepLabel +
    `Place the product as the clear hero on a real surface (stone, wood, marble, bar top, wet rock or water's edge) with beautiful depth of field. ` +
    integrate + region + `Scene/mood: ${brief}. ` + donts + single +
    `Editorial, premium, natural light.`
  );
}

// Generate a premium scene and INFUSE the brand's logo/marks: pull the palette from the logo and
// place the logo tastefully + small, matched to the scene lighting. For AI content on brands that
// have no product PNG (e.g. digital brands) but do have logos/brand design.
export async function infuseLogoScene(
  brief: string, brand: Brand, aspect: string | undefined, logoUrls: string[]
): Promise<{ image: string | null; error?: string }> {
  if (!process.env.FAL_KEY) return { image: null, error: "No FAL_KEY." };
  if (!logoUrls.length) return { image: null, error: "No logo." };
  cfg();
  const prompt =
    `Ultra high-end, cinematic, futuristic premium tech scene${brand.name ? ` for ${brand.name}` : ""}. ` +
    `Build the scene: ${brief || "an evocative brand moment"}. ` +
    `Draw the color palette from the provided brand logo and carry those brand colors through the lighting and set. ` +
    `Place the brand logo tastefully and SMALL (a corner, a screen, or a clean surface), matched to the scene's lighting and perspective — keep the logo undistorted and legible, do not enlarge or center it. ` +
    (brand.region ? `Context: ${brand.region}. ` : "") +
    `Dramatic volumetric lighting, shallow depth of field, refined modern grade. No other text or watermarks.` +
    (brand.donts ? ` Avoid: ${brand.donts}.` : "");
  try {
    const r: any = await fal.subscribe(INTEGRATE_MODEL, {
      input: { prompt, image_urls: logoUrls, num_images: 1, aspect_ratio: aspectRatio(aspect), output_format: "png", sync_mode: true },
    });
    const d = r?.data || r;
    const url = d?.images?.[0]?.url;
    if (url) return { image: url };
    return { image: null, error: "Logo infusion returned no image." };
  } catch (e: any) {
    return { image: null, error: `logo-scene: ${msg(e)}` };
  }
}

// images: data URLs (product first, optional logo). Returns a data-URI image (sync_mode).
export async function integrateProduct(
  brief: string, brand: Brand, aspect: string | undefined, style: SceneStyle, imageUrls: string[]
): Promise<{ image: string | null; error?: string }> {
  if (!process.env.FAL_KEY) return { image: null, error: "No FAL_KEY." };
  if (!imageUrls.length) return { image: null, error: "No product image." };
  cfg();
  try {
    const r: any = await fal.subscribe(INTEGRATE_MODEL, {
      input: {
        prompt: buildPrompt(brief || "", brand, style),
        image_urls: imageUrls,
        num_images: 1,
        aspect_ratio: aspectRatio(aspect),
        output_format: "png",
        sync_mode: true,
      },
    });
    const d = r?.data || r;
    const url = d?.images?.[0]?.url;
    if (url) return { image: url };
    return { image: null, error: "Nano Banana returned no image." };
  } catch (e: any) {
    return { image: null, error: `nano-banana: ${msg(e)}` };
  }
}
