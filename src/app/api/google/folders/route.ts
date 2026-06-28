import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { refreshAccessToken, listFolders } from "@/lib/google";

// List the user's Drive folders (root-level, or matching ?q= search).
export async function GET(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user?.googleRefreshToken) return NextResponse.json({ error: "Not connected" }, { status: 400 });
  const token = await refreshAccessToken(user.googleRefreshToken);
  if (!token) return NextResponse.json({ error: "Drive auth expired — reconnect." }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const folders = await listFolders(token, searchParams.get("q") || undefined);
  return NextResponse.json({ folders });
}
