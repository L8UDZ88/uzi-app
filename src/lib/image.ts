// Image generation for post previews — turns a visual brief into a real scene image.
// Uses OpenAI's image API via direct REST (no SDK). Returns a data URL or null.
//
// Brand rule: AI renders SCENES / backgrounds with clean negative space — it must NOT redraw
// the product. Real product art (transparent PNGs) is composited on top in a later step.

type Brand = { name?: string; region?: string; voice?: string };

export function imageEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

// Tries the configured model, then auto-falls back to dall-e-3 if the first one is
// unavailable (e.g. gpt-image-1 needs org verification). So it "just works" with only a key.
const PRIMARY = process.env.IMAGE_MODEL || "gpt-image-1";
const FALLBACK = "dall-e-3";

function sizeFor(model: string, aspect?: string): string {
  const dalle = model.startsWith("dall-e");
  if (aspect === "vertical" || aspect === "feed" || aspect === "carousel") return dalle ? "1024x1792" : "1024x1536";
  if (aspect === "wide") return dalle ? "1792x1024" : "1536x1024";
  return "1024x1024";
}

async function tryModel(model: string, key: string, prompt: string, aspect?: string): Promise<string | null> {
  const dalle = model.startsWith("dall-e");
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      size: sizeFor(model, aspect),
      n: 1,
      ...(dalle ? { response_format: "b64_json" } : {}),
    }),
  });
  if (!res.ok) return null;
  const data: any = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (b64) return `data:image/png;base64,${b64}`;
  return data?.data?.[0]?.url || null;
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
    const first = await tryModel(PRIMARY, key, prompt, aspect);
    if (first) return first;
    if (PRIMARY !== FALLBACK) {
      const second = await tryModel(FALLBACK, key, prompt, aspect);
      if (second) return second;
    }
    return null;
  } catch {
    return null;
  }
}
