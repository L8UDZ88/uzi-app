import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { generateImage, generateImageWithProduct, generateBackdrop, imageEnabled } from "@/lib/image";
import { integrateProduct, infuseLogoScene, integrateEnabled } from "@/lib/integrate";
import { generateFlux, fluxEnabled } from "@/lib/flux";

export const maxDuration = 60;

// Generate a scene image for a post preview.
// With a product selected, we prefer TRUE integration via Nano Banana (real lighting + label kept).
// style: "lifestyle" = people interacting with it · "hero" = clean hero product shot.
// Fallbacks if FAL_KEY isn't set: hero → product-free backdrop (browser composites the can),
// lifestyle → gpt-image redraw.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!imageEnabled() && !integrateEnabled() && !fluxEnabled()) {
    return NextResponse.json({ error: "Image generation isn't enabled yet — add FAL_KEY (recommended) or OPENAI_API_KEY in Vercel." }, { status: 400 });
  }
  const { campaignId, brief, aspect, productId, style } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const bk = ((c.inputs as any) || {}).brandKit || {};
  const brand = { name: c.name, region: c.region, voice: c.voice, product: bk.product || "", donts: bk.donts || "" };
  const sStyle: "hero" | "lifestyle" = style === "lifestyle" ? "lifestyle" : "hero";

  if (productId) {
    const p = await prisma.productImage.findUnique({ where: { id: productId } });
    const product = p && p.brandId === campaignId ? p : null;
    const logos = await prisma.productImage.findMany({ where: { brandId: campaignId, kind: "logo" }, take: 1 });

    if (product) {
      // Preferred: Nano Banana real integration (label preserved, matched lighting).
      if (integrateEnabled()) {
        const imageUrls = [
          `data:image/png;base64,${product.data}`,
          ...logos.map((l) => `data:image/png;base64,${l.data}`),
        ];
        const r = await integrateProduct(brief || "", brand, aspect, sStyle, imageUrls);
        if (r.image) return NextResponse.json({ image: r.image, integrated: true });
        // else fall through to a fallback below
      }
      // Fallback A — hero: product-free backdrop; the browser composites the real can.
      if (sStyle === "hero") {
        const b = await generateBackdrop(brief || "", brand, aspect);
        if (!b.image) return NextResponse.json({ error: b.error || "Couldn't generate the scene — try again." }, { status: 502 });
        return NextResponse.json({ image: b.image, backdrop: true });
      }
      // Fallback B — lifestyle: gpt-image redraw with the product fed in.
      const assets: { buffer: Buffer; mime: string; kind: "product" | "logo" }[] = [
        { buffer: Buffer.from(product.data, "base64"), mime: "image/png", kind: "product" },
        ...logos.map((l) => ({ buffer: Buffer.from(l.data, "base64"), mime: "image/png", kind: "logo" as const })),
      ];
      const g = await generateImageWithProduct(brief || "", brand, aspect, assets);
      if (!g.image) return NextResponse.json({ error: g.error || "Couldn't generate the image — try again." }, { status: 502 });
      return NextResponse.json({ image: g.image, withProduct: true });
    }
  }

  // No product → plain SCENE. Use Flux (follows compositional prompts like split-screen); the brand
  // logo is composited deterministically bottom-right in the browser (never AI-smeared). gpt-image fallback.
  if (fluxEnabled()) {
    const f = await generateFlux(brief || "", brand, aspect);
    if (f.image) return NextResponse.json({ image: f.image, flux: true });
  }
  const { image, error } = await generateImage(brief || "", brand, aspect);
  if (!image) return NextResponse.json({ error: error || "Couldn't generate an image — try again." }, { status: 502 });
  return NextResponse.json({ image });
}
