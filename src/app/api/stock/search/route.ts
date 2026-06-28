import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { searchStock, stockEnabled } from "@/lib/stock";

// Search stock footage by keyword for a campaign.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!stockEnabled()) {
    return NextResponse.json({ error: "Stock footage isn't enabled yet — add PEXELS_API_KEY in Vercel." }, { status: 400 });
  }
  const { campaignId, query, orientation } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const clips = await searchStock(query || "", orientation === "landscape" ? "landscape" : "portrait");
  return NextResponse.json({ clips });
}
