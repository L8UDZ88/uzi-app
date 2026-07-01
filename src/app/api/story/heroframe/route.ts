import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { generateHeroFrame } from "@/lib/heroframe";

export const maxDuration = 60;

// AI-draft the Hero Frame brief from the brand kit + the connected Drive folder's ingested text.
// Fills only the blanks; anything the user wrote is preserved.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId, provided } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const inputs = (c.inputs as any) || {};
  const bk = inputs.brandKit || {};
  const brand = {
    name: c.name, voice: c.voice, region: c.region, tagline: c.tagline,
    product: bk.product || "", donts: bk.donts || "",
    sourceText: inputs.sourceText || "", // the "master brain" from the Drive folder
  };

  const r = await generateHeroFrame(provided || {}, brand);
  return NextResponse.json({ brief: r.brief, usedAI: r.usedAI, error: r.error });
}
