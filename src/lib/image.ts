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

// gpt-image-1 quality: low | medium | high | auto. Lower = much faster (avoids Vercel 504s).
// Default "low" keeps generation well under the 60s serverless limit; raise via IMAGE_QUALITY
// (e.g. "medium"/"high") if you're on a Vercel tier with a longer function timeout.
const IMG_QUALITY = (process.env.IMAGE_QUALITY || "low").toLowerCase();

function sizeFor(model: string, aspect?: string): string {
  const dalle = model.startsWith("dall-e");
  if (aspect === "vertical" || aspect === "feed" || aspect === "carousel") return dalle ? "1024x1792" : "1024x1536";
  if (aspect === "wide") return dalle ? "1792x1024" : "1536x1024";
  return "1024x1024";
}

async function tryModel(model: string, key: string, prompt: string, aspect?: string): Promise<{ url?: string; error?: string }> {
  let res: Response;
  const body: any = { model, prompt, size: sizeFor(model, aspect), n: 1 };
  if (model === "gpt-image-1") body.quality = IMG_QUALITY; // faster, avoids 504s
  try {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(body),
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
    `Do NOT include any drinks, cans, bottles, or glasses in the scene — the product is added separately. ` +
    `Premium, authentic, natural light. No text, no logos, no watermarks. ` +
    `Leave clean negative space so the product and caption can be placed.`;
  const errors: string[] = [];
  for (const model of modelChain()) {
    const r = await tryModel(model, key, prompt, aspect);
    if (r.url) return { image: r.url };
    errors.push(r.error || `${model}: unknown error`);
  }
  return { image: null, error: errors.join(" | ") };
}

// Generate the scene WITH the real product placed in it, by giving gpt-image-1 the product
// PNG as an input image. The model builds the scene around the actual product — aligned,
// scaled, and lit — so there's no overlay/misalignment and no AI-invented duplicate can.
export type AssetImage = { buffer: Buffer; mime: string; kind: "product" | "logo" };

export async function generateImageWithProduct(
  brief: string, brand: Brand, aspect: string | undefined, assets: AssetImage[]
): Promise<{ image: string | null; error?: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { image: null, error: "No OPENAI_API_KEY set." };
  const hasProduct = assets.some((a) => a.kind === "product");
  const hasLogo = assets.some((a) => a.kind === "logo");
  const prompt =
    `Photorealistic editorial brand photo${brand.name ? ` for ${brand.name}` : ""}. ` +
    (hasProduct ? `Integrate the EXACT product shown in the provided product image into the scene — keep its can/label/design unchanged; do NOT redraw, restyle, or relabel it. ` : "") +
    (hasLogo ? `Reflect the brand's visual identity from the provided logo/brand image (its colors and feel). You may place the logo subtly and tastefully (e.g. on signage, a screen, or a corner) only where it fits naturally — never large or watermark-like. ` : "") +
    (brand.product ? `The product/brand: ${brand.product}. ` : "") +
    `Scene: ${brief}. ` +
    (brand.region ? `Setting/mood: ${brand.region}. ` : "") +
    (brand.donts ? `Avoid: ${brand.donts}. ` : "") +
    `Match the scene's lighting, shadows, and perspective so everything sits naturally in the world. ` +
    (hasProduct ? `Do NOT add any other drinks, cans, bottles, or glasses. ` : "") +
    `No invented text or watermarks. Leave negative space for caption text.`;
  try {
    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", prompt);
    form.append("size", sizeFor("gpt-image-1", aspect));
    form.append("quality", IMG_QUALITY); // faster, avoids Vercel 504s on the product path
    for (const a of assets) {
      form.append("image[]", new Blob([new Uint8Array(a.buffer)], { type: a.mime || "image/png" }), `${a.kind}.png`);
    }
    const r = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: form,
    });
    if (!r.ok) {
      let detail = `HTTP ${r.status}`;
      try { const e: any = await r.json(); detail = e?.error?.message || detail; } catch {}
      return { image: null, error: `gpt-image-1 (product): ${detail}` };
    }
    const data: any = await r.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (b64) return { image: `data:image/png;base64,${b64}` };
    return { image: data?.data?.[0]?.url || null, error: data?.data?.[0]?.url ? undefined : "no image returned" };
  } catch (e: any) {
    return { image: null, error: `gpt-image-1 (product): ${String(e?.message || e)}` };
  }
}
