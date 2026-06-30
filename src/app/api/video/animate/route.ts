import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { submitAnimate, animateResult, animateEnabled } from "@/lib/animate";

export const maxDuration = 60;

// POST: submit the still for animation. GET: poll status (?requestId=).
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!animateEnabled()) return NextResponse.json({ error: "Animation isn't enabled.", notEnabled: true }, { status: 400 });
  const { campaignId, stillDataUrl, brief, sceneStyle } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!stillDataUrl || !String(stillDataUrl).startsWith("data:")) return NextResponse.json({ error: "Need the still image." }, { status: 400 });

  const b64 = String(stillDataUrl).split(",")[1] || "";
  const asset = await prisma.renderAsset.create({ data: { mime: "image/png", data: b64 } });
  const stillUrl = `${new URL(req.url).origin}/api/asset/${asset.id}`;
  // Lock the product so its label survives; animate ONLY the world around it.
  const lifestyle = sceneStyle === "lifestyle";
  const prompt =
    `Locked-off static camera. The product (the can) stays perfectly still, sharp, upright and EXACTLY as shown — ` +
    `do NOT rotate, orbit, move, scale, re-letter or alter the can or its label in any way; preserve every bit of label text exactly. ` +
    `Animate ONLY the surroundings: ` +
    (lifestyle
      ? `real people naturally interacting with it — reaching for it, lifting it, relaxed candid motion, realistic hands. `
      : `ambient environmental life — gentle water, drifting golden light, soft mist, breeze, subtle natural motion. `) +
    `Photoreal, premium, cinematic, no morphing of the product. ${(brief || "").slice(0, 200)}`;
  const r = await submitAnimate(stillUrl, prompt);
  if (r.error) return NextResponse.json({ error: r.error }, { status: 502 });
  return NextResponse.json({ requestId: r.requestId });
}

export async function GET(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  return NextResponse.json(await animateResult(sp.get("requestId") || ""));
}
