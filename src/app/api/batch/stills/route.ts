import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { generateDraftAI, StoryCtx } from "@/lib/ai";
import { arcFor } from "@/lib/beats";
import { generateFlux, fluxEnabled } from "@/lib/flux";
import { generateImage, generateBackdrop, imageEnabled } from "@/lib/image";

export const maxDuration = 60;
const BATCH = 2; // stills per call — image gen is slow; client calls repeatedly until done

// Batch "Generate all stills": for each APPROVED post that has no visual yet, regenerate its
// beat-conditioned draft to recover the visual brief, render a scene still (Flux → gpt-image
// fallback), and save it as the post's mediaUrl. Resumable — returns remaining count.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!fluxEnabled() && !imageEnabled()) {
    return NextResponse.json({ error: "Image generation isn't enabled — add FAL_KEY (recommended) or OPENAI_API_KEY in Vercel." }, { status: 400 });
  }
  const { campaignId } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const inputs = (c.inputs as any) || {};
  const bk = inputs.brandKit || {};
  const brand = { name: c.name, region: c.region, voice: c.voice, product: bk.product || "", donts: bk.donts || "" };

  // Scope: approved posts with no media. Skip audio-only posts (they carry no still).
  const where = { brandId: c.id, status: "approved", mediaUrl: null } as any;
  const total = await prisma.scheduleItem.count({ where });
  const items = await prisma.scheduleItem.findMany({ where, orderBy: { date: "asc" }, take: BATCH });

  const aspectFor = (fmt: string) =>
    /reel|story|short|vertical|longvideo|tiktok/i.test(fmt || "") ? "9:16" : "1:1";

  for (const s of items) {
    try {
      let story: StoryCtx | undefined;
      const beat = (s as any).beat;
      if (beat) {
        const b = arcFor((c as any).campaignType).find((x) => x.id === beat);
        if (b) story = { beat: { name: b.name, phase: b.phase, job: b.job, keys: b.keys }, brief: inputs.story || {}, loop: (s as any).loop || 0 };
      }
      const { draft } = await generateDraftAI(s.pillar, s.channel || "Instagram", (s as any).format || "", {
        name: c.name, handle: c.handle, tagline: c.tagline, region: c.region, voice: c.voice,
        sourceText: inputs.sourceText || "", city: (s as any).city || "",
        product: bk.product || "", phrases: bk.phrases || "", donts: bk.donts || "", language: bk.language || "en",
      }, story);

      const brief = draft.visualBrief || draft.headline || s.pillar;
      const aspect = aspectFor((s as any).format || "");
      let image = "";
      if (fluxEnabled()) {
        const f = await generateFlux(brief, brand, aspect);
        image = f.image || "";
      }
      if (!image) {
        const g = await generateImage(brief, brand, aspect);
        image = g.image || "";
      }
      if (!image) {
        const b = await generateBackdrop(brief, brand, aspect);
        image = b.image || "";
      }
      if (image) await prisma.scheduleItem.update({ where: { id: s.id }, data: { mediaUrl: image } });
    } catch {
      // leave without media; the next pass retries it
    }
  }

  const remaining = await prisma.scheduleItem.count({ where });
  return NextResponse.json({ total, remaining, done: remaining === 0 || items.length === 0 });
}
