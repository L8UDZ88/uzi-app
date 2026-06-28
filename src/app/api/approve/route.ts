import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";

export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, status, caption, mediaUrl } = await req.json();
  const item = await prisma.scheduleItem.findUnique({ where: { id }, include: { brand: true } });
  if (!item || item.brand.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Snapshot the approved copy/media so the scheduler publishes exactly what was approved.
  // Skip data: URLs (too large for the DB) — only persist hosted media URLs.
  const data: any = { status: status || "approved" };
  if (typeof caption === "string") data.caption = caption.slice(0, 6000);
  if (typeof mediaUrl === "string" && /^https?:\/\//.test(mediaUrl)) data.mediaUrl = mediaUrl;
  const updated = await prisma.scheduleItem.update({ where: { id }, data });
  return NextResponse.json({ item: updated });
}
