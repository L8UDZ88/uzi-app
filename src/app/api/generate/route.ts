import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { generateDraft } from "@/lib/generate";

export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { pillar, channel } = await req.json();
  const brand = await prisma.brand.findUnique({ where: { userId: uid } });
  if (!brand) return NextResponse.json({ error: "No brand" }, { status: 404 });
  const draft = generateDraft(pillar, channel || "Instagram", {
    name: brand.name, handle: brand.handle, tagline: brand.tagline, region: brand.region, voice: brand.voice,
  });
  return NextResponse.json({ draft });
}
