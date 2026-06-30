import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { generateStoryBible, Depth } from "@/lib/story";

export const maxDuration = 60;

// AI-fill the campaign Story Bible from a few user seeds + the brand kit.
// Returns the bible; the wizard stores it under inputs.story and saves.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId, seed, depth } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bk = ((c.inputs as any) || {}).brandKit || {};
  const brand = { name: c.name, voice: c.voice, region: c.region, product: bk.product || "", donts: bk.donts || "" };
  const d: Depth = ["metahero", "metamap", "mvs", "omnistory"].includes(depth) ? depth : "mvs";

  const r = await generateStoryBible(seed || {}, brand, d);
  return NextResponse.json({ bible: r.bible, usedAI: r.usedAI, error: r.error });
}
