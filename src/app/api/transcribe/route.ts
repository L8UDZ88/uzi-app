import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { refreshAccessToken, fetchDriveFile } from "@/lib/google";
import { transcribeBytes, transcribeEnabled } from "@/lib/transcribe";

export const maxDuration = 60; // transcription can take a while on longer clips

// Transcribe a library asset (audio/video) from Drive → cached transcript with word timings.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId, fileId, fileName, mimeType } = await req.json();
  if (!campaignId || !fileId) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Serve from cache if we've already transcribed this file for this brand.
  const cached = await prisma.transcript.findUnique({ where: { brandId_fileId: { brandId: c.id, fileId } } });
  if (cached) return NextResponse.json({ text: cached.text, words: cached.words, cached: true });

  if (!transcribeEnabled()) return NextResponse.json({ error: "Transcription isn't enabled — add ELEVENLABS_API_KEY." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user?.googleRefreshToken) return NextResponse.json({ error: "Connect Google Drive first." }, { status: 400 });
  const token = await refreshAccessToken(user.googleRefreshToken);
  if (!token) return NextResponse.json({ error: "Drive auth expired — reconnect." }, { status: 401 });

  const resp = await fetchDriveFile(token, fileId);
  if (!resp.ok) return NextResponse.json({ error: "Couldn't read that file from Drive." }, { status: 400 });
  const buf = await resp.arrayBuffer();

  const result = await transcribeBytes(buf, fileName || "media", mimeType || "");
  if (!result) return NextResponse.json({ error: "Transcription failed — try a shorter clip." }, { status: 502 });

  await prisma.transcript.create({ data: { brandId: c.id, fileId, text: result.text, words: result.words as any } });
  return NextResponse.json({ text: result.text, words: result.words, cached: false });
}
