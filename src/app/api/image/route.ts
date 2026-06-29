import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { generateImage, generateImageWithProduct, imageEnabled } from "@/lib/image";

export const maxDuration = 60; // image generation can take 15–30s

// Generate a scene image for a post preview from its visual brief.
// If a productId is given, the real product PNG is fed into the model so the scene renders
// AROUND the actual product (no overlay/misalignment, no AI-invented duplicate can).
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!imageEnabled()) {
    return NextResponse.json({ error: "Image generation isn't enabled yet — add OPENAI_API_KEY in Vercel." }, { status: 400 });
  }
  const { campaignId, brief, aspect, productId } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const bk = ((c.inputs as any) || {}).brandKit || {};
  const brand = { name: c.name, region: c.region, voice: c.voice, product: bk.product || "", donts: bk.donts || "" };

  // Gather brand assets to render INTO the scene: the chosen product + any logo/brand images.
  const assets: { buffer: Buffer; mime: string; kind: "product" | "logo" }[] = [];
  if (productId) {
    const p = await prisma.productImage.findUnique({ where: { id: productId } });
    if (p && p.brandId === campaignId) assets.push({ buffer: Buffer.from(p.data, "base64"), mime: "image/png", kind: "product" });
  }
  const logos = await prisma.productImage.findMany({ where: { brandId: campaignId, kind: "logo" }, take: 2 });
  for (const l of logos) assets.push({ buffer: Buffer.from(l.data, "base64"), mime: "image/png", kind: "logo" });

  if (assets.length) {
    const r = await generateImageWithProduct(brief || "", brand, aspect, assets);
    if (!r.image) return NextResponse.json({ error: r.error || "Couldn't generate the image — try again." }, { status: 502 });
    return NextResponse.json({ image: r.image, withProduct: true });
  }
  const { image, error } = await generateImage(brief || "", brand, aspect);
  if (!image) return NextResponse.json({ error: error || "Couldn't generate an image — try again." }, { status: 502 });
  return NextResponse.json({ image });
}
