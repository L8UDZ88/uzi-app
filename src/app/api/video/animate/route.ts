import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { submitAnimate, animateResult, animateEnabled } from "@/lib/animate";

export const maxDuration = 60;

// POST: submit the still for animation. GET: poll status (?statusUrl=&responseUrl=).
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!animateEnabled()) return NextResponse.json({ error: "Animation isn't enabled.", notEnabled: true }, { status: 400 });
  const { campaignId, stillDataUrl, brief } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!stillDataUrl || !String(stillDataUrl).startsWith("data:")) return NextResponse.json({ error: "Need the still image." }, { status: 400 });

  const b64 = String(stillDataUrl).split(",")[1] || "";
  const asset = await prisma.renderAsset.create({ data: { mime: "image/png", data: b64 } });
  const stillUrl = `${new URL(req.url).origin}/api/asset/${asset.id}`;
  const prompt = `Subtle cinematic motion: gentle camera move, ambient life and light. Keep the product, composition, and colors unchanged. ${(brief || "").slice(0, 200)}`;
  const r = await submitAnimate(stillUrl, prompt);
  if (r.error) return NextResponse.json({ error: r.error }, { status: 502 });
  return NextResponse.json({ statusUrl: r.statusUrl, responseUrl: r.responseUrl });
}

export async function GET(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const statusUrl = sp.get("statusUrl") || "";
  const responseUrl = sp.get("responseUrl") || "";
  return NextResponse.json(await animateResult(statusUrl, responseUrl));
}
