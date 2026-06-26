import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";

// GET: list this account's campaigns. POST: create a new one.
export async function GET() {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const campaigns = await prisma.brand.findMany({
    where: { userId: uid },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { schedule: true } } },
  });
  return NextResponse.json({ campaigns });
}

export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const campaign = await prisma.brand.create({
    data: { userId: uid, campaignType: body.campaignType === "digital" ? "digital" : "physical", name: body.name || "" },
  });
  return NextResponse.json({ id: campaign.id, campaign });
}
