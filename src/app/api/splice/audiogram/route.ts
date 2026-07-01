import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { buildAudiogramTimeline, aspectSize, shotstackRender, renderEnabled } from "@/lib/render";
import { TranscriptWord } from "@/lib/transcribe";
import { captionsInWindow } from "@/lib/splice";

export const maxDuration = 60;

// Turn an audio-library clip into an audiogram (branded card + captions + audio) at the channel
// aspect — or, for Podcast, a raw trimmed MP3. Returns a renderId; poll /api/video/status.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!renderEnabled()) return NextResponse.json({ error: "Render isn't enabled — add SHOTSTACK_API_KEY." }, { status: 400 });

  const { campaignId, fileId, start, length, format, captions, podcast } = await req.json();
  if (!campaignId || !fileId) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const inPt = Math.max(0, Number(start) || 0);
  const dur = Math.max(1, Number(length) || 20);
  const { width, height } = aspectSize(format || "reel");
  const origin = new URL(req.url).origin;
  const audioUrl = `${origin}/api/google/file/${encodeURIComponent(fileId)}?campaignId=${encodeURIComponent(campaignId)}`;

  let caps: { text: string; start: number; length: number }[] | undefined;
  if (captions && !podcast) {
    const t = await prisma.transcript.findUnique({ where: { brandId_fileId: { brandId: c.id, fileId } } });
    if (t) caps = captionsInWindow((Array.isArray(t.words) ? t.words : []) as unknown as TranscriptWord[], inPt, inPt + dur);
  }

  const timeline = buildAudiogramTimeline({ audioUrl, start: inPt, length: dur, width, height, title: c.name || undefined, captions: caps, audioOnly: !!podcast });
  const r = await shotstackRender(timeline);
  if (!r.id) return NextResponse.json({ error: r.error || "Render failed to start." }, { status: 502 });
  return NextResponse.json({ renderId: r.id });
}
