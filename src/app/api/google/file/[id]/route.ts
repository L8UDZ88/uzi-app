import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { refreshAccessToken, fetchDriveFile } from "@/lib/google";

export const maxDuration = 60;

// Stream a Drive media file's bytes by id. No session required (the renderer/Shotstack fetches it
// by campaignId + fileId, both unguessable), so we authorize via the campaign's owner token.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const campaignId = new URL(req.url).searchParams.get("campaignId") || "";
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await prisma.user.findUnique({ where: { id: c.userId } });
  if (!user?.googleRefreshToken) return NextResponse.json({ error: "Not connected" }, { status: 400 });
  const token = await refreshAccessToken(user.googleRefreshToken);
  if (!token) return NextResponse.json({ error: "Auth expired" }, { status: 400 });
  const r = await fetchDriveFile(token, params.id);
  if (!r.ok || !r.body) return NextResponse.json({ error: "Couldn't fetch the file." }, { status: 502 });
  return new Response(r.body, {
    headers: {
      "content-type": r.headers.get("content-type") || "application/octet-stream",
      "cache-control": "private, max-age=3600",
    },
  });
}
