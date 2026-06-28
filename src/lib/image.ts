// Image generation for post previews — turns a visual brief into a real scene image.
// Uses OpenAI's image API (gpt-image-1) via direct REST (no SDK). Returns a data URL or null.
//
// Brand rule: AI renders SCENES / backgrounds with clean negative space — it must NOT redraw
// the product. Real product art (transparent PNGs) is composited on top in a later step.

type Brand = { name?: string; region?: string; voice?: string };

export function imageEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

// Default gpt-image-1 (best quality). If your OpenAI org isn't verified for it,
// set IMAGE_MODEL=dall-e-3 in Vercel — no verification needed.
const MODEL = process.env.IMAGE_MODEL || "gpt-image-1";
const isDalle = MODEL.startsWith("dall-e");

function sizeFor(aspect?: string): string {
  if (aspect === "vertical" || aspect === "feed" || aspect === "carousel") return isDalle ? "1024x1792" : "1024x1536";
  if (aspect === "wide") return isDalle ? "1792x1024" : "1536x1024";
  return "1024x1024";
}

export async function generateImage(brief: string, brand: Brand, aspect?: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !brief.trim()) return null;
  const prompt =
    `Editorial brand photography for ${brand.name || "a modern lifestyle brand"}. ` +
    (brand.region ? `Setting and mood: ${brand.region}. ` : "") +
    `Scene: ${brief}. ` +
    `Premium, authentic, natural light. No text, no logos, no watermarks, no product packaging with readable labels. ` +
    `Leave clean negative space so caption text can be overlaid.`;
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        size: sizeFor(aspect),
        n: 1,
        ...(isDalle ? { response_format: "b64_json" } : {}),
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (b64) return `data:image/png;base64,${b64}`;
    return data?.data?.[0]?.url || null;
  } catch {
    return null;
  }
}
