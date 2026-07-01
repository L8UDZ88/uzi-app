import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { refreshAccessToken, listMedia, listAudio } from "@/lib/google";

// List the real photos/videos in the campaign's connected Drive folder.
export async function GET(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const campaignId = params.get("campaignId") || "";
  const slot = params.get("slot") || ""; // documents | audio | video → a typed library, else the brain folder
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const inputs = (c.inputs as any) || {};
  const folderId = slot ? inputs.libraries?.[slot]?.folderId : inputs.driveFolderId;
  if (!folderId) return NextResponse.json({ media: [], error: "Connect a Drive folder first (Edit setup → Inputs)." });
  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user?.googleRefreshToken) return NextResponse.json({ media: [], error: "Connect Google Drive first." });
  const token = await refreshAccessToken(user.googleRefreshToken);
  if (!token) return NextResponse.json({ media: [], error: "Drive auth expired — reconnect." });
  const media = slot === "audio" ? await listAudio(token, folderId) : await listMedia(token, folderId);
  return NextResponse.json({ media });
}
