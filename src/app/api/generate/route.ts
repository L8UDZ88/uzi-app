import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { generateDraftAI, StoryCtx } from "@/lib/ai";
import { arcFor } from "@/lib/beats";

export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId, pillar, channel, format, city, beat, loop } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const inputs = (c.inputs as any) || {};
  const bk = inputs.brandKit || {};

  // Story Arc context: the beat this post carries + the campaign's Hero Frame brief + loop.
  let story: StoryCtx | undefined;
  if (beat) {
    const b = arcFor((c as any).campaignType).find((x) => x.id === beat);
    if (b) story = { beat: { name: b.name, phase: b.phase, job: b.job, keys: b.keys }, brief: inputs.story || {}, loop: Number(loop) || 0 };
  }

  const { draft, usedAI } = await generateDraftAI(pillar, channel || "Instagram", format || "", {
    name: c.name, handle: c.handle, tagline: c.tagline, region: c.region, voice: c.voice,
    sourceText: inputs.sourceText || "",
    city: city || "",
    product: bk.product || "", phrases: bk.phrases || "", donts: bk.donts || "", language: bk.language || "en",
  }, story);
  return NextResponse.json({ draft, usedAI });
}
