// Image generation for post previews — turns a visual brief into a real scene image.
// Uses OpenAI's image API via direct REST (no SDK). Returns a data URL or an error reason.
//
// Brand rule: AI renders SCENES / backgrounds with clean negative space — it must NOT redraw
// the product. Real product art (transparent PNGs) is composited on top in a later step.

type Brand = { name?: string; region?: string; voice?: string; product?: string; donts?: string };

export function imageEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

// Tries each image model in order and uses the first one this account/project can access.
// (Different OpenAI accounts have different image models enabled.) IMAGE_MODEL, if set, goes first.
function modelChain(): string[] {
  const chain = [process.env.IMAGE_MODEL || "", "gpt-image-1", "dall-e-3", "dall-e-2"].filter(Boolean);
  return Array.from(new Set(chain));
}

function sizeFor(model: string, aspect?: string): string {
  const dalle = model.startsWith("dall-e");
  if (aspect === "vertical" || aspect === "feed" || aspect === "carousel") return dalle ? "1024x1792" : "1024x1536";
  if (aspect === "wide") return dalle ? "1792x1024" : "1536x1024";
  return "1024x1024";
}

async function tryModel(model: string, key: string, prompt: string, aspect?: string): Promise<{ url?: string; error?: string }> {
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        size: sizeFor(model, aspect),
        n: 1,
      }),
    });
  } catch (e: any) {
    return { error: `${model}: network error ${String(e?.message || e)}` };
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const e: any = await res.json(); detail = e?.error?.message || detail; } catch {}
    return { error: `${model}: ${detail}` };
  }
  const data: any = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (b64) return { url: `data:image/png;base64,${b64}` };
  if (data?.data?.[0]?.url) return { url: data.data[0].url };
  return { error: `${model}: no image returned` };
}

export async function generateImage(brief: string, brand: Brand, aspect?: string): Promise<{ image: string | null; error?: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { image: null, error: "No OPENAI_API_KEY set." };
  if (!brief.trim()) return { image: null, error: "No visual brief to render." };
  const prompt =
    `Editorial brand photography for ${brand.name || "a modern lifestyle brand"}. ` +
    (brand.product ? `This is marketing for: ${brand.product}. Choose a scene that fits this product — do not default to a restaurant/menu setting unless that's clearly appropriate. ` : "") +
    (brand.region ? `Setting and mood: ${brand.region}. ` : "") +
    `Scene: ${brief}. ` +
    (brand.donts ? `Avoid: ${brand.donts}. ` : "") +
    `Premium, authentic, natural light. No text, no logos, no watermarks, no product packaging with readable labels (the real product is composited in afterward). ` +
    `Leave clean negative space so the product and caption can be overlaid.`;
  const errors: string[] = [];
  for (const model of modelChain()) {
    const r = await tryModel(model, key, prompt, aspect);
    if (r.url) return { image: r.url };
    errors.push(r.error || `${model}: unknown error`);
  }
  return { image: null, error: errors.join(" | ") };
}
