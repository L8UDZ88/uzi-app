import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { buildCalendar } from "@/lib/calendar";

const GLYPH: any = { LinkedIn: "in", X: "𝕏", YouTube: "▶", Instagram: "◎", Facebook: "f", TikTok: "♪", Podcast: "🎙" };

async function slotsFor(brandId: string) {
  const items = await prisma.scheduleItem.findMany({ where: { brandId }, orderBy: { date: "asc" } });
  return items.map((s) => ({
    id: s.id,
    date: s.date.toISOString().slice(0, 10),
    day: s.date.toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "short" }),
    time: s.date.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }) + " ET",
    pillar: s.pillar, channel: s.channel, format: (s as any).format || "",
    glyph: GLYPH[s.channel] || "·",
    status: s.status, city: (s as any).city || null, externalUrl: (s as any).externalUrl || null,
    beat: (s as any).beat || null, beatName: (s as any).beatName || null, phase: (s as any).phase || null, loop: (s as any).loop ?? null,
    caption: (s as any).caption || null, mediaUrl: (s as any).mediaUrl || null,
  }));
}

// Return the campaign's current calendar (with real IDs).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const c = await prisma.brand.findUnique({ where: { id: params.id } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ slots: await slotsFor(c.id) });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const c = await prisma.brand.findUnique({ where: { id: params.id } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const from = typeof body.from === "string" ? body.from : undefined;
  const to = typeof body.to === "string" ? body.to : undefined;
  const slots = buildCalendar(c.pillars as any, c.channels as any, c.cadence, (c as any).campaignType, from, to);
  await prisma.scheduleItem.deleteMany({ where: { brandId: c.id } });
  // chunk inserts to stay well within limits on large ranges
  for (let i = 0; i < slots.length; i += 500) {
    await prisma.scheduleItem.createMany({
      data: slots.slice(i, i + 500).map((s) => ({ brandId: c.id, date: new Date(s.date), pillar: s.pillar, channel: s.channel, format: s.format, city: s.city || null, beat: s.beat || null, beatName: s.beatName || null, phase: s.phase || null, loop: s.loop ?? null })),
    });
  }
  const mapped = await slotsFor(c.id);
  return NextResponse.json({ count: mapped.length, slots: mapped });
}
