import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";

// Return the campaign's most recent trailer job (for the Trailer tab to render + poll).
export async function GET(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const campaignId = new URL(req.url).searchParams.get("campaignId") || "";
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const job = await prisma.trailerJob.findFirst({ where: { brandId: c.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ job: job || null });
}
