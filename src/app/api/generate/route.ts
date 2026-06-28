import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { generateDraftAI } from "@/lib/ai";

export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId, pillar, channel, format, city } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { draft, usedAI } = await generateDraftAI(pillar, channel || "Instagram", format || "", {
    name: c.name, handle: c.handle, tagline: c.tagline, region: c.region, voice: c.voice,
    sourceText: ((c.inputs as any) || {}).sourceText || "",
    city: city || "",
  });
  return NextResponse.json({ draft, usedAI });
}
