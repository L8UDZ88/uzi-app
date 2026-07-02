import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { generateDraftAI, StoryCtx } from "@/lib/ai";
import { arcFor } from "@/lib/beats";

export const maxDuration = 60;
const BATCH = 4; // posts drafted per call — keeps each request under the serverless limit

// Autopilot copy tier: draft beat-conditioned copy for the next batch of queued posts, grounded in
// the brain, and mark them "drafted". Client calls this repeatedly (resumable) until done.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const inputs = (c.inputs as any) || {};
  const bk = inputs.brandKit || {};
  const total = await prisma.scheduleItem.count({ where: { brandId: c.id } });

  const items = await prisma.scheduleItem.findMany({
    where: { brandId: c.id, status: "queued", caption: null },
    orderBy: { date: "asc" }, take: BATCH,
  });

  for (const s of items) {
    let story: StoryCtx | undefined;
    const beat = (s as any).beat;
    if (beat) {
      const b = arcFor((c as any).campaignType).find((x) => x.id === beat);
      if (b) story = { beat: { name: b.name, phase: b.phase, job: b.job, keys: b.keys }, brief: inputs.story || {}, loop: (s as any).loop || 0 };
    }
    try {
      const { draft } = await generateDraftAI(s.pillar, s.channel || "Instagram", (s as any).format || "", {
        name: c.name, handle: c.handle, tagline: c.tagline, region: c.region, voice: c.voice,
        sourceText: inputs.sourceText || "", city: (s as any).city || "",
        product: bk.product || "", phrases: bk.phrases || "", donts: bk.donts || "", language: bk.language || "en",
      }, story);
      const cap = [draft.caption, (draft.hashtags || []).join(" ")].filter(Boolean).join("\n\n");
      await prisma.scheduleItem.update({ where: { id: s.id }, data: { caption: cap, status: "drafted" } });
    } catch {
      // leave as queued; the loop will retry it on the next pass
    }
  }

  const remaining = await prisma.scheduleItem.count({ where: { brandId: c.id, status: "queued", caption: null } });
  const drafted = await prisma.scheduleItem.count({ where: { brandId: c.id, status: "drafted" } });
  return NextResponse.json({ drafted, remaining, total, done: remaining === 0 || items.length === 0 });
}
