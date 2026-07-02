import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";

// Autopilot review-by-exception: approve every drafted post in one click.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const r = await prisma.scheduleItem.updateMany({
    where: { brandId: c.id, status: "drafted" },
    data: { status: "approved" },
  });
  return NextResponse.json({ ok: true, approved: r.count });
}
