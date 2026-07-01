import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { linkedinConfigured } from "@/lib/social";
import { PUBLISHERS_READY, platformKey } from "@/lib/publish";
import { pillarsFor, CHANNELS } from "@/lib/constants";

// Tells the Deliver tab: auto-deliver state, which platforms this campaign posts to,
// which are connected, and which have a working publisher today.
export async function GET(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId") || "";
  const user = await prisma.user.findUnique({ where: { id: uid }, include: { social: true } });
  const campaign = campaignId ? await prisma.brand.findUnique({ where: { id: campaignId } }) : null;
  // Platforms come from the channels set on the (active) pillars — the calendar's real targets.
  const chanIds = new Set<string>();
  if (campaign) {
    const pcfg = (campaign.pillars as any) || {};
    for (const p of pillarsFor((campaign as any).campaignType)) {
      if (!(pcfg[p.id]?.on ?? true)) continue;
      const chans: string[] = (Array.isArray(pcfg[p.id]?.channels) && pcfg[p.id].channels.length ? pcfg[p.id].channels : p.channels) || [];
      for (const c of chans) chanIds.add(c);
    }
  }
  const platforms = Array.from(new Set(Array.from(chanIds).map((cid) => {
    const ch = CHANNELS.find((c) => c.id === cid);
    return ch ? platformKey(ch.name) : "";
  }).filter(Boolean)));
  const social = user?.social || [];

  return NextResponse.json({
    autoDeliver: !!campaign?.autoDeliver,
    linkedinConfigured: linkedinConfigured(),
    platforms: platforms.map((p) => {
      const conn = social.find((s) => s.platform === p);
      return { platform: p, connected: !!conn, displayName: conn?.displayName || null, ready: PUBLISHERS_READY.includes(p) };
    }),
  });
}
