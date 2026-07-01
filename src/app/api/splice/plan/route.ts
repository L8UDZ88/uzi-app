import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { planSplice } from "@/lib/splice";
import { arcFor } from "@/lib/beats";
import { TranscriptWord } from "@/lib/transcribe";

export const maxDuration = 60;

// Suggest the best in/out for a library clip on a given channel format, plus an aligned caption.
// Requires the asset to already be transcribed (POST /api/transcribe).
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId, fileId, format, pillar, beat } = await req.json();
  if (!campaignId || !fileId) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const t = await prisma.transcript.findUnique({ where: { brandId_fileId: { brandId: c.id, fileId } } });
  if (!t) return NextResponse.json({ error: "Transcribe this asset first.", needsTranscription: true }, { status: 409 });

  const words = (Array.isArray(t.words) ? t.words : []) as unknown as TranscriptWord[];
  const beatJob = beat ? arcFor((c as any).campaignType).find((x) => x.id === beat)?.job : undefined;

  const plan = await planSplice(words, format || "reel", { beatJob, pillar, brand: c.name });
  return NextResponse.json({ plan, total: words.length ? words[words.length - 1].end : 0, transcript: t.text });
}
