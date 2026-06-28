import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { publish, platformKey } from "@/lib/publish";

// User-triggered "Deliver now" — publishes this campaign's approved + due posts immediately.
// Works on any Vercel plan (the hourly cron handles unattended delivery).
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  const due = await prisma.scheduleItem.findMany({
    where: { brandId: campaignId, status: "approved", date: { lte: now } },
    orderBy: { date: "asc" },
    take: 25,
  });
  const user = await prisma.user.findUnique({ where: { id: uid }, include: { social: true } });
  let published = 0, ready = 0, failed = 0;
  const items: { id: string; status: string; externalUrl: string | null }[] = [];
  for (const item of due) {
    const plat = platformKey(item.channel);
    const conn = user?.social.find((s) => s.platform === plat);
    let status = "ready"; let url: string | null = null;
    if (!conn) {
      await prisma.scheduleItem.update({ where: { id: item.id }, data: { status: "ready", publishError: `No ${plat} account connected — connect it, or post manually.` } });
      ready++;
    } else {
      const res = await publish({ platform: conn.platform, accessToken: conn.accessToken, externalId: conn.externalId }, { caption: item.caption || "", mediaUrl: item.mediaUrl, channel: item.channel, format: item.format || "" });
      if (res.ok) { status = "published"; url = res.url || null; await prisma.scheduleItem.update({ where: { id: item.id }, data: { status, publishedAt: now, externalUrl: url, publishError: null } }); published++; }
      else if (res.pending) { status = "ready"; await prisma.scheduleItem.update({ where: { id: item.id }, data: { status, publishError: res.error || null } }); ready++; }
      else { status = "failed"; await prisma.scheduleItem.update({ where: { id: item.id }, data: { status, publishError: res.error || null } }); failed++; }
    }
    items.push({ id: item.id, status, externalUrl: url });
  }
  return NextResponse.json({ processed: due.length, published, ready, failed, items });
}
