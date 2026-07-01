import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { buildSpliceTimeline, aspectSize, shotstackRender, renderEnabled } from "@/lib/render";
import { TranscriptWord } from "@/lib/transcribe";
import { captionsInWindow } from "@/lib/splice";

export const maxDuration = 60;

// Trim a library video to [start, start+length] at the channel aspect (+ optional captions/music).
// Returns a renderId; the client polls /api/video/status for the MP4.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!renderEnabled()) return NextResponse.json({ error: "Video render isn't enabled — add SHOTSTACK_API_KEY." }, { status: 400 });

  const { campaignId, fileId, start, length, format, captions, musicUrl } = await req.json();
  if (!campaignId || !fileId) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const inPt = Math.max(0, Number(start) || 0);
  const dur = Math.max(1, Number(length) || 15);
  const { width, height } = aspectSize(format || "reel");
  const origin = new URL(req.url).origin;
  const clipUrl = `${origin}/api/google/file/${encodeURIComponent(fileId)}?campaignId=${encodeURIComponent(campaignId)}`;

  let caps: { text: string; start: number; length: number }[] | undefined;
  if (captions) {
    const t = await prisma.transcript.findUnique({ where: { brandId_fileId: { brandId: c.id, fileId } } });
    if (t) caps = captionsInWindow((Array.isArray(t.words) ? t.words : []) as unknown as TranscriptWord[], inPt, inPt + dur);
  }

  const timeline = buildSpliceTimeline({ clipUrl, start: inPt, length: dur, width, height, musicUrl: musicUrl || undefined, captions: caps });
  const r = await shotstackRender(timeline);
  if (!r.id) return NextResponse.json({ error: r.error || "Render failed to start." }, { status: 502 });
  return NextResponse.json({ renderId: r.id });
}
