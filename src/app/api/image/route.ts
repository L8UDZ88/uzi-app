import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { generateImage, imageEnabled } from "@/lib/image";

// Generate a scene image for a post preview from its visual brief.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!imageEnabled()) {
    return NextResponse.json({ error: "Image generation isn't enabled yet — add OPENAI_API_KEY in Vercel." }, { status: 400 });
  }
  const { campaignId, brief, aspect } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const image = await generateImage(brief || "", { name: c.name, region: c.region, voice: c.voice }, aspect);
  if (!image) return NextResponse.json({ error: "Couldn't generate an image — try again." }, { status: 502 });
  return NextResponse.json({ image });
}
