import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { linkedinConfigured } from "@/lib/social";
import { PUBLISHERS_READY, platformKey } from "@/lib/publish";
import { activeOutputs } from "@/lib/constants";

// Tells the Deliver tab: auto-deliver state, which platforms this campaign posts to,
// which are connected, and which have a working publisher today.
export async function GET(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId") || "";
  const user = await prisma.user.findUnique({ where: { id: uid }, include: { social: true } });
  const campaign = campaignId ? await prisma.brand.findUnique({ where: { id: campaignId } }) : null;
  const outs = campaign ? activeOutputs((campaign.channels as any) || {}) : [];
  const platforms = Array.from(new Set(outs.map((o) => platformKey(o.channelName))));
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
