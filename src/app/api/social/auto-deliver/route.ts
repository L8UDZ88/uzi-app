import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";

// Toggle a campaign's auto-deliver. When on, the scheduler publishes approved posts at their time.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId, on } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.brand.update({ where: { id: campaignId }, data: { autoDeliver: !!on } });
  return NextResponse.json({ ok: true, autoDeliver: !!on });
}
