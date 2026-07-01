import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { planTrailerBeats } from "@/lib/trailer";

export const maxDuration = 60;

// Storyboard the trailer: plan a cinematic prompt + narration line per beat, grounded in the brain.
// Creates (or refreshes) the campaign's TrailerJob in "planned" state. Generation follows separately.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const inputs = (c.inputs as any) || {};
  const beats = await planTrailerBeats((c as any).campaignType, { name: c.name, sourceText: inputs.sourceText, voice: c.voice });

  // Keep one active job per campaign — clear old planned/failed ones, then create fresh.
  await prisma.trailerJob.deleteMany({ where: { brandId: c.id, status: { in: ["planned", "failed"] } } });
  const job = await prisma.trailerJob.create({ data: { brandId: c.id, status: "planned", step: 0, beats: beats as any } });
  return NextResponse.json({ job });
}
