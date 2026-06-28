import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publish, platformKey } from "@/lib/publish";

// The scheduler. Vercel Cron calls this on a schedule (see vercel.json).
// It finds approved, due posts in auto-deliver campaigns and publishes them.
export async function GET(req: Request) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when CRON_SECRET env is set.
  const auth = req.headers.get("authorization") || "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const due = await prisma.scheduleItem.findMany({
    where: { status: "approved", date: { lte: now }, brand: { is: { autoDeliver: true } } },
    include: { brand: { include: { user: { include: { social: true } } } } },
    orderBy: { date: "asc" },
    take: 25,
  });

  const results: any[] = [];
  for (const item of due) {
    const plat = platformKey(item.channel);
    const conn = item.brand.user.social.find((s) => s.platform === plat);
    if (!conn) {
      await prisma.scheduleItem.update({
        where: { id: item.id },
        data: { status: "ready", publishError: `No ${plat} account connected — connect it to auto-publish, or post manually.` },
      });
      results.push({ id: item.id, plat, ready: true });
      continue;
    }
    const res = await publish(
      { platform: conn.platform, accessToken: conn.accessToken, externalId: conn.externalId },
      { caption: item.caption || "", mediaUrl: item.mediaUrl, channel: item.channel, format: item.format || "" }
    );
    if (res.ok) {
      await prisma.scheduleItem.update({ where: { id: item.id }, data: { status: "published", publishedAt: now, externalUrl: res.url || null, publishError: null } });
    } else if (res.pending) {
      await prisma.scheduleItem.update({ where: { id: item.id }, data: { status: "ready", publishError: res.error || "Pending platform approval." } });
    } else {
      await prisma.scheduleItem.update({ where: { id: item.id }, data: { status: "failed", publishError: res.error || "Publish failed." } });
    }
    results.push({ id: item.id, plat, ok: res.ok, pending: res.pending });
  }
  return NextResponse.json({ processed: due.length, at: now.toISOString(), results });
}
