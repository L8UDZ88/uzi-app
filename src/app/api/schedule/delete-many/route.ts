import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";

// Bulk-delete calendar posts: either a list of ids, or all posts in a campaign (all:true).
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId, ids, all } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (all) {
    const r = await prisma.scheduleItem.deleteMany({ where: { brandId: campaignId } });
    return NextResponse.json({ deleted: r.count });
  }
  if (Array.isArray(ids) && ids.length) {
    const r = await prisma.scheduleItem.deleteMany({ where: { brandId: campaignId, id: { in: ids } } });
    return NextResponse.json({ deleted: r.count });
  }
  return NextResponse.json({ deleted: 0 });
}
